#!/usr/bin/env bash
# Check plugins/econsoc.mjs against the fixture project tests/plugins/. Every case exits 0 without
# the plugin, so only the emitted files show it: per repair, a rejection run rebuilds the fixture
# with that repair off and requires its own assertions to fail. See plugins/README.md.
#
#   scripts/check-plugins.sh [--pdf]    --pdf also compiles the documents (TeX, pdftotext)

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
for tool in myst jq perl; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool not found"
done
if $PDF; then
    command -v pdftotext >/dev/null 2>&1 || die "pdftotext not found (install poppler-utils)"
fi
[ -d plugins/node_modules ] || die "plugins/node_modules is missing, so the bundle cannot be checked: run npm ci in plugins/"

FIXTURE=tests/plugins
# Outside the fixture: myst also loads the plugins of a myst.yml in a parent directory
BLIND=tests/_build
TEX_FILES=(article.tex supplement.tex nonum.tex algo.tex)
# At most this many rejection builds at once
JOBS=6

# The repairs plugins/src/index.mjs bundles; ECONSOC_DISABLE switches one off
read -ra REPAIRS < <(cd plugins && node --input-type=module -e \
    "import { repairs } from './econsoc.mjs'; console.log(repairs.join(' '))")
[ "${#REPAIRS[@]}" -gt 0 ] || die "plugins/econsoc.mjs names no repairs"
# Repairs asserted only by code in failures(), not by a TEX_EXPECT or TEX_FORBID line
CODED_ONLY=(part-citations boxed-floats ignored-images inline-raws block-breaks)
# Repairs whose assertions read the site; their rejection runs build it too
SITE_REPAIRS=(inline-raws)

