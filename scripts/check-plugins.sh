#!/usr/bin/env bash
#
# Check plugins/*.mjs against the fixture project tests/plugins/. Every case it covers exits 0
# without the plugins, so only the emitted files show the difference. A rejection run rebuilds the
# fixture without them and requires the same assertions to fail. plugins/README.md has the rest.
#
#   scripts/check-plugins.sh [--pdf]    --pdf also compiles both documents (TeX, pdftotext)

set -euo pipefail

cd "$(dirname "$0")/.."
REPO=$PWD

# shellcheck source=scripts/lib-econsoc.sh
. scripts/lib-econsoc.sh

PDF=false
for arg; do
    case $arg in
        --pdf) PDF=true ;;
        *) die "unknown argument: $arg" ;;
    esac
done
for tool in myst jq; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool not found"
done

FIXTURE=tests/plugins
# Outside the fixture: myst also loads the plugins of a myst.yml in a parent directory
BLIND=tests/_build/without-plugins

# file|text a .tex must contain outside `%` comments
TEX_EXPECT=(
    # xref.mjs: numbers, wording, the appendix word, and plain text into the sibling document
    'article.tex|LOCAL bare top: Section~\ref{sec-model}. LOCAL bare sub: Section~\ref{sec-sub}.'
    'article.tex|LOCAL worded: Sec~\ref{sec-model} and Sec~\ref{sec-sub}.'
    'article.tex|LOCAL phrase: \hyperref[sec-sub]{the model section} and the \hyperref[sec-model]{section on the model}, and the \hyperref[sec-model]{Model} section.'
    'article.tex|LOCAL equation: (\ref{eq-main}) and Equation~\ref{eq-main}.'
    'article.tex|LOCAL appendix: Appendix~\ref{app-a}, Appendix~\ref{app-b1}.'
    'article.tex|REMOTE: Section~S1, Section~S1.1, Supplemental Material~S1.1, (S1), the robustness section.'
    'supplement.tex|REMOTE BACK: Section~2, Section~2.1, (1), Appendix~A, Appendix~B.1, the model section, Figure~1 of the main text, Assumption~1.'
    'supplement.tex|SUPP LOCAL: Section~\ref{s-top} and Sec~\ref{s-detail}.'
    # proof-kinds.mjs: the four kinds, with their bodies, labels and references
    'article.tex|\begin{assumption}[Bounded utility]\label{asm-bounded}Utility is bounded'
    'article.tex|\label{eq-bound}'
    'article.tex|\begin{algorithm}\label{alg-iterate}Iterate on (\ref{eq-bound})'
    'article.tex|\textbf{raw inside the algorithm}'
    'article.tex|\begin{criterion}[Stopping rule]\label{crit-stop}Stop when the residual of Algorithm~\ref{alg-iterate}'
    'article.tex|\begin{property}\label{prop-monotone}The policy is monotone under Assumption~\ref{asm-bounded}'
    'article.tex|\footnote{The footnote is referenced from inside the assumption.}'
    'article.tex|KINDS: Assumption~\ref{asm-bounded}, Algorithm~\ref{alg-iterate}, Criterion~\ref{crit-stop}, Property~\ref{prop-monotone}.'
    # Both together: xref fixed the references inside the block before proof-kinds rendered it
    'article.tex|as in \citet{debreu1959}; see Supplemental Material~S1.1 and Sec~\ref{sec-sub}.'
)

# file|text a .tex must not contain: a \ref to a label only the other document defines
TEX_FORBID=(
    'article.tex|\ref{s-'
    'supplement.tex|\ref{sec-'
    'supplement.tex|\ref{eq-main}'
    'supplement.tex|\ref{app-'
)

# part-citations.mjs: the article cites exactly these, aumann1987 and peck1994 from its parts alone
CITED="aumann1987 debreu1959 enelow1984 nash1950 peck1994"

# file|text a PDF must contain, whitespace collapsed: each number matches the other document's
PDF_EXPECT=(
    'article.pdf|Section S1, Section S1.1, Supplemental Material S1.1, (S1)'
    'supplement.pdf|S1.1 A detail'
    'supplement.pdf|a=b (S1)'
    'supplement.pdf|Section 2, Section 2.1, (1), Appendix A, Appendix B.1'
    'supplement.pdf|Figure 1 of the main text, Assumption 1.'
    'article.pdf|2.1 A subsection'
    'article.pdf|x=y (1)'
    'article.pdf|IGURE 1. A'
    'article.pdf|B.1 A part of the second appendix'
    'article.pdf|LOCAL bare top: Section 2.'
    'article.pdf|SSUMPTION 1 (Bounded utility)'
    'article.pdf|KINDS: Assumption 1, Algorithm 1, Criterion 1, Property 1.'
    'article.pdf|Aumann'
    'article.pdf|Peck'
)

# cited_keys (lib-econsoc.sh) feeds the comparison below and build-samples.sh. Its regex once
# required `{` right after the command, so `\citep[e.g.][p. 2]{key}` escaped both checks.
check_cited_keys() {
    local tex keys
    tex=$(mktemp --suffix=.tex)
    printf '%s\n' '\citet{a1} \citep{g1, g2} \citeauthor{u1} \citep[e.g.][pg. 22]{b1}' \
        '\citet[Theorem 1]{b2} \citet*{s1} \citeyear{y1}' >"$tex"
    keys=$(cited_keys "$tex" | paste -sd' ')
    rm -f "$tex"
    [ "$keys" = "a1 b1 b2 g1 g2 s1 u1 y1" ] || die "cited_keys found {$keys}, expected {a1 b1 b2 g1 g2 s1 u1 y1}"
}

