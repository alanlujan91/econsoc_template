#!/usr/bin/env bash
#
# Build every sample export and verify the PDFs are real, current, and typeset
# with the right journal's bibliography style.
#
# This exists because `myst build` exits 0 on a broken build, so a hook that
# checks only its exit status reports success on a document that failed to
# typeset. Reading the exit code is not enough; neither, it turns out, is
# reading the logs.
#
# Three things had to be measured rather than assumed, and each one changed the
# design:
#
#   1. A MISSING or unreadable .bst produces no error anywhere. myst exits 0,
#      the LaTeX logs stay clean, and no .blg survives to grep, because the
#      failure is BibTeX's rather than LaTeX's. The PDF is produced with its
#      bibliography silently absent. Only the artifact shows it.
#   2. A WRONG but valid .bst is invisible to that check. Feeding Econometrica's
#      econsoc.bst to a Theoretical Economics document yields a fully populated
#      bibliography, a clean log, a normal-size PDF, and every content assertion
#      passing, while the document is typeset in the wrong journal's style. That
#      is the exact failure this template's per-journal selection exists to
#      prevent, so the emitted \bibliographystyle is checked against what the
#      journal's own upstream template prescribes.
#   3. Validating whatever PDFs happen to be on disk is not the same as
#      validating this build's output. With no TeX toolchain installed, myst
#      still exits 0, produces nothing, and the previously committed PDFs sit
#      there satisfying every assertion. So the export directory is cleared
#      first and the expected count asserted.
#
# Building both sources covers all three journals, since each source carries one
# export per journal. Econometrica and Theoretical Economics are compiled here
# and nowhere else: CI has no TeX toolchain by design.

set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck source=scripts/lib-econsoc.sh
. "$(dirname "$0")/lib-econsoc.sh"

SOURCES=(article.md supplement.md)

# The bibliography check is the only thing that catches a dead bibliography, and
# it guards ecta and te, which nothing else compiles. Missing poppler-utils must
# fail, never skip. See docs/template-internals.md.
command -v pdftotext >/dev/null 2>&1 ||
    die "pdftotext not found (install poppler-utils); the bibliography check cannot run without it"

# Every export declared across the sources: this is what the build owes us.
expected=$(grep -hcE '^ *output: exports/.*\.pdf$' sample/"${SOURCES[0]}" sample/"${SOURCES[1]}" | paste -sd+ | bc)

# Clear first: myst does not overwrite an export file that already exists, so a
# stale one survives a rebuild and satisfies every assertion below.
# See docs/template-internals.md.
rm -rf sample/exports

echo "Building ${SOURCES[*]} ($expected exports expected)"
( cd sample && myst build "${SOURCES[@]}" --pdf )

status=0

