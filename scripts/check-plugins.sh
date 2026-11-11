#!/usr/bin/env bash
# Check plugins/*.mjs against the fixture project tests/plugins/. Every case exits 0 without the
# plugins, so only the emitted files show the difference: per plugin, a rejection run rebuilds the
# fixture without it and requires that plugin's own assertions to fail. See plugins/README.md.
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
if $PDF; then
    command -v pdftotext >/dev/null 2>&1 || die "pdftotext not found (install poppler-utils)"
fi
[ -d plugins/node_modules ] || die "plugins/node_modules is missing, so the bundle cannot be checked: run npm ci in plugins/"

FIXTURE=tests/plugins
# Outside the fixture: myst also loads the plugins of a myst.yml in a parent directory
BLIND=tests/_build

# Each plugin file under plugins/, and the name its build log line prints when it loads
declare -A PLUGIN_NAME=(
    [xref]='Econsoc cross-references'
    [part-citations]='Part citations'
    [proof-kinds]='Proof kinds'
)

# plugin|file|text a .tex must contain outside `%` comments
TEX_EXPECT=(
    # numbers, wording, the appendix word, and plain text into the sibling document
    'xref|article.tex|LOCAL bare top: Section~\ref{sec-model}. LOCAL bare sub: Section~\ref{sec-sub}.'
    'xref|article.tex|LOCAL worded: Sec~\ref{sec-model} and Sec~\ref{sec-sub}.'
    'xref|article.tex|LOCAL phrase: \hyperref[sec-sub]{the model section} and the \hyperref[sec-model]{section on the model}, and the \hyperref[sec-model]{Model} section.'
    'xref|article.tex|LOCAL equation: (\ref{eq-main}) and Equation~\ref{eq-main}.'
    'xref|article.tex|LOCAL appendix: Appendix~\ref{app-a}, Appendix~\ref{app-b1}.'
    'xref|article.tex|REMOTE: Section~S1, Section~S1.1, Supplemental Material~S1.1, (S1), the robustness section.'
    'xref|supplement.tex|REMOTE BACK: Section~2, Section~2.1, (1), Appendix~A, Appendix~B.1, the model section, Figure~1 of the main text, Assumption~1.'
    'xref|supplement.tex|SUPP LOCAL: Section~\ref{s-top} and Sec~\ref{s-detail}.'
    # xref fixed the references inside a proof block before proof-kinds rendered it
    'xref|article.tex|as in \citet{debreu1959}; see Supplemental Material~S1.1 and Sec~\ref{sec-sub}.'
    # the four kinds, with their bodies, labels and references
    'proof-kinds|article.tex|\begin{assumption}[Bounded utility]\label{asm-bounded}Utility is bounded'
    'proof-kinds|article.tex|\label{eq-bound}'
    'proof-kinds|article.tex|\begin{algorithm}\label{alg-iterate}Iterate on (\ref{eq-bound})'
    'proof-kinds|article.tex|\textbf{raw inside the algorithm}'
    'proof-kinds|article.tex|\begin{criterion}[Stopping rule]\label{crit-stop}Stop when the residual of Algorithm~\ref{alg-iterate}'
    'proof-kinds|article.tex|\begin{property}\label{prop-monotone}The policy is monotone under Assumption~\ref{asm-bounded}'
    'proof-kinds|article.tex|\footnote{The footnote is referenced from inside the assumption.}'
    'proof-kinds|article.tex|KINDS: Assumption~\ref{asm-bounded}, Algorithm~\ref{alg-iterate}, Criterion~\ref{crit-stop}, Property~\ref{prop-monotone}.'
)

# plugin|file|text a .tex must not contain: a \ref to a label only the other document defines
TEX_FORBID=(
    'xref|article.tex|\ref{s-'
    'xref|supplement.tex|\ref{sec-'
    'xref|supplement.tex|\ref{eq-main}'
    'xref|supplement.tex|\ref{app-'
)

# part-citations: the article cites exactly these, aumann1987 and peck1994 from its parts alone
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

# cited_keys (lib-econsoc.sh) feeds the comparison below and build-samples.sh: every \cite form,
# including `\citep[e.g.][p. 2]{key}`, must reach both checks.
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