# build DIR FLAGS...: a fresh build of DIR, its log in DIR/_build/check.log
build() {
    local dir=$1
    shift
    rm -rf "$dir/_build"
    mkdir -p "$dir/_build"
    (cd "$dir" && myst build "$@") >"$dir/_build/check.log" 2>&1 || die "myst build $* failed in $dir (see $dir/_build/check.log)"
}

# Print one line per failed .tex, .bib or site assertion for a built DIR
failures() {
    local dir=$1 out=$1/_build/out entry file text cited entries
    for entry in "${TEX_EXPECT[@]}"; do
        file=${entry%%|*} text=${entry#*|}
        grep -v '^%' "$out/$file" | grep -qF -- "$text" || echo "missing from $file: $text"
    done
    for entry in "${TEX_FORBID[@]}"; do
        file=${entry%%|*} text=${entry#*|}
        if grep -qF -- "$text" "$out/$file"; then echo "$file still contains: $text"; fi
    done
    for file in "$out"/*.tex; do
        if grep -v '^%' "$file" | grep -qF '??'; then echo "$(basename "$file") contains ??"; fi
    done
    grep 'Unhandled LaTeX proof environment' "$dir/_build/check.log" || true
    cited=$(cited_keys "$out/article.tex" | paste -sd' ')
    entries=$(bib_keys "$out/main.bib" | sort | paste -sd' ')
    [ "$cited" = "$CITED" ] || echo "article.tex cites {$cited}, not {$CITED}"
    [ "$entries" = "$CITED" ] || echo "main.bib holds {$entries}, not {$CITED}"
}

check_cited_keys
echo "OK: cited_keys reads every \\cite form"

build "$FIXTURE" --tex
for name in 'Econsoc cross-references' 'Part citations' 'Proof kinds'; do
    grep -q "$name .* loaded" "$FIXTURE/_build/check.log" || die "plugin '$name' did not load"
done
report=$(failures "$FIXTURE")
[ -z "$report" ] || die "the plugins fail these assertions:"$'\n'"$report"
echo "OK: ${#TEX_EXPECT[@]} expected and ${#TEX_FORBID[@]} forbidden .tex lines, main.bib = cited keys"

# The site keeps every original node: the proof blocks inside their raw nodes, no injected citation
build "$FIXTURE" --site
page=$FIXTURE/_build/site/content/index.json # article.md, the first page in the toc
[ -f "$page" ] || die "no site page at $page"
kinds=$(jq -r '[.mdast | .. | objects | select(.type == "proof") | .kind] | sort | join(" ")' "$page")
[ "$kinds" = "algorithm assumption criterion property" ] || die "site proof kinds {$kinds}"
jq -e '[.mdast | .. | objects | select(.data.partCitations?)] | length == 0' "$page" >/dev/null ||
    die "the site page still holds the injected citation block"
echo "OK: the site keeps the four proof blocks and shows no injected citation"

# Rejection run: without the plugins the same assertions must fail. The copy rewrites the
# fixture's ../../ paths as absolute, and must build its .tex, since an empty build fails anything.
rm -rf "$BLIND"
mkdir -p "$BLIND"
cp "$FIXTURE"/*.md "$FIXTURE"/references.bib "$BLIND"/
sed "s#\.\./\.\./#$REPO/#" "$FIXTURE/article.md" >"$BLIND/article.md"
grep -v 'plugins/' "$FIXTURE/myst.yml" | grep -vx '  plugins:' | sed "s#\.\./\.\./#$REPO/#" >"$BLIND/myst.yml"
build "$BLIND" --tex
[ -s "$BLIND/_build/out/article.tex" ] || die "rejection run: no article.tex was built"
blind=$(failures "$BLIND" | wc -l)
[ "$blind" -gt 0 ] || die "rejection run: the fixture passed without the plugins, so these assertions test nothing"
echo "OK: without the plugins, $blind assertions fail"

if [ -d plugins/node_modules ]; then
    (cd plugins && node build.mjs --check) || die "plugins/proof-kinds.mjs is stale: cd plugins && npm run build"
    echo "OK: plugins/proof-kinds.mjs matches its source"
else
    echo "SKIP: bundle staleness (no plugins/node_modules; run npm ci in plugins/)"
fi

if $PDF; then
    command -v pdftotext >/dev/null 2>&1 || die "pdftotext not found (install poppler-utils)"
    build "$FIXTURE" --pdf
    n=0
    for entry in "${PDF_EXPECT[@]}"; do
        file=${entry%%|*} text=${entry#*|}
        # -layout keeps an equation's number next to it; plain mode moves it elsewhere
        pdftotext -layout "$FIXTURE/_build/out/$file" - | tr -s '[:space:]' ' ' | grep -qF -- "$text" ||
            { echo "missing from $file: $text"; n=$((n + 1)); }
    done
    for file in article.pdf supplement.pdf; do
        if pdftotext "$FIXTURE/_build/out/$file" - | grep -qF '?'; then echo "$file prints ?"; n=$((n + 1)); fi
    done
    [ "$n" -eq 0 ] || die "the PDF assertions above failed"
    echo "OK: ${#PDF_EXPECT[@]} PDF lines; each document prints the numbers the other gives it"
fi
