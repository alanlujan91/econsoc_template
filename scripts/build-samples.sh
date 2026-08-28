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
# it guards ecta and te, which nothing else compiles. A machine without
# poppler-utils must therefore fail rather than quietly skip it: a gate that
# degrades to nothing is indistinguishable from a gate that passed.
command -v pdftotext >/dev/null 2>&1 ||
    die "pdftotext not found (install poppler-utils); the bibliography check cannot run without it"

# Every export declared across the sources: this is what the build owes us.
expected=$(grep -hcE '^ *output: exports/.*\.pdf$' sample/"${SOURCES[0]}" sample/"${SOURCES[1]}" | paste -sd+ | bc)

# Clear first, so nothing below can validate a leftover from an earlier run.
# myst does not overwrite an export file that already exists, which is what let
# the vendored copies rot a full class release behind, so a stale export here
# would survive a rebuild and pass every assertion.
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

# Read the logs, not the exit code.
#
# Match the CONDITION, never the decoration. An earlier version of this pattern
# anchored on '^! ' and silently passed a build whose log held
# "./article_ecta.tex:460: Undefined control sequence." MyST runs xelatex through
# latexmk with -file-line-error, which REWRITES bare TeX-kernel errors from
# "! message" to "file:line: message", so '^! ' matches nothing. Note also that
# class- and package-branded errors read "Class econsocart Error:", not
# "LaTeX Error:", so keying on the latter alone misses those too. That gap is the
# plausible mechanism behind a missing package dropping every table from the PDF
# while this script reported all logs clean.
latex_error_re='^! |[A-Za-z]+ Error:|Undefined control sequence|Missing \$ inserted|Runaway argument|I could(n.t| not) open style file|Emergency stop|^\./[^:]+:[0-9]+: '
for log in "${logs[@]}"; do
    if grep -qE "$latex_error_re" "$log"; then
        echo "ERROR: LaTeX reported a failure in $log" >&2
        grep -nE "$latex_error_re" "$log" | head -5 >&2
        status=1
    fi
done

# Every key cited in the emitted .tex must exist in that export's emitted .bib.
#
# MyST harvests the bibliography from the RENDERED document, so a key reachable
# only from content MyST does not render (a frontmatter part, for instance) is
# written into the .tex and omitted from the .bib. BibTeX then leaves it
# undefined, natbib logs a warning rather than an error, and the PDF ships with a
# visible "?" where the citation should be. Counting entries cannot catch this:
# the other citations still resolve and keep any threshold satisfied. Compare the
# two sets directly.
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

    # `|| true` on each leading grep is load-bearing. grep exits 1 when it matches
    # nothing, which is legitimate here (a .tex with no citations, an empty .bib).
    # Under `set -euo pipefail` that exit propagates through the pipe and kills the
    # whole script at the assignment, with no message and no further exports
    # checked, so a benign zero-match would read as a bare shell crash.
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

    # Numbered section references depend on the `numbering` keys, and getting
    # them wrong fails silently: the headings stay numbered, so the document
    # looks right, while every reference degrades to the heading TITLE
    # ("the Introduction should be Introduction"). The sample references s1, so
    # a real numbered ref must appear. Note heading_1/2/3 is ignored in document
    # frontmatter - only `headings: true` works there - which is exactly the
    # mistake this catches.
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