# failures DIR [PLUGIN]: one line per failed .tex, .bib or log assertion for a built DIR, limited
# to PLUGIN's own assertions when one is named
failures() {
    local dir=$1 only=${2:-} out=$1/_build/out entry plugin file text cited entries
    local -A body=()
    for file in "$out"/*.tex; do body[$(basename "$file")]=$(grep -v '^%' "$file" || true); done
    mine() { [ -z "$only" ] || [ "$only" = "$1" ]; }

    for entry in "${TEX_EXPECT[@]}"; do
        IFS='|' read -r plugin file text <<<"$entry"
        mine "$plugin" || continue
        grep -qF -- "$text" <<<"${body[$file]:-}" || echo "missing from $file: $text"
    done
    for entry in "${TEX_FORBID[@]}"; do
        IFS='|' read -r plugin file text <<<"$entry"
        mine "$plugin" || continue
        if grep -qF -- "$text" <<<"${body[$file]:-}"; then echo "$file still contains: $text"; fi
    done
    if mine xref; then
        for file in "${!body[@]}"; do
            if grep -qF '??' <<<"${body[$file]}"; then echo "$file contains ??"; fi
        done
    fi
    if mine proof-kinds; then
        grep 'Unhandled LaTeX proof environment' "$dir/_build/check.log" || true
    fi
    if mine part-citations; then
        cited=$(cited_keys "$out/article.tex" | paste -sd' ')
        entries=$(bib_keys "$out/main.bib" | sort | paste -sd' ')
        [ "$cited" = "$CITED" ] || echo "article.tex cites {$cited}, not {$CITED}"
        [ "$entries" = "$CITED" ] || echo "main.bib holds {$entries}, not {$CITED}"
    fi
}

check_cited_keys
echo "OK: cited_keys reads every \\cite form"

flags=(--tex --site)
if $PDF; then flags+=(--pdf); fi
build "$FIXTURE" "${flags[@]}"
for name in "${PLUGIN_NAME[@]}"; do
    grep -q "$name .* loaded" "$FIXTURE/_build/check.log" || die "plugin '$name' did not load"
done
report=$(failures "$FIXTURE")
[ -z "$report" ] || die "the plugins fail these assertions:"$'\n'"$report"
echo "OK: ${#TEX_EXPECT[@]} expected and ${#TEX_FORBID[@]} forbidden .tex lines, main.bib = cited keys"

# The site keeps every original node (the proof blocks inside their raw nodes) and drops the
# injected citation
page=$FIXTURE/_build/site/content/index.json # article.md, the first page in the toc
[ -f "$page" ] || die "no site page at $page"
kinds=$(jq -r '[.mdast | .. | objects | select(.type == "proof") | .kind] | sort | join(" ")' "$page")
[ "$kinds" = "algorithm assumption criterion property" ] || die "site proof kinds {$kinds}"
jq -e '[.mdast | .. | objects | select(.data.partCitations?)] | length == 0' "$page" >/dev/null ||
    die "the site page still holds the injected citation block"
echo "OK: the site keeps the four proof blocks and shows no injected citation"

# Rejection runs: without one plugin, that plugin's own assertions must fail. Each copy rewrites
# the fixture's ../../ paths as absolute and must build its .tex, or an empty build fails anything.
rm -rf "$BLIND"/without-*
for plugin in "${!PLUGIN_NAME[@]}"; do
    blind=$BLIND/without-$plugin
    mkdir -p "$blind"
    cp "$FIXTURE"/*.md "$FIXTURE"/references.bib "$blind"/
    sed "s#\.\./\.\./#$REPO/#" "$FIXTURE/article.md" >"$blind/article.md"
    grep -vF "plugins/$plugin.mjs" "$FIXTURE/myst.yml" | sed "s#\.\./\.\./#$REPO/#" >"$blind/myst.yml"
    build "$blind" --tex
    for file in article.tex supplement.tex; do
        [ -s "$blind/_build/out/$file" ] || die "rejection run without $plugin: no $file was built"
    done
    if grep -q "${PLUGIN_NAME[$plugin]} .* loaded" "$blind/_build/check.log"; then
        die "rejection run without $plugin: the plugin still loaded"
    fi
    n=$(failures "$blind" "$plugin" | wc -l)
    [ "$n" -gt 0 ] || die "mystmd now fixes what plugins/$plugin.mjs repairs: delete it (see plugins/README.md)"
    echo "OK: without plugins/$plugin.mjs, $n of its assertions fail"
done

(cd plugins && node build.mjs --check) || die "plugins/proof-kinds.mjs is stale: cd plugins && npm run build"
echo "OK: plugins/proof-kinds.mjs matches its source"

if $PDF; then
    declare -A pdf_text=()
    for file in article.pdf supplement.pdf; do
        # -layout keeps an equation's number next to it; plain mode moves it elsewhere
        pdf_text[$file]=$(pdftotext -layout "$FIXTURE/_build/out/$file" - | tr -s '[:space:]' ' ')
    done
    n=0
    for entry in "${PDF_EXPECT[@]}"; do
        file=${entry%%|*} text=${entry#*|}
        grep -qF -- "$text" <<<"${pdf_text[$file]}" || { echo "missing from $file: $text"; n=$((n + 1)); }
    done
    for file in "${!pdf_text[@]}"; do
        if grep -qF '?' <<<"${pdf_text[$file]}"; then echo "$file prints ?"; n=$((n + 1)); fi
    done
    [ "$n" -eq 0 ] || die "the PDF assertions above failed"
    echo "OK: ${#PDF_EXPECT[@]} PDF lines; each document prints the numbers the other gives it"
fi