# repair|file|text a .tex must contain, outside `%` comments and the `\iffalse` copies the site
# needs (inline-raws); a text opening with `~` is an extended regular expression
# shellcheck disable=SC1003,SC2016 # LaTeX, single-quoted so the shell expands none of it
TEX_EXPECT=(
    # numbers, wording, the appendix word, and plain text into the sibling document
    'xref|article.tex|LOCAL bare top: Section~\ref{sec-model}. LOCAL bare sub: Section~\ref{sec-sub}.'
    'xref|article.tex|LOCAL worded: Sec~\ref{sec-model} and Sec~\ref{sec-sub}.'
    'xref|article.tex|LOCAL phrase: \hyperref[sec-sub]{the model section} and the \hyperref[sec-model]{section on the model}, and the \hyperref[sec-model]{Model} section.'
    'xref|article.tex|LOCAL equation: (\ref{eq-main}) and Equation~\ref{eq-main}.'
    'xref|article.tex|LOCAL appendix: Appendix~\ref{app-a}, Appendix~\ref{app-b1}.'
    'xref|article.tex|REMOTE: Section~S1, Section~S1.1, Supplemental Material~S1.1, (S1), the robustness section.'
    'xref|article.tex|REMOTE PART: Appendix~A, the appendix section.'
    'xref|supplement.tex|REMOTE BACK: Section~2, Section~2.1, (1), Appendix~A, Appendix~B.1, the model section, Figure~1 of the main text, Assumption~1.'
    'xref|supplement.tex|SUPP LOCAL: Section~\ref{s-top} and Sec~\ref{s-detail}.'
    'xref|supplement.tex|PART LOCAL: Appendix~\ref{app-first} and Appendix~\ref{app-first}.'
    # xref fixed the references inside a proof block before proof-kinds rendered it
    'xref|article.tex|as in \citet{debreu1959}; see Supplemental Material~S1.1 and Sec~\ref{sec-sub}.'
    # the four kinds, with their bodies, labels and references, and an image's exported path
    'proof-kinds|article.tex|\begin{assumption}[Bounded utility]\label{asm-bounded}Utility is bounded'
    'proof-kinds|article.tex|\label{eq-bound}'
    'proof-kinds|article.tex|\includegraphics[width=0.1\linewidth]{files/'
    'proof-kinds|article.tex|\begin{algorithm}\label{alg-iterate}Iterate on (\ref{eq-bound})'
    'proof-kinds|article.tex|\textbf{raw inside the algorithm}'
    'proof-kinds|article.tex|\begin{criterion}[Stopping rule]\label{crit-stop}Stop when the residual of Algorithm~\ref{alg-iterate}'
    'proof-kinds|article.tex|\begin{property}\label{prop-monotone}The policy is monotone under Assumption~\ref{asm-bounded}'
    'proof-kinds|article.tex|\footnote{The footnote is referenced from inside the assumption.}'
    'proof-kinds|article.tex|KINDS: Assumption~\ref{asm-bounded}, Algorithm~\ref{alg-iterate}, Criterion~\ref{crit-stop}, Property~\ref{prop-monotone}.'
    'doi-links|article.tex|DOILINKS: the \href{https://doi.org/10.5281/zenodo.1234567}{replication files} and the badge \href{https://doi.org/10.5281/zenodo.1234567}{'
    'linked-images|article.tex|~badge \\href\{https://doi\.org/10\.5281/zenodo\.1234567\}\{\\includegraphics\[width=0\.7\\linewidth\]\{files/[^}]*\}\}\.'
    'stacked-labels|article.tex|STACKED: Section~\ref{stk-a} and Section~\ref{stk-a}, Figure~\ref{fig-above} and Figure~\ref{fig-above}.'
    'stacked-labels|supplement.tex|REMOTE STACKED: Section~2.2.'
    'section-numbering|nonum.tex|\setcounter{secnumdepth}{0}\section{First part}'
    'target-labels|article.tex|\item \label{item-first}The first claim.'
    'target-labels|article.tex|\item \expandafter\edef\csname @currentlabel\endcsname{\theenumi(\theenumii)}\label{item-nested}A nested claim.'
    'target-labels|article.tex|ITEMS: Item~\ref{item-second}, Item~\ref{item-first}, Item~\ref{item-nested}, claim~\ref{item-nested}, \hyperref[item-second]{the second claim}.'
    'target-labels|article.tex|\phantomsection\label{para-target}This paragraph is a target.'
    'target-labels|supplement.tex|REMOTE ITEMS: Item~2, Claim~2(a), \textbf{??}para-target, the claim.'
    'unnumbered-refs|article.tex|PARA: \textbf{??}para-target and \hyperref[para-target]{the paragraph}.'
    'unnumbered-refs|article.tex|UNNUM: \textbf{??}eq-unnum and Equation~\textbf{??}eq-unnum.'
    'unnumbered-refs|article.tex|CODE: \hyperref[code-target]{the code} and \textbf{??}code-target.'
    'unnumbered-refs|nonum.tex|NONUM: Second~part, Section~\textbf{??}n-second.'
    'label-case|article.tex|MIXED: Section~\ref{sec-Mixed}, (\ref{eq-Mixed}), Sec~\ref{sec-Mixed}, Section~\ref{sec-Mixed}, Section~\ref{sec-model}, Remark~\ref{rem-case}, Remark~\ref{rem-case}, Remark~\ref{rem-case}.'
    'missing-refs|article.tex|MISSING: the class member \textbf{??}no-such-label describes, and see~\textbf{??}no-such-other too.'
    'citation-forms|article.tex|CITES: the body cites \cite{enelow1984} and (\citealp{nash1950}, \citealp[see][p. 3]{debreu1959}).'
    'citation-forms|article.tex|CITEFORMS: see \citet[p. 3]{nash1950}, \citep[e.g.][pg. 22]{nash1950}, \citet[ch. 2]{debreu1959}, \citeyearpar{nash1950}, \citeyearpar{debreu1959}, \citeauthor{nash1950}, \citealp{debreu1959}, (\citealp[see][p. 3]{nash1950}, \citealp[also][ch. 2]{debreu1959}), \citep[cf.][p. 5]{nash1950, debreu1959}.'
    'raw-refs|article.tex|RAWREF: as in Section~\ref{sec-model} and Figure~\ref{fig-main} and (\ref{eq-main}) and Section~S1.'
    'smallcaps|article.tex|SMALLCAPS: the \textsc{Small Caps} role and the \texttt{Ctrl} key.'
    'footnotes|article.tex|FOOTNOTES: a note\footnote{Twice-cited note DISTINCTTWICE.\label{fn:twice}} cited twice\footref{fn:twice}, then'
    'footnotes|article.tex|\caption[]{CAPNOTE: a caption with a note.\footnotemark[\numexpr\value{footnote}+1\relax]}'
    'footnotes|article.tex|\stepcounter{footnote}\footnotetext[\value{footnote}]{Caption note DISTINCTCAPNOTE.}'
    'footnotes|article.tex|x & CELLNOTE\footnotemark[\numexpr\value{footnote}+1\relax] \\'
    'footnotes|article.tex|\stepcounter{footnote}\footnotetext[\value{footnote}]{Cell note DISTINCTCELL.}'
    'part-headings|supplement.tex|\section{First appendix section}\label{app-first}'
    'part-headings|supplement.tex|\subsection{Nested appendix subsection}'
    'raw-tables|article.tex|\caption[]{A raw caption.}\label{tbl-raw}'
    'table-columns|article.tex|\begin{tabularx}{\linewidth}{ll>{\raggedright\arraybackslash}X}'
    'table-columns|article.tex|\begin{tabular}{lrc}'
    'subfigures|article.tex|\begin{subfigure}[t]{0.400\linewidth}'
    'subfigures|article.tex|\caption[]{Two panels.}\label{fig-multi}'
    'quotes|article.tex|\par\hfill---William Shakespeare, \textit{Hamlet}'
    'algorithm-lines|algo.tex|\begin{algorithmic}[1]'
    'algorithm-lines|algo.tex|\State \textbf{while} $x<1$ \textbf{do}'
    'algorithm-lines|algo.tex|\State \hspace*{1\algorithmicindent}$x \gets x + 1$'
    'algorithm-lines|algo.tex|\State \textbf{end while}'
    'exercises|article.tex|\begin{exercise}[Solve for $c$]\label{ex-solve}EXERCISES: find the consumption rule.'
    'exercises|article.tex|\label{eq-ex}'
    'exercises|article.tex|\begin{solution}{Solution to Exercise~\ref{ex-solve}}SOLUTIONS: guess and verify.'
    'claim-fact|article.tex|\begin{claim}[Monotone policy]\label{clm-mono}CLAIMS: the policy rises with wealth.'
    'claim-fact|article.tex|\begin{fact}\label{fct-known}FACTS: a known fact.'
    'claim-fact|article.tex|CLREFS: Claim~\ref{clm-mono}.'
    'proof-titles|article.tex|\begin{proposition}[Decay no faster than $1/x$]\label{prop-decay}TITLES: the consumption gap decays.'
    'proof-titles|article.tex|\begin{proof}[Proof of Proposition~\ref{prop-decay}]TITLES-PROOF: by induction.'
    'proof-titles|article.tex|\begin{remark}\label{rem-outer}TITLES-NEST:'
    'proof-titles|article.tex|\begin{example}[Inner words]\label{ex-inner}An example.'
    'macros|article.tex|\providecommand{\HRat}{H}'
    'macros|article.tex|\providecommand{\Gfac}[1]{\Gamma_{#1}}'
    'macros|article.tex|\providecommand{\PageMac}{P}'
)

