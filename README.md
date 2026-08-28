# Econometric Society Journals MyST Template

MyST Markdown template for Econometric Society journal submissions: Econometrica, Quantitative Economics, and Theoretical Economics.

> **Unofficial.** This is an independent, community-maintained MyST template. It
> is not produced, endorsed, or supported by The Econometric Society, by VTeX, or
> by any of the three journals. The official LaTeX templates are the ones linked
> below; this project packages them for MyST Markdown authoring. Bugs here are
> not their responsibility, and acceptance of a submission produced with this
> template is at each journal's discretion. Always check the output against the
> journal's own current requirements before submitting.

![Template Thumbnail](thumbnail.png)

- **Template**: [github.com/alanlujan91/econsoc_template](https://github.com/alanlujan91/econsoc_template)
- **Author**: Alan Lujan
- **Based on**: the official Econometric Society LaTeX templates, tracked as submodules under `original/`
  - [Econometrica](https://github.com/vtex-soft/texsupport.econometricsociety-ecta) (`original/ecta`)
  - [Quantitative Economics](https://github.com/vtex-soft/texsupport.econometricsociety-qe) (`original/qe`)
  - [Theoretical Economics](https://github.com/vtex-soft/texsupport.econometricsociety-te) (`original/te`)
- **Journals**: [Econometrica](https://www.econometricsociety.org/publications/econometrica), [Quantitative Economics](https://qeconomics.org/), [Theoretical Economics](https://econtheory.org/)

## Features

- **All three Econometric Society journals**: one template targets Quantitative Economics, Econometrica, and Theoretical Economics via the `journal` option, with an independent `preprint` switch that strips journal identification without changing the layout
- **Official `econsocart` class**: all required style files, faithful journal layout
- **MyST Markdown authoring**: write in Markdown, compile to LaTeX/PDF
- **Author management**: multiple authors and affiliations with proper formatting
- **Document parts**: abstract and acknowledgements/funding as frontmatter parts (appendices go in the body, see [Appendices](#appendices))
- **Bibliography**: BibTeX integration, with the style selected to match the target journal (`econsoc.bst` for Econometrica, `qe.bst` for Quantitative Economics, `te.bst` for Theoretical Economics)
- **Supplement support**: supplementary material via `supplement` option
- **Broad LaTeX support**: bundles the packages MyST recognizes but does not auto-inject (algorithms, subfigures, table helpers, ...), plus an `extra_packages` option for anything else
- **Template options**: draft mode, section-based equation numbering, open access

## Quick Start

### 1. Install MyST

```bash
npm install -g mystmd
# or
uv tool install mystmd
```

### 2. Create Your Document

Create a Markdown file with proper frontmatter:

```yaml
---
title: Your Paper Title
short_title: Running Head Title
date: 2025-01-15
license: CC-BY-4.0
open_access: true
exports:
  - format: tex+pdf
    template: https://github.com/alanlujan91/econsoc_template.git
    output: paper.pdf
authors:
  - name:
      given: First
      surname: Author
    email: first@author.edu
    affiliations: ["aff1"]
  - name:
      given: Second
      surname: Author
    email: second@author.edu
    affiliations: ["aff2"]
affiliations:
  - id: aff1
    department: Department of Economics
    institution: First University
  - id: aff2
    department: Business School
    institution: Second University
keywords:
  - keyword 1
  - keyword 2
  - keyword 3
tags:
  - C00
  - D00
bibliography: references.bib
venue:
  title: Quantitative Economics
  url: https://qeconomics.org/
parts:
  abstract: |
    Your abstract here (max 150 words recommended).
    Should be clear, descriptive, and self-explanatory.
  acknowledgement: |
    We thank reviewers and acknowledge funding sources.
    Do not thank the editor by name.
---

# Introduction

Your content here...
```

This example sets no options, so it builds a neutral **preprint** in the default Quantitative Economics layout: no "Submitted to ..." banner. Set `journal: ecta` (or `te`) to typeset for another journal, and `preprint: false` when you actually submit. See [Which mode for which stage](#which-mode-for-which-stage).

> **The `.git` suffix on the template URL is required.** MyST downloads a
> template URL directly only when it ends in `.git` or `.zip`; anything else is
> sent to a registry API, so a plain `https://github.com/alanlujan91/econsoc_template`
> fails with `<!DOCTYPE "... is not valid JSON`. Use the `.git` form above, a
> commit-pinned archive
> (`https://github.com/alanlujan91/econsoc_template/archive/<sha>.zip`), or a local
> path such as `../econsoc_template`.

### 3. Build PDF

```bash
myst build paper.md --pdf
```

### 4. See Complete Examples

- Main article: [`sample/article.md`](sample/article.md)
- Supplementary material: [`sample/supplement.md`](sample/supplement.md)

## Template Options

Configure via `exports` in frontmatter:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `journal` | choice | `qe` | Which journal to typeset for: `qe`/`ecta`/`te`. Sets the class option, layout, running head and bibliography style. See [Which mode for which stage](#which-mode-for-which-stage). |
| `preprint` | boolean | `true` | Strip journal identification (no "Submitted to ..." banner, running head, copyright line, or co-editor line) while keeping the journal layout and style. The co-editor line is suppressed because the class emits a placeholder reading "Co-editor [Name Surname; will be inserted later] handled this manuscript", which asserts journal handling on a publicly posted working paper. Set `false` when you submit. |
| `draft` | boolean | `false` | Draft mode for initial submission |
| `supplement` | boolean | `false` | Supplementary material document |
| `seceqn` | boolean | `false` | Number equations by section (e.g., Equation 2.1) |
| `linenumbers` | boolean | `false` | Adds line numbers to a non-draft build. `draft` turns them on regardless, so the option only has an observable effect when `draft` is false. It cannot switch them *off* inside a draft: the class has a `nolinenumbers` option that this template never emits. |
| `extra_packages` | string | (none) | Comma-separated LaTeX packages to load, e.g. `mhchem,cancel` (see [LaTeX Packages](#latex-packages)) |

The `open_access` frontmatter field automatically enables the econsocart `openaccess` class option.

#### Which mode for which stage

The three journals want different things at different points, and this template
produces all of them. Getting the stage wrong is the most likely way to send a
PDF that does not match what the journal asked for.

`journal` says which journal to typeset for; `preprint` and `draft` are
independent switches on top of it. Keep `journal` set to your actual target at
every stage, so the layout and bibliography style are always the right ones.

| Stage | Options | Produces |
| --- | --- | --- |
| Working paper / preprint posting | `journal: <target>`, `preprint: true` (default) | the journal's layout with no journal identification |
| **Initial submission** | `journal: <target>`, `preprint: false`, `draft: true` | proof layout: US Letter, line numbers, increased line spacing, "Submitted to ..." banner |
| Camera-ready, after acceptance | `journal: <target>`, `preprint: false` | the typeset journal layout |

`preprint` is deliberately *not* a value of `journal`. It once was, and that
forced the Quantitative Economics layout on every neutral build, so a
Theoretical Economics preprint was silently typeset as Quantitative Economics
and used `qe.bst`. As a switch it strips the identification and leaves the
journal alone.

#### Econometrica house style

Setting `journal: ecta` gets you Econometrica's layout, class option and
bibliography style. The `econsocart` class itself enforces none of Econometrica's
house style: there is no case-forcing or keyword-suppressing logic in the class
for the author to inherit. This template supplies one piece of it, and leaves the
rest to you. Comparing Econometrica's own sample against the Quantitative
Economics and Theoretical Economics ones:

| | Econometrica | Quantitative Economics / Theoretical Economics |
| --- | --- | --- |
| Title, running head, and every section and subsection heading | Title Case: "Section Headings", "Equations and the Like" | sentence case: "Section headings" |
| JEL codes | none; neither `ecta_sample.tex` nor `ecta_template.tex` carries a JEL block. **Handled by the template**: suppressed automatically under `journal: ecta` | up to 3, in alphabetical order |
| Keyword guidance | 3-8 keywords | 3-8 keywords and up to 3 JEL codes |

**The JEL block is handled for you.** Under `journal: ecta` the template suppresses
it even when the document supplies `tags`, because both `ecta_sample.tex` and
`ecta_template.tex` carry no JEL block while the qe and te equivalents each carry
one. Keep your `tags:` in frontmatter: they still emit for the qe and te exports of
the same source, which is what makes one document retarget across all three
journals without hand-editing. The suppression leaves a comment in the emitted
`.tex` recording that codes were withheld, so it is auditable rather than silent.

**Title Case is still yours to apply.** Write Econometrica headings in Title Case
in your own prose; nothing in the template or the class does it for you.

Two Econometrica conventions the template *does* handle for you, because they
come from `econsoc.bst` rather than from the author:

- Papers with five or more authors cite as the initials of the first four
  followed by a plus sign. Econometrica renders `[HNPS+]` where the other two
  render "Hortacsu et al." This needs the `\xcitelabel` support added in
  `econsocart.cfg` v1.0.7, which is why the vendored config tracks the newest
  release rather than a pinned one.
- An approved supplement is referenced at the end of the introduction and cited
  like any other work; refer to material inside it in plain text rather than
  with a cross-reference, since it is a separate document.

Both are demonstrated in [`sample/article.md`](sample/article.md).

All three journals state their own requirements for the **submitted** PDF, and
all three treat their LaTeX class as optional at that stage:

| | Econometrica | Quantitative Economics | Theoretical Economics |
| --- | --- | --- | --- |
| Format | PDF | PDF only | PDF |
| Font | at least 12pt | at least 12pt | at least 12pt |
| Spacing | at least 1.5 | 1.5 or double | at least 1.5, at most 32 lines per page |
| Page size | - | - | US Letter, margins at least 1.25in |
| Length | 45pp including references and appendices; supplement at most 25pp | - | brevity weighed during review |
| Class required? | recommended, not required | - | not mandatory at submission |

The `draft` option is what targets that stage: the class configuration switches
to a proof layout (`\proof@papersize`, increased `\baselinestretch`, line
numbers) rather than the typeset one. Econometrica additionally notes that the
submitted manuscript need not follow its style specifications at all, since the
copyeditor and typesetter apply them; and it asks for complete source files
(LaTeX preferred, figures as `.eps` or `.jpg`) only *after* acceptance.

Check the current requirements yourself before submitting: they change, and
this table is a convenience, not an authority.

- [Econometrica](https://www.econometricsociety.org/publications/econometrica/information-authors/instructions-submitting-articles)
- [Quantitative Economics](https://www.econometricsociety.org/publications/quantitative-economics/submissions/instructions-for-submitting-articles)
- [Theoretical Economics](https://www.econometricsociety.org/publications/theoretical-economics/submission-guidelines)

> **Numbered cross-references need the right `numbering` keys, and where you put
> them matters.** Set `numbering: {title: true, headings: true}`: in the
> document frontmatter for a standalone paper, as the samples do, or once under
> `project:` in `myst.yml` if you have a MyST project, in which case every
> document inherits it. Both keys are required; either may come from either
> place, and they merge.
>
> The trap is the older per-level keys: **`heading_1: true` and friends are
> honoured only at project scope. In document frontmatter they are ignored.** So
> `numbering: {title: true, heading_1: true}` in frontmatter still numbers the
> headings while `@s1` renders the heading *title*: "the Introduction should be
> Introduction" where a hand-written manuscript reads "should be Section 1". In a
> submitted PDF that reads as an error rather than a formatting nicety, and it is
> easy to miss precisely because the headings themselves look correctly numbered.
> `headings: true` works at both scopes, so prefer it everywhere.

#### Preprint mode

By default (`preprint: true`) the PDF carries **no journal identification**: no "Submitted to ..." banner, no journal running head, and no copyright line. It is safe to post as a working paper without signalling where it was submitted, and it keeps the layout and bibliography style of whichever `journal` you set, so a Theoretical Economics preprint looks like Theoretical Economics.

When you submit, turn it off:

```yaml
exports:
  - format: tex+pdf
    template: https://github.com/alanlujan91/econsoc_template.git
    output: paper.pdf
    journal: ecta
    preprint: false   # renders "Submitted to Econometrica"
    draft: true       # proof layout for the submission stage
```

Draft mode adds line numbers in both margins, switches to the proof paper size and line spacing, and shows the "Submitted to ..." banner unless `preprint` is left on.

**Note**: Use `acknowledgement` (singular) in frontmatter, not `acknowledgements`.

## MyST Implementation Details

### Approach

This template uses MyST native features wherever possible and falls back to raw LaTeX for complex tables and algorithms that exceed MyST's native capabilities.

### MyST Native Features

#### Typography

- **Emphasis**: `*italic*` and `**bold**` instead of `\textit{}` and `\textbf{}`
- **Math**: Standard MyST math with `$...$` and `` ```math `` blocks
- **Inline code**: backticks, rendered as `\texttt{...}` (not `\verb`)
- **Headings**: Markdown `#`, `##`, `###` for sections
- **Note**: Other text styles (small caps, sans serif) require inline LaTeX: `\textsc{}`, `\textsf{}`

#### Citations

- `` {cite:t}`ref` `` for textual citations (e.g., "Smith (2020)") renders as `\citet{}`
- `` {cite:p}`ref` `` for parenthetical citations (e.g., "(Smith 2020)") renders as `\citep{}`
- MyST recognizes other roles too (`{cite:author}`, `{cite:year}`, ...), but its LaTeX renderer collapses them all to `\citet`/`\citep`. The QE sample's author-only (`\citeauthor`) and year-only (`\citeyear`) cites therefore cannot be reproduced in the PDF; see [Limitations and Fidelity](#myst-limitations-and-fidelity-to-the-qeecma-template). See also the [MyST Citations Guide](https://mystmd.org/guide/citations).

#### Lists

- Itemized lists: Markdown `-` syntax
- Numbered lists: Markdown `1.`, `2.`, etc.

#### Footnotes

- Markdown footnote syntax: `[^1]` with `[^1]: Footnote text.` at the bottom

#### Quotations

- Markdown blockquote syntax with `>` prefix
- MyST converts to `\begin{quote}` in LaTeX
- See [MyST Typography Guide](https://mystmd.org/guide/typography#quotations)

#### Theorem-like Environments

MyST proof directives that produce correct LaTeX output:

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

**Note**: `claim` and `fact` are not supported by MyST's proof directives. The sample uses `{prf:proposition}` and `{prf:observation}` as substitutes.

See [MyST Proofs & Theorems](https://mystmd.org/guide/proofs-and-theorems) for details.

#### Appendices

Open and close the appendix in the document **body**, and splice the file in with `include`:

````markdown
Last paragraph of the main text.

```{raw} latex
\begin{appendix}
```

:::{include} appendix.md
:::

```{raw} latex
\end{appendix}
```
````

`appendix.md` is then ordinary MyST, with headings at `#` level:

```markdown
---
title: Appendix
numbering:
  heading_1: true
  heading_2: true
---

(appA)=

# Title of first appendix

Content here...
```

Three details, each of which produces a silent failure if you get it wrong.

**Do not use `parts: appendix:`. Against this template your entire appendix disappears, silently.** The template has no `parts.appendix` branch, and MyST discards a frontmatter part that the template does not reference: it logs `Built <doc>#parts.appendix`, then the content reaches neither the `.tex` nor the PDF, with no warning, no BibTeX complaint, and exit 0. Do not go looking for a missing bibliography entry as the symptom, because there is none.

The reason the branch was removed rather than kept is the underlying MyST behavior. Harvesting walks the *rendered* document, and MyST [excludes frontmatter parts from it](https://mystmd.org/guide/document-parts) ("Content within these parts is not rendered in the document"), so a reference cited only in a part is written into the `.tex` and omitted from the emitted `.bib`, leaving an undefined citation. Neither pointing the part at a file that `include`s the content, nor listing the appendix in the project `toc`, nor writing the part as an inline YAML scalar changes that; only content reachable from the document body is harvested. Keeping a branch that produced wrong bibliographies was not better than removing one that produces an obvious empty space.

**Headings in the included file must be `#`, not `##`.** Included content sits one level below the surrounding sections, and a demoted heading does not pick up the class's appendix prefix. The PDF then prints `.1 Title` instead of `APPENDIX A: TITLE`.

**Use the `{appendix}` environment, not a bare `\appendix`.** The bare switch applies globally and leaks into what follows, rendering the bibliography heading as `APPENDIX : REFERENCES`. `\begin{appendix}...\end{appendix}` scopes the change through LaTeX's own environment group, so the heading stays `REFERENCES`. This matches the upstream `econsocart` samples.

**The raw blocks are not invisible in HTML.** MyST parses each block, strips the macro syntax, and renders the environment *name* as a paragraph, so the web page carries a stray paragraph reading `appendix` at each end of the appendix. Measured in the built site, not inferred. The PDF is correct; the cost is two orphan paragraphs on the website. Nothing in MyST currently suppresses them.

Cross-reference appendices with raw LaTeX, not with a Markdown link. MyST's LaTeX renderer labels every section-type target "Section" and **discards the link text**, so `@appA`, `[Appendix A](#appA)`, `[Appendix {number}](#appA)` and `[Appendix %s](#appA)` all render "Section A". Write `` {raw:latex}`Appendix~\ref{appA}` `` instead, which renders "Appendix A" and nests correctly as "Appendix B.1". See [Cross-References](#cross-references) below.

#### Equations

- Inline math: `$...$`
- Display math: `` ```math `` blocks with optional `:label:` for numbered equations
- Multi-line equations with a single number: use `\begin{aligned}` inside a `{math}` block with `:label:`
- Equation arrays: use `\begin{align}` inside a `` ```math `` block
- Reference equations with `` {eq}`label` ``

#### Cross-References

- **Theorems, Lemmas, etc.**: `@th1` renders as "Theorem 1" (`Theorem~\ref{th1}`)
- **Definitions**: `@de1` renders as "Definition 1"
- **Tables**: `` {numref}`my-table` `` renders as "Table 1"
- **Figures**: `` {numref}`my-fig` `` renders as "Figure 1"
- **Equations**: `` {eq}`label` `` renders as "(1)"
- **Sections**: `@s1` renders "Section 1" in the PDF and "Section 1.1" in HTML, provided the document sets `title: true` and `headings: true` under `numbering` in its own frontmatter. Without those keys it renders the section title instead, which is a frontmatter configuration error rather than the [MyST limitation](https://github.com/executablebooks/mystmd/issues/1924) it is often mistaken for.
- **Appendices**: the label word is the problem, not the number. MyST's LaTeX renderer labels every section-type target "Section" and **discards the link text**, so `@appA`, `[Appendix A](#appA)`, `[Appendix {number}](#appA)` and `[Appendix %s](#appA)` all render "Section A". Supply the word yourself with raw LaTeX: `` {raw:latex}`Appendix~\ref{appA}` `` renders "Appendix A" and nests correctly as "Appendix B.1". Formula, theorem, table, and figure references (`{eq}`, `@th1`, `` {numref}` ``) are unaffected and render numbers correctly. See [`sample/appendix.md`](sample/appendix.md).

See [MyST Cross-references Guide](https://mystmd.org/guide/cross-references) for complete details.

### Where We Use Raw LaTeX

#### Complex Tables

Tables with custom column specifications, `\hline`, `\cline`, `\legend{}`, and precise alignment require raw LaTeX `{raw} latex` blocks. MyST's table syntax cannot reproduce these layouts.

#### Algorithm packages

The template bundles `algpseudocode` but deliberately **does not** load the `algorithm` float package, because it collides with the numbered `algorithm` theorem environment the template defines. Write algorithms as a `{prf:algorithm}` directive, optionally nesting a `{raw} latex` block of `algorithmic` pseudocode inside it. See [Algorithms](#algorithms) below for the two forms and how each renders.

Do **not** write a raw `\begin{algorithm}...\caption{}` float. Without the float package that fails with `Package caption Error: \caption outside float`, the caption is silently dropped, and `myst build` still exits 0 with a PDF.

### MyST Limitations and Fidelity to the QE/ECMA Template

Authoring in Markdown means the generated LaTeX is not byte-identical to a hand-written QE `.tex`. The first table below lists differences where the rendered **PDF is still equivalent** to the original; the second lists **genuine limitations** where it is not. Each records the workaround where one exists.

#### Irreducible rendering differences (same PDF, different source)

| Feature | Hand-written QE | MyST output |
| --- | --- | --- |
| Preamble | you write `\usepackage` lines | injected automatically (see [LaTeX Packages](#latex-packages)) |
| Inline code | `` \verb|\cmd| `` | `\texttt{{\textbackslash}cmd}` |
| Equation arrays | `eqnarray` | `align` (the non-deprecated equivalent) |
| Long quotation | `\begin{quotation}` | `\begin{quote}` (all blockquotes) |
| Emphasis | `\emph{}` | `\textit{}` |
| Figures | `\includegraphics{figure_sample}` | `files/figure_sample-<hash>.pdf` (assets copied and content-hashed) |
| Paragraph headings | `\paragraph*{Heading}` | `\textbf{Heading}`, which runs in identically |
| Bibliography | a hand-maintained `thebibliography` with 10 `\bibitem`s | `\bibliographystyle` + `\bibliography`, so BibTeX builds it from `references.bib` using the journal's own `.bst` |
| Whitespace | hand-formatted | normalized |

Checked by diffing the generated LaTeX against `original/qe/qe_sample.tex`: all
ten body sections match in order and title, both files carry three floats, and
the appendix headings render identically ("APPENDIX A: TITLE OF THE FIRST
APPENDIX").

Earlier revisions of this paragraph also quoted a line-level similarity figure.
It has been removed rather than restated: no script recorded the normalization
that produced it, an audit that grid-searched two dozen plausible normalizations
reproduced none of them, and the sample has since grown. A number that reads as
measured and cannot be rechecked is worse than no number. Re-derive one with a
committed script if it is wanted.

Content is **not** fully preserved. The differences beyond the substitutions in
these two tables are: the upstream single-appendix example (`\section*{Title}`
plus its accompanying note) has no counterpart here; four sentences from
upstream's Citation section are absent, covering `\citeauthor`, `\citeyear`, and
a bracketed-locator `\citet[Theorem 1]{}`; and the Fonts list differs in content,
upstream showing a genuinely small-capped example where this sample shows roman.

#### Genuine limitations (a QE feature MyST cannot reproduce in the PDF)

| Feature | Limitation | Workaround |
| --- | --- | --- |
| Appendix cross-references | `@appA` renders "Section A" rather than "Appendix A". The letter resolves correctly; only the label word is wrong. MyST's LaTeX renderer **discards link text entirely** for section-type targets, so `[Appendix A](#appA)` also renders "Section A", as do `{number}`, `{name}` and `%s` placeholders | use raw LaTeX where the word matters: `` {raw:latex}`Appendix~\ref{appA}` `` renders "Appendix A" and nests correctly ("Appendix B.1"). It does not appear in HTML output, so use it only in PDF-targeted prose |
| `@incollection` entries lose their volume and editors | MyST's bibliography round-trip **re-types `@incollection` as `@inbook`** in the emitted `main.bib`. The two differ in which fields the `.bst` reads: `incollection` prints "In *Book* (Eds., eds.)", while `inbook` puts the entry's own `title` in book position and ignores `booktitle` and `editor` when `author` is present. A chapter therefore renders as a standalone monograph. BibTeX's only signal is the warning `can't use both author and editor fields` | add a `note` field carrying the volume and editors; it survives the retyping. See `b4` in [`sample/references.bib`](sample/references.bib) |
| Author-only / year-only citations, and citation prefixes/suffixes | Every MyST citation form collapses to `\citet`, `\citep` or `\cite`. `{cite:author}` and `{cite:year}` are not distinguished, and prefix/suffix text is **silently dropped**: `[e.g. @b1, pg. 22]` and `` {cite:p}`{see}b1{fig 1}` `` emit a bare `\citep{b1}`, while `@b1 [pg. 22]` emits `\cite{b1}`, which natbib renders *textually* as "Aumann (1987)" rather than parenthetically | raw LaTeX gives all of them back: `` {raw:latex}`\citeauthor{b1}` `` renders "Aumann", `` {raw:latex}`\citeyear{b1}` `` renders "1987", and `` {raw:latex}`\citep[e.g.][pg. 22]{b1}` `` renders "(e.g. Aumann, 1987, pg. 22)". **The key must also be cited once through a normal MyST role somewhere in the document**, because MyST only writes keys it parses into the generated `main.bib`; a raw-only key renders as `?` |
| `claim` / `fact` results | see [Proof directives](#proof-directives) below | `{prf:proposition}` / `{prf:observation}`, or a `{raw} latex` `\begin{claim}` block (the environments are defined) |
| Small caps / sans serif in text | no Markdown syntax. Two things that look like they work do not: writing `\textsc{X}` bare in Markdown is **escaped to literal text** (`{\textbackslash}textsc\{X\}`), and the `` {sc}`X` `` role **silently drops its content** in the PDF, logging `Unhandled LaTeX conversion for node of "smallcaps"` while still exiting 0 | `` {raw:latex}`\textsc{X}` `` / `` {raw:latex}`\textsf{X}` ``. Use `` {sc}`X` `` only if the output is HTML, where it renders correctly |
| LaTeX logo macros in prose | Markdown has no `\LaTeXe` / `\TeX`, so writing them as text renders "LaTeX2e" where the hand-written sample renders the proper logo | `` {raw:latex}`\LaTeXe` `` when the logo matters; cosmetic otherwise |
| Footnotes inside a figure caption | **silently dropped from the PDF** while rendering normally on the website, so the note exists online and is simply missing from the manuscript. Body footnotes are unaffected | put the note in the body text, or fold it into the caption itself |
| `{prf:criterion}`, `{prf:property}` | body text **dropped from the PDF**, rendered normally in HTML; both log "Unhandled LaTeX proof environment" | use one of the 13 supported kinds, or a `{raw} latex` block |
| `{prf:claim}`, `{prf:exercise}`, `{prf:solution}` | **not MyST proof kinds at all.** HTML shows an "Unknown Directive" error box with the raw source below it; the PDF gets nothing, and **no log line is emitted**, so watching the build log will not save you | use `{prf:proposition}`, `{prf:example}` or `{prf:remark}` |

#### Proof directives

MyST's LaTeX renderer maps most `{prf:...}` kinds to environments, and this template defines the ones econsocart does not: `theorem, proof, proposition, definition, example, remark, axiom, conjecture, lemma, observation, corollary, assumption, algorithm`.

Two kinds it recognizes but cannot serialize, `{prf:criterion}` and `{prf:property}`, log "Unhandled LaTeX proof environment" and are **silently dropped from the PDF** while still rendering in HTML. MyST exits 0, so watch the build log for those two.

`{prf:claim}`, `{prf:exercise}` and `{prf:solution}` are a different failure: they are not MyST proof kinds, so HTML renders an "Unknown Directive" error box and the PDF gets nothing, with **no log line at all**. Watching the log does not catch these; read the output. Use a supported kind, or write the environment in a `{raw} latex` block.

#### Algorithms

`{prf:algorithm}` is the right directive: it numbers as "Algorithm N" in both the PDF and the website, and cross-references resolve (`@alg1` renders "Algorithm 1").

For the steps, choose by deliverable:

| Steps written as | PDF | HTML |
| --- | --- | --- |
| an ordinary Markdown numbered list | numbered list, nested correctly | numbered list |
| a nested ```` ```{raw} latex ```` block using `algorithmic` | pseudocode with a line-number gutter and `for ... do` keywords | numbered lines with the loop structure intact: `\For` renders as a bold `for`, `\EndFor` as a bold `end for`. The only loss is the `\Return` **keyword**, whose argument text still renders |

Both are demonstrated in [`sample/article.md`](sample/article.md), measured against a
real `myst build --html`. Nesting a raw block inside `{prf:algorithm}` works, and
the HTML renderer does more with it than "raw LaTeX" suggests: it parses the
`algorithmic` body into numbered lines inside the Algorithm box and keeps the
control flow.

An earlier version of this table claimed `\For` and `\EndFor` were dropped and
left blank numbered lines. That was wrong, and wrong in an instructive way: it
came from grepping the page for the input syntax and reading its absence as
absence of everything. To test whether a construct survives to HTML, diff the
visible markup with and without it.

So: **either form works on both outputs.** Prefer the Markdown list when you want
the steps to be selectable, searchable text on the website; prefer the nested
`algorithmic` block when the PDF's line-number gutter and keyword typography
matter. Avoid `\Return` if the returned value must be labelled on the web, or
write the word into the step text.

Use `algpseudocode` syntax (`\State`, `\For`, `\EndFor`), not the older all-caps `\STATE`/`\FOR`, which run the steps together into a paragraph.

Note that `algorithm` here is a numbered theorem environment, not the float from `\usepackage{algorithm}`, which this template deliberately does not load: MyST emits the environment with a `\label` and no `\caption`, and a float takes its number from the caption, so under the float package the block rendered with no "Algorithm N" label at all. The consequence is that raw-LaTeX `\begin{algorithm}...\caption{}` float syntax does not compile here.

#### Writing LaTeX inside Markdown

Five different things get called "raw LaTeX" and they behave differently. Both
columns are measured: the PDF from the `.tex` export, the HTML from a real
`myst build --html`, reading the visible markup rather than the AST.

| What you write | Reaches PDF | Reaches HTML |
| --- | --- | --- |
| A **math** environment bare in Markdown (`align`, `gather`, `multline`, the `matrix` family) | yes, as math | yes, as math |
| Any **non-math** environment bare in Markdown (`tabular`, `tabularx`, `longtable`, `algorithm`, `figure`, ...) | **no**, escaped to literal text | no |
| An **inline macro** bare in Markdown (`\textsc{}`, `\citeauthor{}`, `\ref{}`, `\LaTeXe`) | **no**, escaped to literal text | no |
| A ```` ```{raw} latex ```` **block** | yes, verbatim | **yes**, MyST parses and renders it |
| A `` {raw:latex}`...` `` inline **role** | yes, verbatim | **no**, dropped |

The block and the role are not interchangeable, which is the least obvious
thing here: a raw *block* reaches the website, a raw *role* does not. And a
block is not passed through opaquely on the web, it is parsed, so what renders
may be incomplete rather than absent (see [Algorithms](#algorithms) for a case
where a loop's `for`/`end for` disappear while its steps survive).

Declaring a package in `template.yml` does **not** make a bare environment pass
through: it makes raw-block content that uses the package *compile* once it is
passed through.
Those are separate problems, and only the second is what `packages:` solves.

MyST's own [Writing in LaTeX](https://mystmd.org/guide/writing-in-latex) guide
lists a much longer set of environments it understands. That applies to MyST
parsing a `.tex` **source document**; it is not the same as embedding those
environments in a `.md` file, which is what this table describes.

#### LaTeX packages

Three groups of packages are available in every build:

1. **Auto-injected by MyST** when its own content needs them (never declared): `booktabs, pdflscape, longtable, amsmath, amsthm, imakeidx, listings, minted, ulem, framed, graphicx, natbib, siunitx, glossaries, xcolor`.
2. **Provided by the class and template:** `amssymb, bm, etoolbox, fontenc, textcomp, times, url` (class) and `hyperref` (template). These are declared in `packages:`, so MyST does not re-inject them.
3. **Loaded by the template** (packages MyST recognizes but does not auto-inject, so raw-LaTeX content that uses them compiles): `algpseudocode, subcaption, multirow, tabularx, wrapfig, threeparttable, adjustbox, changepage, mhchem, cancel, supertabular, epigraph, cleveref`. Note that `algorithm` is **not** among them, by design: see [Algorithms](#algorithms).

Because group 3 is loaded unconditionally, **your TeX installation must contain these packages**. A full TeX Live has them; on a minimal install add them with `tlmgr install <name>`.

Three packages are deliberately **excluded** because they conflict with the class or bibliography: `soul` (its `\caps` clashes with the class), `csquotes` (its `\enquote` clashes with `qe.bst`), and `algorithm2e` (its `\algorithm` clashes with `algorithm`). MyST already uses `ulem` for strikethrough, so `soul` is not needed.

For any package **beyond** these groups (e.g. `tikz`, `pgfplots`), use the `extra_packages` export option:

```yaml
exports:
  - format: tex+pdf
    template: https://github.com/alanlujan91/econsoc_template.git
    output: paper.pdf
    extra_packages: tikz,pgfplots
```

## Supplement Template

For supplementary material, use the same template with `supplement: true`:

```yaml
exports:
  - format: tex+pdf
    template: https://github.com/alanlujan91/econsoc_template.git
    output: supplement.pdf
    supplement: true
```

In supplement mode, the template skips funding, coeditor, keywords, and JEL code sections. Abstract is optional. See [`sample/supplement.md`](sample/supplement.md) for a working example.

## Local Development

### Preview Website

```bash
myst start
```

### Build PDF

```bash
myst build your-paper.md --pdf
```

### Troubleshooting

**LaTeX compilation errors**:

1. **Missing fonts**: The `econsocart` class loads the `times` package (Times Roman via `psnfss`), which ships with every TeX distribution. If it is somehow missing, `tlmgr install psnfss`.
2. **Missing bibliography**: Ensure `bibliography: file.bib` in frontmatter and the file exists.
3. **Author format**: Check name structure matches the example above.
4. **Citations**: Verify all `{cite:}` references have matching BibTeX entries.
5. **Math**: Ensure all `$` and `$$` are properly closed.
6. **`Undefined control sequence ... \counterwithout`**: The theorem-numbering fix uses `\counterwithout`, a LaTeX2e kernel command added in the 2023-06-01 release. Update to TeX Live 2023 or newer.
7. **Line numbers overlapping text in `draft` mode**: `draft` prints line numbers in both margins. Content wider than the text block (an `Overfull \hbox`) spills into the margin and collides with them. This is over-wide content, not the line numbers: search the build log for `Overfull \hbox ... too wide`, then break the wide equation (`align`/`multline`), shorten the long token, or wrap the wide table/figure in `\resizebox{\linewidth}{!}{...}`.

**Common issues**:

- **"Template not found"**: Check `exports` -> `template` path is correct
- **"Bibliography not found"**: Ensure `.bib` file is in the correct location

**Getting help**:

- Check [`sample/article.md`](sample/article.md) for a working example
- Review [MyST Documentation](https://mystmd.org)
- Open an [issue](../../issues) for template-specific problems

## Template Files

- `template.tex` - Main template file (Jinja2 syntax)
- `template.yml` - Template configuration and options
- `econsocart.cls` - Econometric Society document class (shared by all three journals)
- `econsocart.cfg` - Econometric Society class configuration (shared)
- `econsoc.bst` - Econometrica bibliography style
- `qe.bst` - Quantitative Economics bibliography style
- `te.bst` - Theoretical Economics bibliography style
- `thumbnail.png` - Template preview
- `sample/` - Complete working examples (main article and supplement)
- `scripts/sync-vendored.sh` - Re-vendors the files above from `original/*`
- `original/{ecta,qe,te}/` - Pinned upstream templates (git submodules)

The class and configuration are one shared file across the three journals, so
they are vendored from whichever submodule ships the newest release; each `.bst`
comes from its own journal. `scripts/sync-vendored.sh` encodes that rule, and the
`check-upstream-drift` CI job enforces it.

## License and Attribution

This repository contains work under **two different licenses**. They are not
interchangeable, and the upstream files cannot be relicensed by this project.

### Upstream files (LPPL 1.3c, not ours)

`econsocart.cls`, `econsocart.cfg`, `econsoc.bst`, `qe.bst`, and `te.bst` are the
official Econometric Society class and bibliography style files. They are

- **Copyright (c) 2022 UAB "VTeX"** (TeX programming: Edgaras Sakuras, VTeX, Lithuania)
- licensed under the [LaTeX Project Public License (LPPL) v1.3c](https://www.latex-project.org/lppl/) or any later version
- redistributed here **verbatim**, with their copyright and license headers intact

They are vendored (copied) rather than submoduled so the template stays
self-contained when MyST fetches it, since MyST does not fetch submodules. The
`check-upstream-drift` CI job asserts these copies remain byte-identical to the
pinned upstreams, which is also what keeps this repository on LPPL's
unmodified-distribution path: LPPL requires renaming a file if you distribute a
modified version, and nothing here modifies them.

Upstream sources, tracked as submodules under `original/`:

- [texsupport.econometricsociety-ecta](https://github.com/vtex-soft/texsupport.econometricsociety-ecta) - Econometrica
- [texsupport.econometricsociety-qe](https://github.com/vtex-soft/texsupport.econometricsociety-qe) - Quantitative Economics
- [texsupport.econometricsociety-te](https://github.com/vtex-soft/texsupport.econometricsociety-te) - Theoretical Economics

Official distribution point: <https://www.e-publications.org/es/support/>

### This template's own files (CC-BY-4.0)

`template.tex`, `template.yml`, `myst.yml`, `scripts/`, the `sample/` documents,
and this documentation are original work by Alan Lujan, licensed **CC-BY-4.0**.

### Trademarks and endorsement

"Econometrica", "Quantitative Economics", "Theoretical Economics", and The
Econometric Society's names and marks belong to their respective owners. They
are used here only to identify the target journal of a submission. See the
unofficial notice at the top of this README.

- **MyST Tools**: [MyST Markdown](https://mystmd.org)

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup, workflow documentation, and guidelines.
