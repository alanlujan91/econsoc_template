#!/usr/bin/env bash
# Build every sample export and verify the emitted .tex, logs and PDFs: myst exits 0 on a broken
# build, so only the artifacts show it. Rationale per check: docs/template-internals.md,
# "What build-samples.sh guards, and why each check exists".

set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck source=scripts/lib-econsoc.sh
. "$(dirname "$0")/lib-econsoc.sh"

SOURCES=(article.md supplement.md)

# Proof kinds the samples declare that released myst-to-tex maps, and those it drops (mystmd#3031)
MAPPED_KINDS=(theorem proposition lemma definition remark axiom example)
DROPPED_KINDS=(assumption algorithm)

command -v pdftotext >/dev/null 2>&1 ||
    die "pdftotext not found (install poppler-utils); the bibliography check cannot run without it"

# Every export declared across the sources, each of which the build must produce
expected=$(cat "${SOURCES[@]/#/sample/}" | grep -cE '^ *output: exports/.*\.pdf$' || true)
[ "$expected" -gt 0 ] || die "no 'output: exports/*.pdf' line in ${SOURCES[*]}, so nothing would be checked"

rm -rf sample/exports

echo "Building ${SOURCES[*]} ($expected exports expected)"
( cd sample && myst build "${SOURCES[@]}" --pdf )

status=0
fail() { echo "ERROR: $*" >&2; status=1; }

shopt -s nullglob
logs=(sample/exports/*_pdf_logs/*.log sample/exports/*_pdf_tex/*.log)
pdfs=(sample/exports/*.pdf)
texs=(sample/exports/*_pdf_tex/*.tex)
shopt -u nullglob

[ "${#pdfs[@]}" -eq "$expected" ] ||
    die "expected $expected PDFs under sample/exports/, found ${#pdfs[@]} (is a TeX toolchain installed?)"
[ "${#texs[@]}" -eq "$expected" ] ||
    die "expected $expected .tex files under sample/exports/*_pdf_tex/, found ${#texs[@]}"
[ "${#logs[@]}" -gt 0 ] ||
    die "no LaTeX logs found under sample/exports/, so the log check would cover nothing"

# Match the condition, not the decoration: -file-line-error rewrites "! msg" as "file:line: msg".
latex_error_re='^! |[A-Za-z]+ Error:|Undefined control sequence|Missing \$ inserted|Runaway argument|I could(n.t| not) open style file|Emergency stop|^\./[^:]+:[0-9]+: '
for log in "${logs[@]}"; do
    if grep -qE "$latex_error_re" "$log"; then
        fail "LaTeX reported a failure in $log"
        grep -nE "$latex_error_re" "$log" | head -5 >&2
    fi
done

for tex in "${texs[@]}"; do
    # Every cited key must be in this export's emitted .bib; a missing main.bib is a failure.
    bib="$(dirname "$tex")/main.bib"
    if [ ! -f "$bib" ]; then
        fail "$tex has no main.bib beside it, so its citations cannot be checked"
    else
        missing=$(comm -23 <(cited_keys "$tex") <(bib_keys "$bib" | sort -u) || true)
        if [ -n "$missing" ]; then
            fail "keys cited in $tex are absent from $bib:"
            printf '%s\n' "$missing" | sed 's/^/  /' >&2
        fi
    fi

    # The emitted style must be the one the journal's own upstream template prescribes.
    journal=$(sed -n 's/^\\documentclass\[\([a-z]*\),.*/\1/p' "$tex" | head -1)
    emitted=$(sed -n 's/^\\bibliographystyle{\([^}]*\)}.*/\1/p' "$tex" | head -1)
    if [ -z "$journal" ] || [ -z "$emitted" ]; then
        fail "could not read the class option or bibliography style from $tex"
    else
        expected_style=$(journal_bst "$journal")
        if [ "$emitted" != "$expected_style" ]; then
            fail "$tex targets $journal and emits \\bibliographystyle{$emitted}, but $journal upstream prescribes $expected_style"
        fi
    fi

    if ! grep -q 'Section~\\ref{s1}' "$tex"; then
        fail "$tex has no numbered reference to s1."
        echo "       Section refs have degraded to heading titles. Check the numbering" >&2
        echo "       keys: frontmatter needs title: true AND headings: true." >&2
        grep -o 'Introduction should be [A-Za-z~\\{}]*' "$tex" | head -1 >&2 || true
    fi

    for env in "${MAPPED_KINDS[@]}"; do
        grep -q "\\\\begin{$env}" "$tex" || fail "\\begin{$env} missing from $tex"
    done
    for env in "${DROPPED_KINDS[@]}"; do
        if grep -q "\\\\begin{$env}" "$tex"; then
            fail "$env now reaches $tex: mystmd#3031 has landed: rebuild sample/exports and drop the note in sample/article.md"
        fi
    done

    if grep -n '\\caption\*' "$tex" >&2; then
        fail "\\caption* in $tex typesets as \"FIGURE 0\": a blockquote attribution written '--- Name' causes it; use '-- Name'"
    fi
done

# 'Aumann' reaches the PDF only through a resolved citation: it is in references.bib, not the prose.
for pdf in "${pdfs[@]}"; do
    size=$(wc -c < "$pdf")
    [ "$size" -ge 10000 ] || fail "$pdf is only $size bytes, too small to be a real document"

    text=$(pdftotext "$pdf" - 2>/dev/null || true)
    refs=$(grep -c 'Aumann' <<<"$text" || true)
    if [ "$refs" -lt 3 ]; then
        fail "$pdf resolved $refs bibliography references, expected at least 3."
        echo "       BibTeX produced nothing or only part of the bibliography, which" >&2
        echo "       usually means the .bst is missing, unreadable, or not shipped." >&2
    fi

    unresolved=$(grep -c '??' <<<"$text" || true)
    if [ "$unresolved" -ne 0 ]; then
        fail "$pdf contains $unresolved unresolved cross-reference(s) printed as ??."
        echo "       A numbered [Text %s](#label) link renders ?? in exports (mystmd#3035);" >&2
        echo "       list plugins/xref.mjs in the project's myst.yml (see plugins/README.md)." >&2
    fi
done

if [ "$status" -eq 0 ]; then
    printf 'OK: %d PDFs built and verified, %d logs clean, %d .tex files carry the declared content\n' \
        "${#pdfs[@]}" "${#logs[@]}" "${#texs[@]}"
fi

exit "$status"
