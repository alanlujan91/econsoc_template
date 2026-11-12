# Econometric Society Journals MyST Template

MyST Markdown template for Econometric Society journal submissions: Econometrica, Quantitative Economics, and Theoretical Economics.

> **Unofficial.** This is an independent, community-maintained MyST template. It
> is not produced, endorsed, or supported by The Econometric Society, by VTeX, or
> by any of the three journals, whose official LaTeX templates it packages (linked
> below). Bugs here are not their responsibility, and acceptance of a submission produced with this
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
- **MyST Markdown authoring**: write in Markdown, compile to LaTeX/PDF, with a plugin that repairs the LaTeX exports released mystmd gets wrong (see [The econsoc plugin](#the-econsoc-plugin))
- **Author management**: multiple authors and affiliations with proper formatting
- **Document parts**: abstract and acknowledgements/funding as frontmatter parts; appendices in the body, or as an appendix part with the plugin (see [Appendices](#appendices))
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
| `linenumbers` | boolean | `false` | Adds line numbers to a non-draft build. A draft numbers its lines regardless. This option cannot switch them *off* there, because the template never emits the class's `nolinenumbers` option. |
| `extra_packages` | string | (none) | Comma-separated LaTeX packages to load, e.g. `mhchem,cancel` (see [LaTeX Packages](#latex-packages)) |

The `open_access` frontmatter field automatically enables the econsocart `openaccess` class option. It produces no visible change in a PDF you build: the license statement it controls is part of the copyright block, which the journal adds during production. Measured in both preprint and non-preprint builds.

`corresponding: true` on an author is likewise not rendered. econsocart marks the corresponding author through a `corref` key that only feeds the production-side open-access license line, so this template does not emit it.

#### Special characters in frontmatter

Write `&`, `%`, `#`, `_` in your title, keywords, JEL codes, author names and
affiliations as ordinary characters. The template escapes them. Titles keep `_`, `~`,
and `^` unescaped so `$x_1$` still renders as math, which means a *literal*
underscore in a title is the one case you must write as `\_` yourself.

Author emails are not escaped, because `\ead` builds a `mailto:` link that `\_`
would break. An address containing `&`, `%`, or `#` fails the build loudly.

#### Blockquote attributions

With the plugin, write an attribution either way: its `quotes` repair sets the quote in
place with the attribution flush right ([plugins/README.md](plugins/README.md#running-text)).
Without the plugin, do not leave a blank `>` line before a dash-prefixed attribution:

```markdown
> We know what we are, but know not what we may be.
> -- William Shakespeare, Hamlet
```

With a blank `>` line in between, MyST reads the last line as an attribution,
wraps the quote in a `figure`, and emits `\caption*{...}`. econsocart ignores the
star and typesets a phantom **"FIGURE 0."** into the paper, at exit 0 with nothing
in the log.

The dash count is irrelevant: `--` and `---` behave identically, and both are safe
without the blank line. Measured across all six forms; an attribution with no
leading dashes is also safe. CI asserts no `\caption*` reaches the emitted LaTeX.

#### Citations in the abstract

With the plugin, cite in the `abstract` as anywhere else: its `part-citations` repair
carries those keys into the `.bib` ([plugins/README.md](plugins/README.md#citations)).
Without the plugin, do not cite there. MyST excludes frontmatter parts from the
rendered document, and bibliography harvesting walks that document, so the
`\cite` reaches the `.tex` while its entry never reaches the `.bib`: the citation
is undefined, at exit 0. An appendix part has the same cause. See
[jupyter-book/mystmd#3032](https://github.com/jupyter-book/mystmd/issues/3032).

#### Which mode for which stage

The three journals want a different PDF at each stage, and getting the stage wrong
is the likeliest way to send one the journal did not ask for.

`preprint` and `draft` are independent switches on top of `journal`. Keep
`journal` set to your actual target at every stage, so the layout and bibliography
style are always the right ones.

| Stage | Options | Produces |
| --- | --- | --- |
| Working paper / preprint posting | `journal: <target>`, `preprint: true` (default) | the journal's layout with no journal identification |
| **Initial submission** | `journal: <target>`, `preprint: false`, `draft: true` | proof layout: US Letter, line numbers, increased line spacing, "Submitted to ..." banner |
| Camera-ready, after acceptance | `journal: <target>`, `preprint: false` | the typeset journal layout |

`preprint` is deliberately left out of the values of `journal`. It once was, and that
forced the Quantitative Economics layout on every neutral build, so a
Theoretical Economics preprint was silently typeset as Quantitative Economics
and used `qe.bst`. As a switch it strips the identification and leaves the
journal unchanged.

#### Econometrica house style

Setting `journal: ecta` gets you Econometrica's layout, class option and
bibliography style. The `econsocart` class itself enforces none of Econometrica's
house style: there is no case-forcing or keyword-suppressing logic in the class
for the author to inherit. Comparing Econometrica's own sample against the
Quantitative Economics and Theoretical Economics ones:

| | Econometrica | Quantitative Economics / Theoretical Economics |
| --- | --- | --- |
| Title, running head, and every section and subsection heading | Title Case: "Section Headings", "Equations and the Like" | sentence case: "Section headings" |
| JEL codes | none (suppressed by the template, below) | up to 3, in alphabetical order |
| Keyword guidance | 3-8 keywords | 3-8 keywords and up to 3 JEL codes |

Under `journal: ecta` the template suppresses the JEL block even when the document
supplies `tags`, because both `ecta_sample.tex` and `ecta_template.tex` lack one
while the qe and te equivalents each carry one. Keep your `tags:` in frontmatter:
they still emit for the qe and te exports of the same source, so one document
retargets across all three journals without hand-editing. The suppression leaves a
comment in the emitted `.tex` recording that codes were withheld.

Title Case is yours to apply: write Econometrica headings in Title Case in your
own prose, since neither the template nor the class does it.

Two more Econometrica conventions, both demonstrated in
[`sample/article.md`](sample/article.md):

- Papers with five or more authors cite as the initials of the first four
  followed by a plus sign. `econsoc.bst` renders `[HNPS+]` where the other two
  styles render "Hortacsu et al." This needs the `\xcitelabel` support added in
  `econsocart.cfg` v1.0.7, so the vendored config tracks the newest release.
- An approved supplement is referenced at the end of the introduction and cited
  like any other work. Refer to material inside it in plain text, since it is a
  separate document that a cross-reference cannot reach.

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

The `draft` option targets that stage: the class configuration switches to a
proof layout (`\proof@papersize`, increased `\baselinestretch`, line numbers in
both margins). Econometrica additionally notes that the submitted manuscript need
not follow its style specifications at all, since the copyeditor and typesetter
apply them; and it asks for complete source files (LaTeX preferred, figures as
`.eps` or `.jpg`) only *after* acceptance.

These requirements change, so check each journal's current ones before submitting:

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

By default (`preprint: true`) the PDF omits all journal identification (see the `preprint` row of [Template Options](#template-options)), so it is safe to post as a working paper without signalling where it was submitted. A Theoretical Economics preprint still looks like Theoretical Economics.

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

Draft mode switches to the proof layout described above and shows the "Submitted to ..." banner unless `preprint` is left on.

Use `acknowledgement` (singular) in frontmatter, not `acknowledgements`.

## The econsoc plugin

Released mystmd (1.12.0) writes several constructs to LaTeX wrongly, each at exit 0;
the limitations below list them. `plugins/econsoc.mjs` repairs them. A paper lists it
in its own `myst.yml`, because MyST loads plugins from the project and never from an
export's `template:`:

```yaml
project:
  plugins:
    - qe_template/plugins/econsoc.mjs
```

The path is relative to `myst.yml`, here a copy of this repository at `qe_template/`.
Each repair, the LaTeX it writes, its limitations and what changes when a paper adopts
the plugin are in [plugins/README.md](plugins/README.md). The sections below name the
repair that removes each limitation and keep the workaround for a paper without the
plugin. Because the sample does not list the plugin, `sample/exports/` shows what
released mystmd writes.

## MyST Implementation Details

> **The upstream limitations below were measured on mystmd 1.10.1**; those the plugin
> repairs were measured again on 1.12.0. Several describe bugs with open pull
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
- **Small caps and sans serif**: `` {sc}`X` `` with the plugin. Sans serif, and small caps without the plugin, take inline LaTeX, `\textsf{}` and `\textsc{}` (see [Real limitations](#real-limitations-a-qe-feature-myst-cannot-reproduce-in-the-pdf))

#### Citations

- `` {cite:t}`ref` `` for textual citations (e.g., "Smith (2020)") renders as `\citet{}`
- `` {cite:p}`ref` `` for parenthetical citations (e.g., "(Smith 2020)") renders as `\citep{}`
- MyST recognizes other roles too (`{cite:author}`, `{cite:year}`, ...), and citation prefixes and suffixes. With the plugin, its `citation-forms` repair writes each as the site prints it ([plugins/README.md](plugins/README.md#citations)). Without the plugin, MyST's LaTeX renderer collapses them all to `\citet`/`\citep` and drops the notes, so the QE sample's author-only (`\citeauthor`) and year-only (`\citeyear`) cites need raw LaTeX; see [Limitations and Fidelity](#myst-limitations-and-fidelity-to-the-qeecma-template). See also the [MyST Citations Guide](https://mystmd.org/guide/citations).
- `` {cite}`a,b` `` is narrative, "Aumann (1987), Nash (1950)," on the site and in the PDF alike, by MyST's design. Write `{cite:p}` for a parenthetical citation.

#### Lists

- Itemized lists: Markdown `-` syntax
- Numbered lists: Markdown `1.`, `2.`, etc.

#### Footnotes

- Markdown footnote syntax: `[^1]` with `[^1]: Footnote text.` at the bottom
- A footnote in a caption or a table cell, or one referenced twice, needs the plugin's `footnotes` repair ([plugins/README.md](plugins/README.md#running-text))

#### Quotations

- Markdown blockquote syntax with `>` prefix
- MyST converts to `\begin{quote}` in LaTeX
- For an attribution line, see [Blockquote attributions](#blockquote-attributions)
- See [MyST Typography Guide](https://mystmd.org/guide/typography#quotations)

#### Theorem-like Environments

> **Without the plugin, `{prf:assumption}` and `{prf:algorithm}` are dropped from
> the PDF.** Released `myst-to-tex` maps 11 of the 15 proof kinds; `algorithm`,
> `assumption`, `criterion`, and `property` match no case and are omitted along with
> their `\label`, so cross-references to them render `??`. The build exits 0. See
> [jupyter-book/mystmd#3030](https://github.com/jupyter-book/mystmd/issues/3030);
> the fix is open as [#3031](https://github.com/jupyter-book/mystmd/pull/3031). The
> plugin's `proof-kinds` repair writes all four
> ([plugins/README.md](plugins/README.md#proofs-and-exercises)).
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
through the plugin's `proof-titles` repair.

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
repair adds `{prf:claim}` (numbered) and `{prf:fact}` (unnumbered) to both outputs. Since the
sample does not list the plugin, it uses `{prf:proposition}` and `{prf:observation}`
in their place.

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
repairs fix both ([plugins/README.md](plugins/README.md#citations),
[plugins/README.md](plugins/README.md#floats-macros-and-parts)).
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
- `@s1` renders "Section 1" in the PDF and "Section 1.1" in HTML, provided the document sets `title: true` and `headings: true` under `numbering` in its own frontmatter. Without those keys it renders the section title instead, which is a frontmatter configuration error rather than the [MyST limitation](https://github.com/executablebooks/mystmd/issues/1924) it is often mistaken for.
- A numbered link to a section prints `??` when the numbering keys are set at project level in `myst.yml` rather than in the document's own frontmatter: `[Sec %s](#sec-one)` emits `Sec~??` and the PDF prints `Sec ??`, at exit 0 with nothing in the log. Plain `[](#sec-one)` and `@sec-one` still work, which makes it easy to miss. Cause and fix in [jupyter-book/mystmd#3035](https://github.com/jupyter-book/mystmd/pull/3035): a single-article export sets the article level to 0, so the numbering lookup needs a `heading_0` key that cannot be enabled. The plugin's `xref` repair fixes it ([plugins/README.md](plugins/README.md#references-and-labels)). Without the plugin, set `title: true` and `headings: true` in the document's frontmatter (the sample does) or write the reference as raw LaTeX. `scripts/build-samples.sh` fails the build on any `??` in a rendered PDF.
- A reference to an appendix section prints "Section A" without the plugin; see [Appendices](#appendices) and [`sample/appendix.md`](sample/appendix.md). Equation, theorem, table, and figure references into the appendix (`{eq}`, `@th1`, `` {numref}` ``) render correctly either way.
- With the plugin, a link whose label is missing, or whose target LaTeX does not number, prints `??label` and adds a warning to the build log. A `(label)=` line on an ordered-list item makes `[Item %s](#label)` print the item's number ([plugins/README.md](plugins/README.md#references-and-labels)).

See [MyST Cross-references Guide](https://mystmd.org/guide/cross-references) for complete details.

### Where We Use Raw LaTeX

#### Complex Tables

Tables with custom column specifications, `\hline`, `\cline`, `\legend{}`, and precise alignment require raw LaTeX `{raw} latex` blocks. MyST's table syntax cannot reproduce these layouts.

#### Algorithm packages

The template bundles `algpseudocode` but deliberately **does not** load the `algorithm` float package (`\usepackage{algorithm}`), because it collides with the numbered `algorithm` theorem environment the template defines ([template internals](docs/template-internals.md#theorem-counters) says why it is a theorem). Write algorithms as a `{prf:algorithm}` directive, optionally nesting a `{raw} latex` block of `algorithmic` pseudocode inside it; the block reaches the PDF only with the plugin (see [Theorem-like Environments](#theorem-like-environments)). See [Algorithms](#algorithms) below for the two forms and how each renders.

Do **not** write a raw `\begin{algorithm}...\caption{}` float. Without the float package that fails with `Package caption Error: \caption outside float`, the caption is silently dropped, and `myst build` still exits 0 with a PDF.

### MyST Limitations and Fidelity to the QE/ECMA Template

Authoring in Markdown means the generated LaTeX is not byte-identical to a hand-written QE `.tex`. The first table below lists differences where the rendered **PDF is still equivalent** to the original; the second lists **real limitations** where it is not. Each records the workaround where one exists.

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
| Appendix cross-references | `@appA` renders "Section A" rather than "Appendix A". The letter resolves correctly; only the label word is wrong. MyST's LaTeX renderer **discards link text entirely** for section-type targets, so `[Appendix A](#appA)` also renders "Section A", as do `{number}`, `{name}`, and `%s` placeholders | the plugin's `xref` repair ([plugins/README.md](plugins/README.md#references-and-labels)). Without it, use raw LaTeX where the word matters: `` {raw:latex}`Appendix~\ref{appA}` `` renders "Appendix A" (see [Appendices](#appendices)). It does not appear in HTML output, so use it only in PDF-targeted prose |
| `@incollection` entries lose their volume and editors | MyST's bibliography round-trip **re-types `@incollection` as `@inbook`** in the emitted `main.bib`. The two differ in which fields the `.bst` reads: `incollection` prints "In *Book* (Eds., eds.)", while `inbook` puts the entry's own `title` in book position and ignores `booktitle` and `editor` when `author` is present. A chapter therefore renders as a standalone monograph. BibTeX's only signal is the warning `can't use both author and editor fields` | add a `note` field carrying the volume and editors; it survives the retyping. See `b4` in [`sample/references.bib`](sample/references.bib) |
| Author-only / year-only citations, and citation prefixes/suffixes | Every MyST citation form collapses to `\citet`, `\citep`, or `\cite`. `{cite:author}` and `{cite:year}` are not distinguished, and prefix/suffix text is **silently dropped**: `[e.g. @b1, pg. 22]` and `` {cite:p}`{see}b1{fig 1}` `` emit a bare `\citep{b1}`, while `@b1 [pg. 22]` emits `\cite{b1}`, which natbib renders *textually* as "Aumann (1987)" rather than parenthetically | the plugin's `citation-forms` repair ([plugins/README.md](plugins/README.md#citations)). Without it, raw LaTeX gives all of them back: `` {raw:latex}`\citeauthor{b1}` `` renders "Aumann", `` {raw:latex}`\citeyear{b1}` `` renders "1987", and `` {raw:latex}`\citep[e.g.][pg. 22]{b1}` `` renders "(e.g. Aumann, 1987, pg. 22)". **The key must also be cited once through a normal MyST role somewhere in the document**, because MyST only writes keys it parses into the generated `main.bib`; a raw-only key renders as `?` |
| `claim` / `fact` results | see [Proof directives](#proof-directives) below | the plugin's `claim-fact` repair. Without it, `{prf:proposition}` / `{prf:observation}`, or a `{raw} latex` `\begin{claim}` block (the environments are defined) |
| Small caps / sans serif in text | no Markdown syntax. `\textsc{X}` written bare in Markdown is **escaped to literal text** (`{\textbackslash}textsc\{X\}`), and the `` {sc}`X` `` role **silently drops its content** in the PDF, logging `Unhandled LaTeX conversion for node of "smallcaps"` while still exiting 0, though both look like they work | `` {sc}`X` `` with the plugin's `smallcaps` repair ([plugins/README.md](plugins/README.md#running-text)). `` {raw:latex}`\textsf{X}` `` for sans serif, and `` {raw:latex}`\textsc{X}` `` for small caps without the plugin, where `` {sc}`X` `` renders correctly only in HTML |
| LaTeX logo macros in prose | Markdown has no `\LaTeXe` / `\TeX`, so writing them as text renders "LaTeX2e" where the hand-written sample renders the proper logo | `` {raw:latex}`\LaTeXe` `` when the logo matters; cosmetic otherwise |
| Footnotes inside a figure or table caption, or a table cell | **silently dropped from the PDF** while rendering normally on the website, so the note exists online and is missing from the manuscript. A footnote referenced twice prints its text twice. Body footnotes are otherwise unaffected | the plugin's `footnotes` repair ([plugins/README.md](plugins/README.md#running-text)). Without it, put the note in the body text, or fold it into the caption itself |
| `{prf:criterion}`, `{prf:property}` | body text **dropped from the PDF**, rendered normally in HTML; both log "Unhandled LaTeX proof environment" | the plugin's `proof-kinds` repair. Without it, use one of the 13 supported kinds, or a `{raw} latex` block |
| `{prf:claim}`, `{prf:fact}`, `{prf:exercise}`, `{prf:solution}` | **not MyST proof kinds at all.** HTML shows an "Unknown Directive" error box with the raw source below it; the PDF gets nothing, and **no log line is emitted**, so watching the build log will not save you | `{prf:claim}` and `{prf:fact}` with the plugin's `claim-fact` repair. For exercises, MyST's own `{exercise}` and `{solution}`, which reach the PDF with the plugin's `exercises` repair. Without the plugin, use `{prf:proposition}`, `{prf:example}`, or `{prf:remark}` |
| Other LaTeX exports | more constructs written wrongly at exit 0, from a link inside a raw LaTeX block printed verbatim to the paragraph after a theorem running on unindented | the plugin; [plugins/README.md](plugins/README.md#repairs) lists every repair |

#### Proof directives

MyST's LaTeX renderer maps most `{prf:...}` kinds to environments, and this template defines the ones econsocart does not: `theorem, proof, proposition, definition, example, remark, axiom, conjecture, lemma, observation, corollary, assumption, algorithm, criterion, property, claim, fact`, plus `exercise` and `solution` for MyST's `{exercise}` and `{solution}` directives.

Without the plugin, two kinds it recognizes but cannot serialize (`{prf:criterion}` and `{prf:property}`) log "Unhandled LaTeX proof environment" and are **silently dropped from the PDF** while still rendering in HTML. MyST exits 0, so watch the build log for those two. The plugin's `proof-kinds` repair writes them.

`{prf:claim}`, `{prf:fact}`, `{prf:exercise}`, and `{prf:solution}` are a different failure: they are not MyST proof kinds, so HTML renders an "Unknown Directive" error box and the PDF gets nothing, with **no log line at all**. The plugin's `claim-fact` repair makes `{prf:claim}` and `{prf:fact}` proof kinds on both outputs. For exercises, use MyST's `{exercise}` and `{solution}`, which stock mystmd drops from the PDF and the plugin's `exercises` repair writes ([plugins/README.md](plugins/README.md#proofs-and-exercises)). Without the plugin, watching the log does not catch these; read the output. Use a supported kind, or write the environment in a `{raw} latex` block.

#### Algorithms

`{prf:algorithm}` is the right directive. With the plugin it numbers as "Algorithm N" in both the PDF and the website, and cross-references resolve (`@alg1` renders "Algorithm 1"). Without the plugin the PDF drops the block unless you use the `{prf:observation}` workaround in [Theorem-like Environments](#theorem-like-environments).

For the steps, choose by deliverable:

| Steps written as | PDF | HTML |
| --- | --- | --- |
| an ordinary Markdown numbered list | numbered list, nested correctly | numbered list |
| a nested ```` ```{raw} latex ```` block using `algorithmic` | pseudocode with a line-number gutter and `for ... do` keywords | numbered lines with the loop structure intact: `\For` renders as a bold `for`, `\EndFor` as a bold `end for`. The only loss is the `\Return` **keyword**, whose argument text still renders |

Both are demonstrated in [`sample/article.md`](sample/article.md) and were
measured against a real `myst build --html`, where the nested `algorithmic` body
renders as numbered lines inside the Algorithm box. An earlier version of this
table wrongly claimed `\For` and `\EndFor` were dropped, from grepping the page for
the input syntax. To test whether a construct survives to HTML, diff the visible
markup with and without it.

Either form works on both outputs. Prefer the Markdown list when you want
the steps to be selectable, searchable text on the website; prefer the nested
`algorithmic` block when the PDF's line-number gutter and keyword typography
matter. Avoid `\Return` if the returned value must be labelled on the web, or
write the word into the step text.

Use `algpseudocode` syntax (`\State`, `\For`, `\EndFor`), not the older all-caps `\STATE`/`\FOR`, which run the steps together into a paragraph. Raw `\begin{algorithm}...\caption{}` float syntax does not compile here (see [Algorithm packages](#algorithm-packages)).

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

Build the PDF as in [Quick Start](#3-build-pdf).

### Troubleshooting

**LaTeX compilation errors**:

1. **Missing fonts**: The `econsocart` class loads the `times` package (Times Roman via `psnfss`), which every TeX distribution includes. If it is somehow missing, `tlmgr install psnfss`.
2. **Missing bibliography** (also "Bibliography not found"): Ensure `bibliography: file.bib` is in frontmatter and the `.bib` file exists at that location.
3. **Author format**: Check name structure matches the example above.
4. **Citations**: Verify all `{cite:}` references have matching BibTeX entries.
5. **Math**: Ensure all `$` and `$$` are properly closed.
6. **`Undefined control sequence ... \counterwithout`**: The theorem-numbering fix uses `\counterwithout`, a LaTeX2e kernel command added in the 2023-06-01 release. Update to TeX Live 2023 or newer.
7. **Line numbers overlapping text in `draft` mode**: `draft` prints line numbers in both margins. Content wider than the text block (an `Overfull \hbox`) spills into the margin and collides with them. This is over-wide content, not the line numbers: search the build log for `Overfull \hbox ... too wide`, then break the wide equation (`align`/`multline`), shorten the long token, or wrap the wide table/figure in `\resizebox{\linewidth}{!}{...}`.

**Common issues**:

- **"Template not found"**: Check `exports` -> `template` path is correct

**Getting help**:

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
- `docs/template-internals.md` - Maintainer notes on the class traps `template.tex` works around
- `plugins/` - The econsoc plugin (`econsoc.mjs`, generated from `plugins/src/`); see [plugins/README.md](plugins/README.md)
- `sample/` - Complete working examples (main article and supplement)
- `scripts/sync-vendored.sh` - Re-vendors the files above from `original/*`
- `original/{ecta,qe,te}/` - Pinned upstream templates (git submodules)

Which submodule each vendored file comes from: [CONTRIBUTING, Which file comes from where](.github/CONTRIBUTING.md#which-file-comes-from-where).

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
pinned upstreams. The same check keeps this repository on LPPL's
unmodified-distribution path, since LPPL requires renaming a file if you distribute a
modified version, and nothing here modifies them.

Upstream sources are the three submodules under `original/`, linked at the top of
this README.

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