# repair|file|text a .tex must not contain, read as TEX_EXPECT reads it
TEX_FORBID=(
    # a \ref to a label only the other document defines
    'xref|article.tex|\ref{s-'
    'xref|supplement.tex|\ref{sec-'
    'xref|supplement.tex|\ref{eq-main}'
    'xref|supplement.tex|\ref{app-a}'
    'xref|supplement.tex|\ref{app-b'
    'xref|article.tex|\ref{app-first}'
    'doi-links|article.tex|\cite{doe2024data}'
    'quotes|article.tex|\caption*'
    'proof-titles|article.tex|[Decay no faster than ]'
    'proof-titles|article.tex|[Proof of ]'
    'proof-titles|article.tex|\begin{remark}[Inner words]'
)

# part-citations: the article cites exactly these, aumann1987 and peck1994 from its parts alone
CITED="aumann1987 debreu1959 enelow1984 nash1950 peck1994"

# Parent node types whose children the site renders inline, where a raw node with children
# (a <div>) breaks the line: inline-raws must leave none
PHRASING='["paragraph","heading","emphasis","strong","underline","delete","link","span","superscript","subscript","smallcaps","keyboard","abbreviation","crossReference","admonitionTitle","tableCell","definitionTerm","captionNumber"]'

# file|text a PDF must contain, whitespace collapsed (pdftotext splits small caps: "A SSUMPTION")
PDF_EXPECT=(
    'article.pdf|Section S1, Section S1.1, Supplemental Material S1.1, (S1)'
    'supplement.pdf|S1.1 A detail'
    'supplement.pdf|a=b (S1)'
    'supplement.pdf|Section 2, Section 2.1, (1), Appendix A, Appendix B.1'
    'supplement.pdf|Figure 1 of the main text, Assumption 1.'
    'supplement.pdf|PART LOCAL: Appendix A and Appendix A.'
    'supplement.pdf|PPENDIX A: F IRST APPENDIX SECTION'
    'supplement.pdf|A.1 Nested appendix subsection'
    'supplement.pdf|REMOTE STACKED: Section 2.2.'
    'article.pdf|2.1 A subsection'
    'article.pdf|x=y (1)'
    'article.pdf|IGURE 1. A'
    'article.pdf|B.1 A part of the second appendix'
    'article.pdf|LOCAL bare top: Section 2.'
    'article.pdf|SSUMPTION 1 (Bounded utility)'
    'article.pdf|KINDS: Assumption 1, Algorithm 1, Criterion 1, Property 1.'
    'article.pdf|Aumann'
    'article.pdf|Peck'
    'article.pdf|CITEFORMS: see Nash (1950, p. 3), (e.g. Nash, 1950, pg. 22), Debreu (1959, ch. 2), (1950), (1959), Nash, Debreu, 1959, (see Nash, 1950, p. 3, also Debreu, 1959, ch. 2), (cf. Nash, 1950, Debreu, 1959, p. 5).'
    'article.pdf|DOILINKS: the replication'
    'article.pdf|MISSING: the class member ??no-such-label describes, and see ??no-such-other too.'
    'article.pdf|STACKED: Section 2.2 and Section 2.2, Figure 2 and Figure 2.'
    'article.pdf|MIXED: Section 2.3, (3), Sec 2.3, Section 2.3, Section 2, Remark 1, Remark 1, Re'
    'article.pdf|EXREFS: Exercise 1 and (4).'
    'article.pdf|LAIM 1 (Monotone policy). CLAIMS:'
    'article.pdf|CLREFS: Claim 1.'
    'article.pdf|ITEMS: Item 2, Item 1, Item 2(a), claim 2(a), the second claim.'
    'article.pdf|PARA: ??para-target and the paragraph.'
    'article.pdf|UNNUM: ??eq-unnum and Equation ??eq-unnum.'
    'article.pdf|RAWREF: as in Section 2 and Figure 1 and (1) and Section S1.'
    'article.pdf|William Shakespeare, Hamlet'
    'article.pdf|Caption note DISTINCTCAPNOTE.'
    'article.pdf|Cell note DISTINCTCELL.'
    'article.pdf|MALL C APS role and the Ctrl key.'
    'article.pdf|H + P +'
    'article.pdf|consumption 12 Real nondurable consumption per capita'
    'article.pdf|MULTIFIG: see Figure 4.'
    'article.pdf|BOXFIG: see Figure 5.'
    'nonum.pdf|NONUM: Second part, Section ??n-second.'
    'nonum.pdf|ECOND PART A sub part'
    'algo.pdf|2: while x < 1 do'
    'algo.pdf|4: end while'
)

