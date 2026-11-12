# MyST Authoring

> **The upstream limitations below were measured on mystmd 1.10.1**; those the plugin
> repairs were measured again on 1.13.0. Several describe bugs with open pull
> requests: [#2352](https://github.com/jupyter-book/mystmd/pull/2352) (headings in
> frontmatter parts), [#3031](https://github.com/jupyter-book/mystmd/pull/3031)
> (dropped proof kinds), [#3033](https://github.com/jupyter-book/mystmd/pull/3033)
> (citations in frontmatter parts), [#3035](https://github.com/jupyter-book/mystmd/pull/3035)
> (numbered cross-references).
>
> Once a release fixes one, the entry describing it becomes *unnecessary* while
> staying true. For a bug the plugin repairs, `scripts/check-plugins.sh` then fails and
> says to delete the repair. For the rest, every CI job keeps passing: re-measuring a
> fixed bug returns a clean result that looks like a passing test. On any mystmd
> version bump, re-run the probe for each entry and **delete** the ones whose bug no longer
> reproduces. Re-verifying without deleting leaves users working around a bug that
> was fixed months ago.

### Approach

This template uses MyST native features wherever possible and falls back to raw LaTeX for complex tables and algorithms that exceed MyST's native capabilities.

### MyST Native Features

#### Typography

- **Emphasis**: `*italic*` and `**bold**` instead of `\textit{}` and `\textbf{}`
- **Math**: Standard MyST math with `$...$` and `` ```math `` blocks
- **Inline code**: backticks, rendered as `\texttt{...}` (not `\verb`)
- **Headings**: Markdown `#`, `##`, `###` for sections
- **Small caps and sans serif**: `` {sc}`X` `` and `` {sf}`X` `` with the plugin. Without it, both take inline LaTeX, `\textsc{}` and `\textsf{}` (see [Real limitations](#real-limitations-a-qe-feature-myst-cannot-reproduce-in-the-pdf))

#### Citations

- `` {cite:t}`ref` `` for textual citations (e.g., "Smith (2020)") renders as `\citet{}`
- `` {cite:p}`ref` `` for parenthetical citations (e.g., "(Smith 2020)") renders as `\citep{}`
- MyST recognizes other roles too (`{cite:author}`, `{cite:year}`, ...), and citation prefixes and suffixes. With the plugin, its `citation-forms` repair writes each as the site prints it, adds natbib's starred and capital forms as roles (`{cite:ps}` for `\citep*`, `{cite:ct}` for `\Citet`), and its `authored-bib` repair resolves a key cited only in raw LaTeX ([Plugin repairs](plugin-repairs.md#citations)). Without the plugin, MyST's LaTeX renderer collapses them all to `\citet`/`\citep` and drops the notes, so the QE sample's author-only (`\citeauthor`) and year-only (`\citeyear`) cites need raw LaTeX; see [Limitations and Fidelity](#myst-limitations-and-fidelity-to-the-qe-and-ecma-template). See also the [MyST Citations Guide](https://mystmd.org/guide/citations).
- `` {cite}`a,b` `` is narrative, "Aumann (1987), Nash (1950)," on the site and in the PDF alike, by MyST's design. Write `{cite:p}` for a parenthetical citation.

#### Lists

- Itemized lists: Markdown `-` syntax
- Numbered lists: Markdown `1.`, `2.`, etc.

#### Footnotes

- Markdown footnote syntax: `[^1]` with `[^1]: Footnote text.` at the bottom
- A footnote in a caption or a table cell, or one referenced twice, needs the plugin's `footnotes` repair ([Plugin repairs](plugin-repairs.md#running-text))

#### Quotations

- Markdown blockquote syntax with `>` prefix
- MyST converts to `\begin{quote}` in LaTeX
- For an attribution line, see [Blockquote attributions](template-options.md#blockquote-attributions)
- See [MyST Typography Guide](https://mystmd.org/guide/typography#quotations)

#### Theorem-like Environments

> **Without the plugin, `{prf:assumption}` and `{prf:algorithm}` are dropped from
> the PDF.** Released `myst-to-tex` maps 11 of the 15 proof kinds; `algorithm`,
> `assumption`, `criterion`, and `property` match no case and are omitted along with
> their `\label`, so cross-references to them render `??`. The build exits 0. See
> [jupyter-book/mystmd#3030](https://github.com/jupyter-book/mystmd/issues/3030);
> the fix is open as [#3031](https://github.com/jupyter-book/mystmd/pull/3031). The
> plugin's `proofs` repair writes all four
> ([Plugin repairs](plugin-repairs.md#proofs-and-exercises)).
>
> Without the plugin, write assumptions as `{prf:axiom}` and relabel the
> cross-reference text:
>
> ```yaml
> numbering:
>   "proof:axiom":
>     template: Assumption %s
> ```
>
> The block survives and references read "Assumption 1". Because MyST injects
> `\newtheorem{axiom}{Axiom}`, the heading prints "AXIOM 1" unless the export
> sets `axiom_as_assumption: true`, which prints it as "ASSUMPTION 1" on the
> assumption counter.
>
> Algorithms have the same workaround with `{prf:observation}`,
> `"proof:observation": {template: Algorithm %s}`, and the export option
> `observation_as_algorithm: true`. Measured (SDP paper, 2026-10-16): with both
> options set, the headings print "ASSUMPTION 1" and "ALGORITHM 1" and every
> reference matches. Both options default to false, which leaves a real axiom
> or observation under its own name.

MyST proof directives that produce correct LaTeX output when the title is plain words.
A title holding math, an abbreviation, a role, or a `{prf:ref}` comes out whole only
through the plugin's `proofs` repair. As in the hand-written samples, Definition,
Example and Remark print upright and the other kinds in italics; emphasis inside an
italic body switches to upright.

| MyST Directive | LaTeX Environment |
| --- | --- |
| `{prf:theorem}` | `\begin{theorem}` |
| `{prf:lemma}` | `\begin{lemma}` |
| `{prf:proposition}` | `\begin{proposition}` |
| `{prf:corollary}` | `\begin{corollary}` |
| `{prf:definition}` | `\begin{definition}` |
| `{prf:example}` | `\begin{example}` |
| `{prf:remark}` | `\begin{remark}` |
| `{prf:axiom}` | `\begin{axiom}` |
| `{prf:conjecture}` | `\begin{conjecture}` |
| `{prf:observation}` | `\begin{observation}` |
| `{prf:proof}` | `\begin{proof}` |

The template fixes MyST's default section-based numbering (Theorem 1.1) to use global counters (Theorem 1) as required by QE.

MyST's proof directives lack `claim` and `fact`. With the plugin, its `claim-fact`
repair adds `{prf:claim}` (numbered) and `{prf:fact}` (unnumbered) to both outputs,
as the sample shows.

See [MyST Proofs & Theorems](https://mystmd.org/guide/proofs-and-theorems) for details.

#### Appendices

The body form below works with or without the plugin; a frontmatter part needs it.
For the body form, open and close the appendix in the document **body** and splice
the file in with `include`:

```markdown
Last paragraph of the main text.

:::{raw:latex}
\begin{appendix}
:::

:::{include} appendix.md
:::

:::{raw:latex}
\end{appendix}
:::
```

Use the **colon** form `:::{raw:latex}` here, not the fenced `` ```{raw} latex ``
form. MyST parses the fenced form with tex-to-myst, which cannot convert a bare
`\begin`/`\end` pair: it logged `Unhandled TEX conversion for node of "macro_begin"`
on every build and rendered the environment *name* as an orphan paragraph on the
website. The colon form is passed through untouched. Measured in the built site
before and after the switch: elements whose text is exactly `appendix` went from 3
to 1 (the appendix's own heading), every `"macro_begin"` and `"macro_end"`
conversion message disappeared, and all six PDFs stayed textually identical. The
rule generalises: **fenced for content the website should show** (tables, figures,
pseudocode), **colon for macros that only steer LaTeX** (environment delimiters,
counter redefinitions).

`appendix.md` is then ordinary MyST, with headings at `#` level. It needs no
`numbering` block of its own, because the article's `numbering` governs the
spliced content; per-level keys in its frontmatter leave the emitted `.tex`
identical.

```markdown
---
title: Appendix
---

(appA)=

# Title of first appendix

Content here...
```

Three details, each of which produces a silent failure if you get it wrong.

An appendix part needs the plugin. With the plugin listed, write the part in the page
frontmatter, as a file or inline as a YAML block scalar:

```yaml
parts:
  appendix: appendix.md
```

The template sets the part inside `\begin{appendix}` after the main text. Released
mystmd mishandles a part twice, each at exit 0. It leaves the part's citations out of
the emitted `.bib`, because harvesting walks the *rendered* document and MyST
[excludes frontmatter parts from it](https://mystmd.org/guide/document-parts)
("Content within these parts is not rendered in the document"). Neither pointing the
part at a file that `include`s the content, nor listing the appendix in the project
`toc`, nor writing the part inline changes that. It also demotes the part's headings
one level ([#2351](https://github.com/jupyter-book/mystmd/issues/2351)), so `# Title`
prints `.1 Title` with no letter. The plugin's `part-citations` and `part-headings`
repairs fix both ([Plugin repairs](plugin-repairs.md#citations),
[Plugin repairs](plugin-repairs.md#floats-macros-and-parts)).
Without the plugin, use the body form.

Headings in the included file must be `#`, not `##`. Included content is one level below the surrounding sections, and a demoted heading does not pick up the class's appendix prefix. The PDF then prints `.1 Title` instead of `APPENDIX A: TITLE`.

Use the `{appendix}` environment, not a bare `\appendix`. The bare switch applies globally and leaks into what follows, rendering the bibliography heading as `APPENDIX : REFERENCES`. `\begin{appendix}...\end{appendix}` scopes the change through LaTeX's own environment group, so the heading stays `REFERENCES`. This matches the upstream `econsocart` samples.

With the plugin, `[](#appA)` prints "Appendix~\ref{appA}" in either form (its `xref`
repair). Without it, cross-reference appendices with raw LaTeX. MyST's LaTeX renderer labels every section-type target "Section" and **discards the link text**, so `@appA`, `[Appendix A](#appA)`, `[Appendix {number}](#appA)`, and `[Appendix %s](#appA)` all render "Section A". Write `` {raw:latex}`Appendix~\ref{appA}` `` instead, which renders "Appendix A" and nests correctly as "Appendix B.1". See [Cross-References](#cross-references) below.

#### Equations

- Inline math: `$...$`
- Display math: `` ```math `` blocks with optional `:label:` for numbered equations
- Multi-line equations with a single number: use `\begin{aligned}` inside a `{math}` block with `:label:`
- Equation arrays: use `\begin{align}` inside a `` ```math `` block
- Reference equations with `` {eq}`label` ``

#### Cross-References

- `@th1` renders as "Theorem 1" (`Theorem~\ref{th1}`) and `@de1` as "Definition 1", as do the other proof kinds.
- `` {numref}`my-table` `` renders as "Table 1", and `` {numref}`my-fig` `` as "Figure 1".
- `` {eq}`label` `` renders as "(1)".
- `@s1` renders "Section 1" in the PDF. With the plugin, `headings: true` under `numbering` in the document's own frontmatter is enough, and the site prints "Section 1" too. Without the plugin the document also needs `title: true`, or the reference renders the section title instead, which is a frontmatter configuration error rather than the [MyST limitation](https://github.com/executablebooks/mystmd/issues/1924) it is often mistaken for. `title: true` numbers the page title "1" on the site, which then numbers the Introduction 1.1 and prints the reference as "Section 1.1".
- Labels are project-wide. A supplement built in the same project as its article needs labels of its own (the sample's supplement prefixes them `supp-`). When the two share a label, MyST warns "Duplicate identifier" and every reference to it on the supplement's site page links to the article's target; the PDFs, each its own document, are unaffected.
- A numbered link to a section prints `??` when the numbering keys are set at project level in `myst.yml` rather than in the document's own frontmatter: `[Sec %s](#sec-one)` emits `Sec~??` and the PDF prints `Sec ??`, at exit 0 with nothing in the log. Plain `[](#sec-one)` and `@sec-one` still work, which makes it easy to miss. Cause and fix in [jupyter-book/mystmd#3035](https://github.com/jupyter-book/mystmd/pull/3035): a single-article export sets the article level to 0, so the numbering lookup needs a `heading_0` key that cannot be enabled. The plugin's `xref` repair fixes it ([Plugin repairs](plugin-repairs.md#references-and-labels)). Without the plugin, set `title: true` and `headings: true` in the document's frontmatter or write the reference as raw LaTeX. `scripts/build-samples.sh` fails the build on any `??` in a rendered PDF.
- A reference to an appendix section prints "Section A" without the plugin; see [Appendices](#appendices) and [`sample/appendix.md`](../sample/appendix.md). Equation, theorem, table, and figure references into the appendix (`{eq}`, `@th1`, `` {numref}` ``) render correctly either way.
- With the plugin, a reference between the article and its supplement resolves when both are pages of one project (`toc:` in `myst.yml`): `[Supplemental Material %s](#s-label)` prints "Supplemental Material S1.1" as plain text, because econsocart bans the `xr` package ([Plugin repairs](plugin-repairs.md#references-and-labels)). Without the plugin, type the number.
- With the plugin, a link with a missing label, or with a target LaTeX does not number, prints `??label` and adds a warning to the build log. A `(label)=` line on an ordered-list item makes `[Item %s](#label)` print the item's number ([Plugin repairs](plugin-repairs.md#references-and-labels)).

See [MyST Cross-references Guide](https://mystmd.org/guide/cross-references) for complete details.

### Where We Use Raw LaTeX

#### Complex Tables

Tables with custom column specifications, `\hline`, `\cline`, `\legend{}`, and precise alignment require raw LaTeX `{raw} latex` blocks. MyST's table syntax cannot reproduce these layouts.

#### Algorithm packages

The template bundles `algpseudocode` but deliberately **does not** load the `algorithm` float package (`\usepackage{algorithm}`), because it collides with the numbered `algorithm` theorem environment the template defines ([template internals](template-internals.md#theorem-counters) says why it is a theorem). Write algorithms as a `{prf:algorithm}` directive, optionally nesting a `{raw} latex` block of `algorithmic` pseudocode inside it; the block reaches the PDF only with the plugin (see [Theorem-like Environments](#theorem-like-environments)). See [Algorithms](#algorithms) below for the two forms and how each renders.

Do **not** write a raw `\begin{algorithm}...\caption{}` float. Without the float package that fails with `Package caption Error: \caption outside float`, the caption is silently dropped, and `myst build` still exits 0 with a PDF.

### MyST Limitations and Fidelity to the QE and ECMA Template

Authoring in Markdown means the generated LaTeX is not byte-identical to a hand-written QE `.tex`. The first table below lists differences where the rendered **PDF is still equivalent** to the original; the second lists **real limitations** where it is not. Each records the workaround where one exists.

#### Irreducible rendering differences (same PDF, different source)

| Feature | Hand-written QE | MyST output |
| --- | --- | --- |
| Preamble | you write `\usepackage` lines | injected automatically (see [LaTeX Packages](#latex-packages)) |
| Inline code | `` \verb|\cmd| `` | `\texttt{{\textbackslash}cmd}` |
| Equation arrays | `eqnarray` | `align` (the non-deprecated equivalent) |
| Long quotation | `\begin{quotation}` | `\begin{quote}`; with the plugin's `quotations` repair, `quotation` for a quote of several paragraphs |
| Emphasis | `\emph{}` | `\textit{}`, which template.tex makes act as `\emph` inside an italic theorem |
| Figures | `\includegraphics{figure_sample}` | `files/figure_sample-<hash>.pdf` (assets copied and content-hashed) |
| Paragraph headings | `\paragraph*{Heading}` | `\textbf{Heading}`, which runs in identically |
| Bibliography | a hand-maintained `thebibliography` with 10 `\bibitem`s | `\bibliographystyle` + `\bibliography`, so BibTeX builds it from `references.bib` using the journal's own `.bst` |
| Whitespace | hand-formatted | normalized |

Checked by diffing the generated LaTeX against `original/qe/qe_sample.tex`: all
ten body sections match in order and title, both files carry three floats, and
the appendix headings render identically ("APPENDIX A: TITLE OF THE FIRST
APPENDIX").

No line-level similarity figure is given. An earlier one was removed because no
script recorded the normalization that produced it, an audit that grid-searched
two dozen plausible normalizations reproduced none of them, and the sample has
since grown. Re-derive one with a committed script if it is wanted.

Content is **not** fully preserved. The differences beyond the substitutions in
these two tables are: the upstream single-appendix example (`\section*{Title}`
plus its accompanying note) is left out; four sentences from
upstream's Citation section are absent, covering `\citeauthor`, `\citeyear`, and
a bracketed-locator `\citet[Theorem 1]{}`; and the Fonts list differs in content,
upstream showing a truly small-capped example where this sample shows roman.

#### Real limitations (a QE feature MyST cannot reproduce in the PDF)

| Feature | Limitation | Workaround |
| --- | --- | --- |
| Appendix cross-references | `@appA` renders "Section A" rather than "Appendix A". The letter resolves correctly; only the label word is wrong. MyST's LaTeX renderer **discards link text entirely** for section-type targets, so `[Appendix A](#appA)` also renders "Section A", as do `{number}`, `{name}`, and `%s` placeholders | the plugin's `xref` repair ([Plugin repairs](plugin-repairs.md#references-and-labels)). Without it, use raw LaTeX where the word matters: `` {raw:latex}`Appendix~\ref{appA}` `` renders "Appendix A" (see [Appendices](#appendices)). It does not appear in HTML output, so use it only in PDF-targeted prose |
| Reference titles and `@incollection` entries | MyST re-serializes your `.bib` into `main.bib`. It braces every capitalized title word, which keeps titles in Title Case where the journal styles set sentence case. It also re-types `@incollection` as `@inbook`, and a chapter then prints as a monograph without its book and editors | the plugin's `authored-bib` repair, which hands BibTeX your own entries ([Plugin repairs](plugin-repairs.md#citations)). Without it, write titles in sentence case with braces only on proper nouns, and put the volume and editors in a `note` field, which survives the re-typing (see `b4` in [`sample/references.bib`](../sample/references.bib)) |
| Author-only / year-only citations, and citation prefixes/suffixes | Every MyST citation form collapses to `\citet`, `\citep`, or `\cite`. `{cite:author}` and `{cite:year}` are not distinguished, and prefix/suffix text is **silently dropped**: `[e.g. @b1, pg. 22]` and `` {cite:p}`{see}b1{fig 1}` `` emit a bare `\citep{b1}`, while `@b1 [pg. 22]` emits `\cite{b1}`, which natbib renders *textually* as "Aumann (1987)" rather than parenthetically | the plugin's `citation-forms` repair ([Plugin repairs](plugin-repairs.md#citations)). Without it, raw LaTeX gives all of them back: `` {raw:latex}`\citeauthor{b1}` `` renders "Aumann", `` {raw:latex}`\citeyear{b1}` `` renders "1987", and `` {raw:latex}`\citep[e.g.][pg. 22]{b1}` `` renders "(e.g. Aumann, 1987, pg. 22)". **Without the plugin, the key must also be cited once through a normal MyST role somewhere in the document**, because MyST only writes keys it parses into the generated `main.bib`, and a raw-only key renders as `?`; the plugin's `authored-bib` resolves it from your `.bib` |
| `claim` / `fact` results | see [Proof directives](#proof-directives) below | the plugin's `claim-fact` repair. Without it, `{prf:proposition}` / `{prf:observation}`, or a `{raw} latex` `\begin{claim}` block (the environments are defined) |
| Small caps / sans serif in text | no Markdown syntax. `\textsc{X}` written bare in Markdown is **escaped to literal text** (`{\textbackslash}textsc\{X\}`), and the `` {sc}`X` `` role **silently drops its content** in the PDF, logging `Unhandled LaTeX conversion for node of "smallcaps"` while still exiting 0, though both look like they work | `` {sc}`X` `` with the plugin's `smallcaps` repair, and `` {sf}`X` `` with its `text-roles` repair ([Plugin repairs](plugin-repairs.md#running-text)). Without the plugin, `` {raw:latex}`\textsf{X}` `` and `` {raw:latex}`\textsc{X}` ``; `` {sc}`X` `` then renders correctly only in HTML |
| LaTeX logo macros in prose | Markdown has no `\LaTeXe` / `\TeX`, so writing them as text renders "LaTeX2e" where the hand-written sample renders the proper logo | `` {logo}`LaTeX2e` `` (also `LaTeX`, `TeX`) with the plugin's `text-roles` repair; without it, `` {raw:latex}`\LaTeXe` `` |
| Footnotes inside a figure or table caption, or a table cell | **silently dropped from the PDF** while rendering normally on the website. A footnote referenced twice prints its text twice. Body footnotes are otherwise unaffected | the plugin's `footnotes` repair ([Plugin repairs](plugin-repairs.md#running-text)). Without it, put the note in the body text, or fold it into the caption itself |
| `{prf:criterion}`, `{prf:property}` | body text **dropped from the PDF**, rendered normally in HTML; both log "Unhandled LaTeX proof environment" | the plugin's `proofs` repair. Without it, use one of the 13 supported kinds, or a `{raw} latex` block |
| `{prf:claim}`, `{prf:fact}`, `{prf:exercise}`, `{prf:solution}` | **not MyST proof kinds at all.** HTML shows an "Unknown Directive" error box with the raw source below it; the PDF gets nothing, and **no log line is emitted**, so watching the build log will not save you | `{prf:claim}` and `{prf:fact}` with the plugin's `claim-fact` repair. For exercises, MyST's own `{exercise}` and `{solution}`, which reach the PDF with the plugin's `exercises` repair. Without the plugin, use `{prf:proposition}`, `{prf:example}`, or `{prf:remark}` |
| Other LaTeX exports | more constructs written wrongly at exit 0, from a link inside a raw LaTeX block printed verbatim to the paragraph after a theorem running on unindented | the plugin; [Plugin repairs](plugin-repairs.md#repairs) lists every repair |

#### Proof directives

MyST's LaTeX renderer maps most `{prf:...}` kinds to environments, and this template defines the ones econsocart does not: `theorem, proof, proposition, definition, example, remark, axiom, conjecture, lemma, observation, corollary, assumption, algorithm, criterion, property, claim, fact`, plus `exercise` and `solution` for MyST's `{exercise}` and `{solution}` directives.

Without the plugin, two kinds it recognizes but cannot serialize (`{prf:criterion}` and `{prf:property}`) log "Unhandled LaTeX proof environment" and are **silently dropped from the PDF** while still rendering in HTML. MyST exits 0, so watch the build log for those two. The plugin's `proofs` repair writes them.

`{prf:claim}`, `{prf:fact}`, `{prf:exercise}`, and `{prf:solution}` are a different failure: they are not MyST proof kinds, so HTML renders an "Unknown Directive" error box and the PDF gets nothing, with **no log line at all**. The plugin's `claim-fact` repair makes `{prf:claim}` and `{prf:fact}` proof kinds on both outputs. For exercises, use MyST's `{exercise}` and `{solution}`, which stock mystmd drops from the PDF and the plugin's `exercises` repair writes ([Plugin repairs](plugin-repairs.md#proofs-and-exercises)). Without the plugin, watching the log does not catch these; read the output. Use a supported kind, or write the environment in a `{raw} latex` block.

#### Algorithms

`{prf:algorithm}` is the right directive. With the plugin it numbers as "Algorithm N" in both the PDF and the website, and cross-references resolve (`@alg1` renders "Algorithm 1"). Without the plugin the PDF drops the block unless you use the `{prf:observation}` workaround in [Theorem-like Environments](#theorem-like-environments).

For the steps, choose by deliverable:

| Steps written as | PDF | HTML |
| --- | --- | --- |
| an ordinary Markdown numbered list | numbered list, nested correctly | numbered list |
| a nested ```` ```{raw} latex ```` block using `algorithmic` | pseudocode with a line-number gutter and `for ... do` keywords | numbered lines with the loop structure intact: `\For` renders as a bold `for`, `\EndFor` as a bold `end for`. The only loss is the `\Return` **keyword**, whose argument text still renders |

The table was measured against a real `myst build --html`, where the nested
`algorithmic` body renders as numbered lines inside the Algorithm box. The two
forms, the same method written twice:

`````markdown
:::{prf:algorithm}
:label: alg1
Endogenous grid method.

1. Initialize the exogenous grid.
2. For $t = T-1$ down to $0$:
   1. Invert the Euler equation.
   2. Recover the endogenous grid.
3. Return the policy function.
:::

:::{prf:algorithm}
:label: alg2
The same method as @alg1, typeset as pseudocode.

```{raw} latex
\begin{algorithmic}[1]
\State initialize the exogenous grid
\For{$t = T-1$ down to $0$}
  \State invert the Euler equation
  \State recover the endogenous grid
\EndFor
\State \Return the policy function
\end{algorithmic}
```
:::
`````

To test whether a construct survives to HTML, diff the visible markup with and
without it.

Either form works on both outputs. Prefer the Markdown list when you want
the steps to be selectable, searchable text on the website; prefer the nested
`algorithmic` block when the PDF's line-number gutter and keyword typography
matter. Avoid `\Return` if the returned value must be labelled on the web, or
write the word into the step text.

Use `algpseudocode` syntax (`\State`, `\For`, `\EndFor`), not the older all-caps `\STATE`/`\FOR`, which run the steps together into a paragraph. Raw `\begin{algorithm}...\caption{}` float syntax does not compile here (see [Algorithm packages](#algorithm-packages)).

#### Writing LaTeX inside Markdown

The table measures where each construct called "raw LaTeX" arrives: the PDF from the
`.tex` export, the HTML from a real `myst build --html`, reading the visible markup
rather than the AST.

| What you write | Reaches PDF | Reaches HTML |
| --- | --- | --- |
| A **math** environment bare in Markdown (`align`, `gather`, `multline`, the `matrix` family) | yes, as math | yes, as math |
| Any **non-math** environment bare in Markdown (`tabular`, `tabularx`, `longtable`, `algorithm`, `figure`, ...) | **no**, escaped to literal text | no |
| An **inline macro** bare in Markdown (`\textsc{}`, `\citeauthor{}`, `\ref{}`, `\LaTeXe`) | **no**, escaped to literal text | no |
| A ```` ```{raw} latex ```` **block** | yes, verbatim | **yes**, MyST parses and renders it |
| A `` {raw:latex}`...` `` inline **role** | yes, verbatim | **no**, dropped |

On the web a raw *block* is parsed, so what renders may be incomplete (see
[Algorithms](#algorithms) for a case where the `\Return` keyword disappears while
its argument survives).

Declaring a package in `template.yml` does **not** make a bare environment pass
through: it makes raw-block content that uses the package *compile* once it is
passed through.

MyST's own [Writing in LaTeX](https://mystmd.org/guide/writing-in-latex) guide
lists a much longer set of environments it understands. The guide's list covers MyST
parsing a `.tex` **source document**; this table covers environments embedded in
a `.md` file.

#### LaTeX packages

Three groups of packages are available in every build:

1. Auto-injected by MyST when its own content needs them (never declared): `pdflscape, longtable, amsmath, amsthm, imakeidx, listings, minted, graphicx, natbib, siunitx, glossaries, xcolor`.
2. Provided by the class and template: `amssymb, bm, etoolbox, fontenc, textcomp, times, url` (class) and `hyperref` (template). These are declared in `packages:`, so MyST does not re-inject them.
3. Loaded by the template (packages MyST recognizes but does not auto-inject, so raw-LaTeX content that uses them compiles): `booktabs, array, algpseudocode, subcaption, multirow, tabularx, wrapfig, threeparttable, adjustbox, changepage, mhchem, cancel, supertabular, epigraph, framed, ulem, cleveref`. `algorithm` is **not** among them, by design: see [Algorithms](#algorithms).

`booktabs` is in group 3 rather than group 1 because MyST injects it only for tables **it** emits. A document whose tables are raw LaTeX never triggers that, so `\toprule` was an undefined control sequence and the PDF rendered the table with every rule missing, at exit 0. Loading it unconditionally covers both cases. `array` is there for `>{...}` column specifications, which `tabularx` happens to pull in today; the explicit load removes the dependence on that. Note that mystmd's [supported macros](https://mystmd.org/guide/writing-in-latex) do not include the booktabs rules, so they pass through to the PDF and the website ignores them.

Because group 3 is loaded unconditionally, **your TeX installation must contain these packages**. A full TeX Live has them; on a minimal install add them with `tlmgr install <name>`.

Three packages are deliberately **excluded** because they conflict with the class or bibliography: `soul` (its `\caps` clashes with the class), `csquotes` (its `\enquote` clashes with `qe.bst`), and `algorithm2e` (its `\algorithm` clashes with `algorithm`). The template loads `ulem` for strikethrough, so `soul` is not needed.

`framed` and `ulem` moved from group 1 to group 3 for the plugin. MyST requests a
package only for content it renders itself, so a box or strikeout inside LaTeX the
plugin writes whole needs the package loaded already. `ulem` loads with `normalem`, because the bare `\usepackage{ulem}`
MyST injects for `{del}` turns every `\emph` into an underline.

For any package **beyond** these groups (e.g. `tikz`, `pgfplots`), use the `extra_packages` export option:

```yaml
exports:
  - format: tex+pdf
    template: https://github.com/alanlujan91/econsoc_template.git
    output: paper.pdf
    extra_packages: tikz,pgfplots
```