shopt -s nullglob
logs=(sample/exports/*_pdf_logs/*.log sample/exports/*_pdf_tex/*.log)
pdfs=(sample/exports/*.pdf)
texs=(sample/exports/*_pdf_tex/*.tex)
shopt -u nullglob

if [ "${#pdfs[@]}" -ne "$expected" ]; then
    die "expected $expected PDFs under sample/exports/, found ${#pdfs[@]} (is a TeX toolchain installed?)"
fi

# The logs array needs the same zero-guard as the PDFs. Without it a renamed log
# directory makes the loop below a no-op while the summary still reports success.
if [ "${#logs[@]}" -eq 0 ]; then
    die "no LaTeX logs found under sample/exports/, so the log check would cover nothing"
fi

# Read the logs, not the exit code, and match the CONDITION not the decoration:
# latexmk's -file-line-error rewrites "! msg" into "file:line: msg", so a '^! '
# anchor matches nothing. See docs/template-internals.md.
latex_error_re='^! |[A-Za-z]+ Error:|Undefined control sequence|Missing \$ inserted|Runaway argument|I could(n.t| not) open style file|Emergency stop|^\./[^:]+:[0-9]+: '
for log in "${logs[@]}"; do
    if grep -qE "$latex_error_re" "$log"; then
        echo "ERROR: LaTeX reported a failure in $log" >&2
        grep -nE "$latex_error_re" "$log" | head -5 >&2
        status=1
    fi
done

# Every key cited in the emitted .tex must exist in that export's emitted .bib.
# MyST harvests from the RENDERED document, so counting entries cannot catch a
# key that never reached the .bib. See docs/template-internals.md.
for tex in "${texs[@]}"; do
    bib="$(dirname "$tex")/main.bib"

    # A missing main.bib is a FAILURE, not a reason to skip. Skipping silently
    # would turn "MyST stopped emitting the bibliography" into a passing build,
    # which is the exact failure shape this gate exists to catch.
    if [ ! -f "$bib" ]; then
        echo "ERROR: $tex has no main.bib beside it, so its citations cannot be checked" >&2
        status=1
        continue
    fi

    # `|| true` is load-bearing: grep exits 1 on no match, legitimate here, and
    # under `set -euo pipefail` that would kill the script at the assignment with
    # no message. See docs/template-internals.md.
    cited=$({ grep -oE '\\cite[a-zA-Z]*\{[^}]*\}' "$tex" || true; } \
            | sed 's/.*{//; s/}//' | tr ',' '\n' | tr -d ' ' | { grep -v '^$' || true; } | sort -u)
    present=$({ grep -oE '^@[a-zA-Z]+\{[^,]+' "$bib" || true; } | sed 's/.*{//' | sort -u)

    if [ -z "$cited" ]; then
        continue
    fi

    missing=$(comm -23 <(printf '%s\n' "$cited") <(printf '%s\n' "$present") || true)
    if [ -n "$missing" ]; then
        echo "ERROR: keys cited in $tex are absent from $bib:" >&2
        printf '%s\n' "$missing" | sed 's/^/  /' >&2
        status=1
    fi
done

# Assert each export names the style its journal's own upstream template
# prescribes. This is what distinguishes "a bibliography rendered" from "the
# right journal's bibliography rendered".
for tex in "${texs[@]}"; do
    journal=$(sed -n 's/^\\documentclass\[\([a-z]*\),.*/\1/p' "$tex" | head -1)
    emitted=$(sed -n 's/^\\bibliographystyle{\([^}]*\)}.*/\1/p' "$tex" | head -1)

    if [ -z "$journal" ] || [ -z "$emitted" ]; then
        echo "ERROR: could not read the class option or bibliography style from $tex" >&2
        status=1
        continue
    fi

    # Numbered refs need `headings: true` in the document's own frontmatter, where
    # heading_1/2/3 is ignored; wrong keys degrade every ref to the heading TITLE
    # while headings stay numbered. See docs/template-internals.md.
    if ! grep -q 'Section~\\ref{s1}' "$tex"; then
        echo "ERROR: $tex has no numbered reference to s1." >&2
        echo "       Section refs have degraded to heading titles. Check the numbering" >&2
        echo "       keys: frontmatter needs title: true AND headings: true." >&2
        grep -o 'Introduction should be [A-Za-z~\\{}]*' "$tex" | head -1 >&2
        status=1
    fi

    expected_style=$(journal_bst "$journal")
    if [ "$emitted" != "$expected_style" ]; then
        printf 'ERROR: %s targets %s and emits \\bibliographystyle{%s},\n' "$tex" "$journal" "$emitted" >&2
        echo "       but $journal upstream prescribes $expected_style" >&2
        status=1
    fi
done

# Ask the artifact whether the bibliography is actually there. 'Aumann' reaches
# the PDF only through a resolved citation: it appears in references.bib and
# nowhere in the sample prose, so it cannot be satisfied by body text.
for pdf in "${pdfs[@]}"; do
    size=$(wc -c < "$pdf")
    if [ "$size" -lt 10000 ]; then
        echo "ERROR: $pdf is only $size bytes, too small to be a real document" >&2
        status=1
    fi

    refs=$(pdftotext "$pdf" - 2>/dev/null | grep -c 'Aumann' || true)
    if [ "$refs" -lt 3 ]; then
        echo "ERROR: $pdf resolved $refs bibliography references, expected at least 3." >&2
        echo "       BibTeX produced nothing or only part of the bibliography, which" >&2
        echo "       usually means the .bst is missing, unreadable, or not shipped." >&2
        status=1
    fi

    # An unresolved cross-reference bakes in as a literal ?? with no warning. A
    # numbered [Sec %s](#label) link does it in every single-article export
    # (jupyter-book/mystmd#3035), so ordinary MyST reaches it.
    unresolved=$(pdftotext "$pdf" - 2>/dev/null | grep -c '??' || true)
    if [ "$unresolved" -ne 0 ]; then
        echo "ERROR: $pdf contains $unresolved unresolved cross-reference(s) printed as ??." >&2
        echo "       A [Text %s](#label) numbered link renders ?? in exports; use" >&2
        echo '       {raw:latex}`Text~\ref{label}` instead. See README "Cross-References".' >&2
        status=1
    fi
done

if [ "$status" -eq 0 ]; then
    printf 'OK: %d PDFs built and verified, %d logs clean\n' "${#pdfs[@]}" "${#logs[@]}"
fi

exit "$status"