# Environments after which LaTeX sets the next text as the same paragraph (block-breaks)
export ENVS='theorem|lemma|corollary|proposition|definition|example|remark|axiom|conjecture|observation|proof|assumption|algorithm|criterion|property|claim|fact|exercise|solution|quote'

# The lines myst's log holds when a LaTeX run went wrong at exit 0: an error latexmk forced
# through, or a reference LaTeX could not resolve
LATEX_FAILED='Latexmk: Errors|gave return code|undefined on input line|There were undefined references|multiply defined|Not in outer par mode'

# cited_keys (lib-econsoc.sh) feeds the comparison below and build-samples.sh: every \cite form,
# including `\citep[e.g.][p. 2]{key}` and a braced note holding `]`, must reach both checks.
check_cited_keys() {
    local tex keys
    tex=$(mktemp --suffix=.tex)
    printf '%s\n' '\citet{a1} \citep{g1, g2} \citeauthor{u1} \citep[e.g.][pg. 22]{b1}' \
        '\citet[Theorem 1]{b2} \citet*{s1} \citeyear{y1} \citep[{see [1]}][p. 2]{b3}' >"$tex"
    keys=$(cited_keys "$tex" | paste -sd' ')
    rm -f "$tex"
    [ "$keys" = "a1 b1 b2 b3 g1 g2 s1 u1 y1" ] || die "cited_keys found {$keys}, expected {a1 b1 b2 b3 g1 g2 s1 u1 y1}"
}

# build DIR FLAGS...: a fresh build of DIR, its log in DIR/_build/check.log. It first copies
# the fixture's gitignored image (ignored-images) to where git ignores it.
build() {
    local dir=$1
    shift
    rm -rf "$dir/_build"
    mkdir -p "$dir/_build/img"
    cp sample/figure_sample.pdf "$dir/_build/img/ignored_figure.pdf"
    (cd "$dir" && myst build "$@") >"$dir/_build/check.log" 2>&1 || die "myst build $* failed in $dir (see $dir/_build/check.log)"
}

# A .tex as LaTeX reads it: no `%` lines, and no `\iffalse ... \fi{}` copies, innermost first
tex_body() {
    grep -v '^%' "$1" | perl -0777 -pe '1 while s/\\iffalse (?:(?!\\iffalse ).)*?\\fi\{\}//gs'
}

# failures DIR [REPAIR]: one line per failed .tex, .bib, log or site assertion for a built DIR,
# limited to REPAIR's own assertions when one is named
failures() {
    local dir=$1 only=${2:-} out=$1/_build/out entry plugin file text cited entries page
    local -A body=()
    for file in "${TEX_FILES[@]}"; do body[$file]=$(tex_body "$out/$file"); done
    mine() { [ -z "$only" ] || [ "$only" = "$1" ]; }
    has() {
        if [[ $2 == '~'* ]]; then grep -qE -- "${2:1}" <<<"$1"; else grep -qF -- "$2" <<<"$1"; fi
    }

    for entry in "${TEX_EXPECT[@]}"; do
        IFS='|' read -r plugin file text <<<"$entry"
        mine "$plugin" || continue
        has "${body[$file]:-}" "$text" || echo "missing from $file: $text"
    done
    for entry in "${TEX_FORBID[@]}"; do
        IFS='|' read -r plugin file text <<<"$entry"
        mine "$plugin" || continue
        if has "${body[$file]:-}" "$text"; then echo "$file still contains: $text"; fi
    done
    if mine xref; then
        # A `??` the repairs write is `\textbf{??}label`; any other is LaTeX's or MyST's
        for file in "${!body[@]}"; do
            if grep -qF '??' <<<"${body[$file]//'\textbf{??}'/}"; then echo "$file contains ??"; fi
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
    if mine boxed-floats; then
        # The admonition's box closes before its figure's float opens
        [ "$(grep -n -m1 -F '\end{framed}' "$out/article.tex" | cut -d: -f1)" \
            -lt "$(grep -n -m1 -F '\label{fig-adm}' "$out/article.tex" | cut -d: -f1)" ] ||
            echo "article.tex sets the figure fig-adm inside its framed box"
    fi
    if mine block-breaks; then
        # Text right after a theorem-like environment or a quote runs on unindented: a blank line
        # must come first
        for file in "${!body[@]}"; do
            F=$file perl -0777 -ne 'print "$ENV{F}: text runs on after \\end{$1}\n" while
                /\\end\{((?:$ENV{ENVS})\*?)\}\n?(?=[A-Za-z(])/g' <<<"${body[$file]}"
        done
    fi
    if mine ignored-images; then
        grep -qF 'Image _build/img/ignored_figure.pdf is gitignored' "$dir/_build/check.log" ||
            echo "the build did not warn of the gitignored image"
    fi
    if mine inline-raws && [ -d "$dir/_build/site/content" ]; then
        for page in "$dir"/_build/site/content/*.json; do
            n=$(jq --argjson phrasing "$PHRASING" '[.mdast | .. | objects | select(.children? | type == "array")
                | . as $p | .children[] | select(.type == "raw" and ((.children // []) | length) > 0)
                | select(.type as $t | $p.type | IN($phrasing[]))] | length' "$page")
            [ "$n" -eq 0 ] || echo "$(basename "$page"): $n raw nodes with children inside phrasing content"
        done
    fi
}

check_cited_keys
echo "OK: cited_keys reads every \\cite form"

flags=(--tex --site)
if $PDF; then flags+=(--pdf); fi
build "$FIXTURE" "${flags[@]}"
grep -q 'Econsoc .* loaded' "$FIXTURE/_build/check.log" || die "plugins/econsoc.mjs did not load"
# The bundle warns when this mystmd is not the release it renders for (index.mjs)
if grep -F 'econsoc: plugins/econsoc.mjs was built for mystmd' "$FIXTURE/_build/check.log"; then
    die "rebuild plugins/econsoc.mjs against this mystmd release (plugins/README.md)"
fi
report=$(failures "$FIXTURE")
[ -z "$report" ] || die "the plugin fails these assertions:"$'\n'"$report"
echo "OK: ${#TEX_EXPECT[@]} expected and ${#TEX_FORBID[@]} forbidden .tex lines, main.bib = cited keys, the site's inline nodes inline"

# The site keeps every original node (each proof inside its raw node) and shows claim and fact
# as proof boxes; the hidden blocks and placeholder links the repairs add are gone
page=$FIXTURE/_build/site/content/index.json # article.md, the first page in the toc
[ -f "$page" ] || die "no site page at $page"
kinds=$(jq -r '[.mdast | .. | objects | select(.type == "proof") | .kind] | unique | join(" ")' "$page")
[ "$kinds" = "algorithm assumption claim criterion example fact proof property proposition remark theorem" ] ||
    die "site proof kinds {$kinds}"
jq -e '[.mdast | .. | objects | select(.data.partCitations? or .data.rawRefs?)] | length == 0' "$page" >/dev/null ||
    die "the site page still holds a hidden block of the repairs"
if grep -rlF 'econsoc.invalid' "$FIXTURE/_build/site"; then die "the site holds a doi-links placeholder"; fi
echo "OK: the site keeps every block, shows claim and fact, and holds nothing the repairs hide"

# Rejection runs: with one repair off, its own assertions must fail. Each copy rewrites the
# fixture's ../../ paths as absolute and must build every .tex, or an empty build fails anything.
# The builds run side by side, JOBS at a time; their checks run after, in order.
rm -rf "$BLIND"/without-*
for repair in "${REPAIRS[@]}"; do
    printf '%s\n' "${TEX_EXPECT[@]}" "${TEX_FORBID[@]}" | grep -q "^$repair|" ||
        [[ " ${CODED_ONLY[*]} " == *" $repair "* ]] || die "repair $repair has no assertions in this script"
    blind=$BLIND/without-$repair
    mkdir -p "$blind"
    for file in "$FIXTURE"/*; do
        [ -f "$file" ] && sed "s#\.\./\.\./#$REPO/#g" "$file" >"$blind/$(basename "$file")"
    done
    flags=(--tex)
    if [[ " ${SITE_REPAIRS[*]} " == *" $repair "* ]]; then flags+=(--site); fi
    while [ "$(jobs -rp | wc -l)" -ge "$JOBS" ]; do wait -n; done
    (ECONSOC_DISABLE=$repair build "$blind" "${flags[@]}") &
done
wait
for repair in "${REPAIRS[@]}"; do
    blind=$BLIND/without-$repair
    for file in "${TEX_FILES[@]}"; do
        [ -s "$blind/_build/out/$file" ] || die "rejection run without $repair: no $file was built (see $blind/_build/check.log)"
    done
    n=$(failures "$blind" "$repair" | wc -l)
    [ "$n" -gt 0 ] || die "mystmd now fixes what repair $repair does: delete it (see plugins/README.md)"
    echo "OK: without repair $repair, $n of its assertions fail"
done

(cd plugins && node build.mjs --check) || die "plugins/econsoc.mjs is stale: cd plugins && npm run build"
echo "OK: plugins/econsoc.mjs matches its source"

if $PDF; then
    if grep -E "$LATEX_FAILED" "$FIXTURE/_build/check.log"; then die "LaTeX went wrong in a fixture PDF (above)"; fi
    declare -A pdf_text=()
    for file in article.pdf supplement.pdf nonum.pdf algo.pdf; do
        # -layout keeps an equation's number next to it; plain mode moves it elsewhere
        pdf_text[$file]=$(pdftotext -layout "$FIXTURE/_build/out/$file" - | tr -s '[:space:]' ' ')
    done
    n=0
    for entry in "${PDF_EXPECT[@]}"; do
        file=${entry%%|*} text=${entry#*|}
        grep -qF -- "$text" <<<"${pdf_text[$file]}" || { echo "missing from $file: $text"; n=$((n + 1)); }
    done
    for file in "${!pdf_text[@]}"; do
        # The repairs print `??label`; a bare `?` is an undefined reference or citation
        if sed -E 's/\?\?[A-Za-z0-9]//g' <<<"${pdf_text[$file]}" | grep -qF '?'; then echo "$file prints ?"; n=$((n + 1)); fi
    done
    twice=$(grep -oF 'DISTINCTTWICE' <<<"${pdf_text[article.pdf]}" | wc -l)
    [ "$twice" -eq 1 ] || { echo "article.pdf prints the twice-cited footnote $twice times"; n=$((n + 1)); }
    [ "$n" -eq 0 ] || die "the PDF assertions above failed"
    echo "OK: ${#PDF_EXPECT[@]} PDF lines, clean LaTeX logs; each document prints the numbers the other gives it"
fi
