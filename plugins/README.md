# MyST plugin for the Econometric Society template

`econsoc.mjs` holds every repair this template has for a LaTeX-export bug in released
mystmd (1.12.0). Each bug passes silently: the build exits 0 and the PDF is wrong.
Four have an upstream fix in an unmerged pull request
([#2352](https://github.com/jupyter-book/mystmd/pull/2352),
[#3031](https://github.com/jupyter-book/mystmd/pull/3031),
[#3033](https://github.com/jupyter-book/mystmd/pull/3033),
[#3035](https://github.com/jupyter-book/mystmd/pull/3035)); the rest have none.
Delete a repair once a mystmd release fixes its bug; `scripts/check-plugins.sh` says
when ([Checks](#checks)).

## Enabling it

MyST loads plugins from the project's `myst.yml` (and from a `myst.yml` in a parent
directory), so an export's `template:` cannot bring one along. A paper lists it
itself:

```yaml
project:
  plugins:
    - qe_template/plugins/econsoc.mjs
```

The path is relative to `myst.yml`; the MyST documentation says a URL to the file
works too. Without the line the paper still builds at exit 0, with every bug back.
An active plugin prints `Econsoc (<path>) loaded` in the build log.

`ECONSOC_DISABLE` switches repairs off for one build, by name, comma-separated:
`ECONSOC_DISABLE=footnotes,quotes myst build --pdf`. Naming an unknown repair stops the build.

## Raw nodes

A repair swaps a node for a `raw` node. myst-to-tex writes its `tex` field verbatim;
the website renders its `children`, which hold the original node. Only the LaTeX
changes, apart from the site fixes the tables mark.

- The website theme renders a `raw` node with children as a `<div>`, which breaks a
  paragraph: the rest of the sentence printed one letter per line. `inline-raws` turns
  each such node in running text into a span of a LaTeX-only `<tex>\iffalse `, the
  original node, and a LaTeX-only `\fi{}`. The site shows the original inline; LaTeX
  prints the repair and discards the original's rendering. myst-to-tex still writes
  that rendering, so the packages and macros it needs reach the preamble. A reference
  that is one `\ref` skips the copy by steering myst-to-tex's own handler; a replaced
  run of text (a minus sign, an abbreviation's space, a role) skips it as a childless
  `raw` node, whose `value` the site shows as plain text.
- Repairs that write a whole block (proofs, quotes, floats, footnote bodies) render it
  with the bundle's own myst-to-tex, the 1.0.48 that mystmd 1.12.0 runs, and the plugin
  warns at load when the running mystmd differs from the release the bundle was built
  against. A block is rendered when myst-to-tex reads it, after the export has renamed
  the images, so an image inside it gets its exported path.
- Within each of MyST's two plugin stages (document and project), the link, reference,
  and citation repairs run first, then the other repairs inside running text. The block
  repairs follow and render text the earlier ones have fixed. `block-breaks`, `macros`,
  and `inline-raws` run last.

## Repairs

Each name is the one `ECONSOC_DISABLE` takes. "Site" marks a repair that changes the
website too.

### References and labels

| Repair | Released mystmd | With the repair |
| --- | --- | --- |
| `xref` | a reference into the sibling document prints `??`; link wording is lost; a numbered link to a section prints `??` in a single-article export ([#3035](https://github.com/jupyter-book/mystmd/pull/3035)); an appendix section is called "Section" | the forms in the table below |
| `target-labels` | a worded link to a target myst-to-tex leaves unlabelled (a paragraph, a list, a code block) writes `\hyperref` to an undefined label, and LaTeX's "There were undefined references" then hides the real ones; a link cannot give an ordered-list item's number | `\phantomsection\label{x}` at the target; `\label{x}` inside the `\item`, so `[Item %s](#x)` prints "Item 2", nested items "2(a)" and "2(a)i", across documents too. Site: an item link reads "Item 2" |
| `unnumbered-refs` | a reference to a target LaTeX does not number (a paragraph, a code block, an `:enumerated: false` equation, an uncaptioned figure, a heading or equation a numbering key turns off, a `:nonumber:` proof, a solution) prints a bare "Paragraph" or "Equation", or a wrong number: `[Solution %s](#sol)` prints the enclosing section's | `??label` and a build warning; worded links keep their words, a bare link to a heading prints its title, and one to a solution the site's "Solution to Exercise 1", linked to it |
| `missing-refs` | `[](#x)` to an undefined label prints nothing, so no `??` gate sees it | `??x` and a build warning. A label defined by `\label{x}` in a raw LaTeX block of the page resolves to `\ref{x}` with its environment's word |
| `label-case` | `\ref` takes the link's spelling while a proof lowercases its `\label`, so a mixed-case label works on the site and prints `??` | every `\ref` and `\hyperref` takes the label its target writes |
| `stacked-labels` | of stacked `(a)=` and `(b)=` lines, or a `(a)=` line above a directive's `:label: b`, one label survives; links to the other print nothing and fail on the site | links to the lost label point at the survivor, in every page. Site |
| `raw-refs` | a MyST link inside a `{raw} latex` block reaches the PDF verbatim | the link is resolved, across documents too, and written as any other link |
| `section-numbering` | a numbering key set false (`headings`, `heading_N`, `equation`, `all`, in the page or `myst.yml`) unnumbers the site's headings or equations and never reaches the LaTeX | each such heading is set with `secnumdepth` lowered around it, and a numbered level below it skips it, as the site's "1.1" does; each such equation is `equation*`. A bare link to a heading a key numbers prints its number |
| `unnumbered-headings` | a heading cannot be unnumbered: `# Title {-}` prints "Title {-}" with a number, and the samples' single unnumbered appendix (`\section*`) cannot be written | a trailing `{-}` or `{.unnumbered}` gives `\section*{Title}`, inside `\begin{appendix}` "APPENDIX: TITLE"; a bare link prints its title, `%s` prints `??label`. Site: the suffix and the number go, later sections renumber |
| `page-links` | a link to another page is written `\href{/page}{...}`, a root-relative URL dead in a standalone PDF | the link's words; with `site.domains` in `myst.yml`, a page no LaTeX export holds gets `\href{https://<domain>/page}{...}` (`BASE_URL` between them when set) |

`xref` writes these forms:

| Link | Within one document | Into the sibling document |
| --- | --- | --- |
| `[](#sec-model)` | `Section~\ref{sec-model}`, top-level sections included | `Section 2`, as plain text |
| `[Sec %s](#sec-model)` | `Sec~\ref{sec-model}`, in the author's word | `Sec 2` |
| `[the model section](#sec-model)` | the words, linked with `\hyperref` | the words |
| `[Supplemental Material %s](#s-detail)` | | `Supplemental Material S1.1` |
| `[](#eq-supp)` | `(\ref{eq-supp})` | `(S1)` |
| `[](#app-a)`, for a section inside the appendix | `Appendix~\ref{app-a}` | `Appendix A` |

A cross-document reference has to be plain text: econsocart rejects `xr` and
`xr-hyper` with "Replace all references to external documents with plain text"
(`econsocart.cfg`). MyST resolves the target from the sibling's own numbering only
when both documents are pages of one MyST project.

Limitations:

- `xref` prints MyST's numbering of the sibling document, while that document's PDF
  prints LaTeX's, so the two must number alike. For a supplement numbered `S1`, set
  `numbering: {enumerator: S%s}` in its frontmatter and
  `\renewcommand{\thesection}{S\arabic{section}}` in its LaTeX. Under the `seceqn`
  class option LaTeX numbers equations by section and MyST does not, so a reference to
  an equation in the other document prints the wrong number.
- A cross-document link whose text holds math or markup prints `??`, with a warning:
  the plugin cannot write that text as LaTeX. Keep such link text plain.
- A bare link to a top-level section gains its number only on a page with at least one
  numbered heading. Use the object form `numbering: {headings: true}`: upstream
  discards the boolean `numbering: true` in page frontmatter, the second cause #3035
  fixes.
- `xref` finds the appendix from a raw `\begin{appendix}` (or `\appendix`) block in the
  same page, or from the page's `appendix` part, the two forms the main README
  describes.
- A nested item reads "2(a)" whatever markers the theme draws.
- `stacked-labels` reads the `.md` sources, and only targets on consecutive lines. It
  does not write a second `\label`, so a hand-typed raw `\ref` to the lost name still fails.
- `section-numbering` maps `heading_N` to a heading by its rank among the page's
  heading depths, shifted by a numbered `title`, as the site does for a page at the top
  of the table of contents. It skips a frontmatter part, and leaves `subequation` and a
  `start` alone.
- `unnumbered-headings` catches `{-}` only at the end of the heading's last text, so a
  heading that ends in math or a role keeps it.
- `page-links` ignores the URL path of a site not on its own domain unless `BASE_URL` is
  set for the build. A link holding only an image is left to `linked-images` and stays
  `\href{/...}`.
- These repairs add fields the site does not render (`texLabel`, `texItem`,
  `texPhantom`) to nodes in the site JSON.

### Citations

| Repair | Released mystmd | With the repair |
| --- | --- | --- |
| `citation-forms` | every citation becomes `\citet`, `\citep`, or `\cite`: prefix and suffix notes are dropped, `{cite:author}`, `{cite:year}`, and `[-@k]` print in full, and a `{cite:alp}` outside a group prints textually | natbib commands printing what the site prints: `\citep[e.g.][pg. 22]{k}`, `see \citet[p. 3]{k}`, `\citeauthor{k}`, `\citeyearpar{k}` (the site prints "(1987)"), `(\citeauthor{k})` for `{cite:authorpar}`, `\citealp{k}`; the starred and capital roles (`{cite:ps}`, `{cite:ts}`, `{cite:ct}`, `{cite:authors}`, `{cite:cauthor}`, `{cite:alps}`), read back from the source, as `\citep*`, `\citet*`, `\Citet`, `\citeauthor*`, `\Citeauthor`, `\citealp*`. Warns when a note holds `@key`: `[@a, prose @b]`, with a comma where `;` belongs, is one cite of `b`, and its note prints `@a` raw (stock dropped the note, and the citation of `a` with it) |
| `part-citations` | a citation only in a frontmatter part (an `abstract:`, an acknowledgement file, an appendix part) reaches the `.tex` and misses `main.bib`, so the PDF prints `?` ([#3032](https://github.com/jupyter-book/mystmd/issues/3032), fix [#3033](https://github.com/jupyter-book/mystmd/pull/3033)) | the part's keys join `main.bib` after the body's, as #3033 orders them. Site: its reference list shows the part-only keys too |
| `doi-links` | a doi.org link with its own words or an image, such as a Zenodo badge, becomes a citation of the fetched record, plus a bogus References entry | the link stays a link, `\href{https://doi.org/...}{words}`. Site |
| `authored-bib` | `main.bib` is re-serialized from citation-js: every capitalized title word is braced, so qe.bst, te.bst and econsoc.bst print reference titles in Title Case where they set sentence case; `@incollection` becomes `@inbook`, dropping the book and its editors; accent macros break (`Rodr\'{\i}guez` loses its accent); a key cited only in raw LaTeX prints `?` | the page's cited entries copied verbatim from the paper's own `.bib` files (with their `@string`s and `crossref` parents) into the `.tex` as `filecontents*` (`\jobname-econsoc.bib`) for BibTeX to read in place of `main.bib`; the `.tex` is then self-contained. The build warns of a title word with two capitals outside braces (`DSGE`, `HardNet`), which sentence case lowercases |

natbib takes one note pair per command, so a group of citations becomes one command
only when the prefix belongs to the first key and the suffix to the last. Otherwise
each item is written alone, `(\citealp[see][p. 3]{a}, \citealp[also][ch. 2]{b})`,
joined with ", " because econsocart sets natbib's separator to a comma.

Limitations:

- The starred and capital roles are matched to the source by line, so a role inside
  `{include}`d content, or a line mixing an emphasized role with a bare one, keeps the
  plain form. On the site they print the plain form, and the items of a multi-key
  `{cite:alp}` run together. `{cite:label}` prints as `{cite:t}` on both.
- `authored-bib` keeps `main.bib` for the whole page, with a warning that lists the
  keys, when a cited key is in no authored `.bib` (a DOI fetched from doi.org), and for
  a page in a multi-article export, whose one `.tex` per article would overwrite the
  shared file. It reads the project's `bibliography:` list, or as MyST does every `.bib`
  under the project, and ignores a page's own `bibliography:` and `extends:`.
- The site drops a year citation's prefix and an author citation's suffix; the LaTeX
  keeps both.
- The commands assume natbib, the template's citation package.
- `part-citations` reads `.md` pages only, so it misses a part given as a URL or set in
  an export entry. Like #3033, it ignores project-level parts in `myst.yml`, which
  render into no page's LaTeX. It changes the site's list too, because MyST builds that
  list and `main.bib` from one object without telling a plugin which it serves.
  Without the plugin the site shows the abstract's citations and leaves them out of
  its references, the same bug in HTML.
- `doi-links` recognizes doi.org hosts, `doi:`, and bare DOIs, and does not apply under
  `settings.infer_dois_from_urls`. Between its two stages it holds a placeholder URL,
  which `myst build --check-links` checks in place of the DOI.

### Proofs and exercises

| Repair | Released mystmd | With the repair |
| --- | --- | --- |
| `proof-kinds` | `{prf:assumption}`, `{prf:algorithm}`, `{prf:criterion}`, and `{prf:property}` are dropped with their `\label`, so references print `??` ([#3030](https://github.com/jupyter-book/mystmd/issues/3030), fix [#3031](https://github.com/jupyter-book/mystmd/pull/3031)) | `\begin{assumption}[Title]\label{...} ... \end{assumption}` in the template's environments, numbered by its counters; the main README's `{prf:axiom}` workaround is then unnecessary |
| `proof-titles` | a title holding math, an abbreviation, a role or a `{prf:ref}` spills into the body ("Theorem 1 ( Regularity). EGM", "Proof of . Proposition 1"); an untitled proof takes the title of a proof nested in it; an untitled, unlabelled block whose body opens with `[` reads that text as its title; a `%`, `&`, or `]` in a title breaks the build | the title rendered from all its children, `\begin{proof}[Proof of Proposition~\ref{p}]` |
| `claim-fact` | `{prf:claim}` and `{prf:fact}` are unknown: the site shows an "Unknown Directive" box, the PDF gets nothing, the log says nothing | both are proof directives: `\begin{claim}[Title]\label{...}` (numbered) and `\begin{fact}` (unnumbered). Site: a "Claim 1" or "Fact" box |
| `unnumbered-proofs` | `:nonumber:` on a proof is ignored in LaTeX: the site prints "Claim", the PDF "Claim 2" | the kind's starred environment, `\begin{claim*}[Title]\phantomsection\label{...}`, which template.tex defines for every kind |
| `exercises` | `{exercise}` and `{solution}` are dropped whole, every `\label` inside included | `\begin{exercise}[Title]\label{...}`, `exercise*` under `:nonumber:`, and `\begin{solution}{Solution to Exercise~\ref{...}}\phantomsection\label{...}`, whose anchor a worded link reaches; a `:hidden:` block stays out of the LaTeX |
| `algorithm-lines` | the `algorithmic` lines of a `.tex` source page are dropped, logging `Unhandled LaTeX conversion for node of "algorithmLine"` per line | `\begin{algorithmic}[1]` with one `\State` per line, indented by depth |

Limitations:

- Upstream numbers lemmas from 1 on the site and on the theorem counter in the PDF
  ("Lemma 2").
- An exercise nested inside a block that another repair renders is not written.
- `algorithm-lines` meets only `.tex` source pages: no Markdown syntax makes these
  nodes. The parser has already flattened `\While{c}` into the line "**while** c
  **do**", so the PDF shows those words with line numbers, without algpseudocode's
  macros. The first line prints on the "ALGORITHM 1" heading line, as amsthm sets a
  list at the start of a theorem.

### Running text

| Repair | Released mystmd | With the repair |
| --- | --- | --- |
| `footnotes` | a footnote in a figure or table caption, or in a table cell, prints its mark and loses its text; a footnote referenced twice prints its body twice, under two numbers | `\footnotemark[...]` at the reference and `\footnotetext[...]` after the float or table; a repeated footnote is `\footnote{...\label{fn:id}}` the first time and `\footref{fn:id}` after |
| `math-labels` | a labelled `{math}` holding `align`, `gather`, `multline`, `alignat`, or `flalign` loses its `\label`, so `[](#eq)` prints "(??)"; a per-row `\label{}` inside is stripped | the node's `\label` on the last row and each row's own label restored from the source; `missing-refs` then resolves a link to a row as `(\ref{x})` |
| `text-symbols` | a minus sign (U+2212) or a hyphen opening a number prints as a hyphen, "-0.30" where the samples write `$-$0.30`; an arrow (U+2190 to U+21D4) is written as a math command in text mode, "Missing $ inserted"; three periods stay three periods | `$-$`, `$\rightarrow$` (and the other arrows), `\ldots{}` |
| `abbreviation-spaces` | Theoretical Economics keeps `\nonfrenchspacing`, so "e.g. this" gets a sentence space after the period | `e.g.\ this`, after a closed list of abbreviations; `etc.`, `et al.`, and the like only when no capital follows |
| `quotes` | an attribution (`> -- Name` after a blank `>` line) makes a `figure` with `\caption*`; econsocart ignores the star, prints a phantom "FIGURE 0." and floats the quote away from its paragraph | `\begin{quote} ... \par\hfill---Name\end{quote}` in place, `quotation` for two or more paragraphs |
| `quotations` | econsocart's `quote` sets a blockquote of two or more paragraphs with its paragraph breaks hidden | `\begin{quotation}`, each paragraph indented |
| `text-roles` | Markdown lacks a syntax for sans serif or the TeX logos | new roles: `` {sf}`x` `` writes `\textsf{x}`, `` {logo}`LaTeX` `` (also `TeX`, `LaTeX2e`) writes `\LaTeX{}`. Site: a sans-serif span, the logo's name |
| `enumerate-labels` | a list cannot be labelled (i), (a) or (A) | a new `{enumerate}` directive, `:::{enumerate} (i)`, writing `\item[{(i)}]`, with `\ref` and links to an item printing its label. Site: each item opens with its label |
| `smallcaps` | `{sc}` and `{kbd}` text vanishes, logging `Unhandled LaTeX conversion for node of "smallcaps"` (or `"keyboard"`) | `\textsc{...}` and `\texttt{...}` |
| `linked-images` | an image inside a link, such as a DOI badge, ends with myst-to-tex's blank line, a paragraph break inside `\href{...}{...}`: "Paragraph ended before \href@split was complete", and latexmk carries on in force mode with the link broken | the link's LaTeX with each image written inline, `\href{...}{\includegraphics[height=1em]{...}}`: an image with no width of its own takes text height, where myst-to-tex's `0.7\linewidth` set a badge as a figure-sized box in the line. The site keeps the link |
| `list-start` | an ordered list from 3 prints from 1 because econsocart reads myst-to-tex's `[resume]` as a label width; a numbered list in a table cell prints from 0 | `\begin{enumerate}\setcounter{enumi}{2}`, at the list's nesting level, and `3.~~` items in a cell. Site: a link to an item of such a list reads "Item 3" |
| `inline-raws` | every repair above made in running text breaks the website paragraph around it | the span described in [Raw nodes](#raw-nodes) |

Limitations:

- A footnote's text prints on the page where the float is written in the source, so a
  figure that floats to a later page leaves its note behind. Marks written by
  `\footnotemark[N]` are not hyperlinked. A multi-paragraph footnote in a caption puts
  a `\par` in the caption argument, as before the repair. A footnote inside `{kbd}`
  text is not repaired.
- A `:label:` on an attributed quote is dropped: there is nothing to number.
- `list-start` misses a list inside a footnote's text, which `footnotes` writes before it.
- `{kbd}` keeps its node for the site's key box, so the log still shows the
  `"keyboard"` line, from the `\iffalse` copy, though the PDF is right. Small caps
  inside an italic theorem body log a font substitution (`T1/put/m/scit`).
- `math-labels` skips starred environments, `:enumerated: false` and table cells; a
  display from an `{include}`d file gets only its node's label. On the site a link to a
  row's label prints empty, as in stock MyST.
- `text-symbols` leaves the hyphen in `$x$-1` and in table cells, which `table-columns`
  writes. `abbreviation-spaces` keeps a closed list and does not set `\@` after a
  capital at a sentence's end.
- `enumerate-labels` draws the site's labels with the theme's Tailwind classes, and the
  list loses the prose spacing; items nested under a labelled item get
  `target-labels`' "1(a)" numbers; Typst does not get the labels.

### Floats, macros and parts

| Repair | Released mystmd | With the repair |
| --- | --- | --- |
| `raw-tables` | a `{table}` wrapping a raw tabular writes the tabular inside `\caption{}`, flush left | `\caption{...}\label{...}` and then the tabular, in the table float |
| `table-columns` | a pipe table gets equal-width `p{}` columns, so a column of short numbers takes as much room as one of sentences; an HTML table with a `colspan` writes `NaN\linewidth` into the column spec and stops LaTeX (no PDF, exit 0), a `rowspan` shifts the cells; a negative number prints a hyphen | `l`, `c`, or `r` for short columns, `tabularx` `X` columns for text, number columns right-aligned under centred headers as in the samples; `\multicolumn`, `\multirow`, and `\cmidrule` for spans; `$-$` in cells |
| `table-notes` | the paragraphs under a `{table}` print inside its title, merged into `\caption` | the caption alone, and the notes after the tabular as one `\legend{}`, which econsocart prints as "Note:" under the table |
| `subfigures` | a `{figure}` of panels nests a figure per panel and gives its label to a panel: "Not in outer par mode", `\ref` prints `??`; a panel's notes are lost | one float of `subfigure` panels of any content (images, tables, nested panels lettered as on the site, panel notes); a `{table}` of tables as `subtable`s with captions above and a `\legend` |
| `boxed-floats` | a figure or table inside an admonition (a `framed` box) or an `{epigraph}`: "Not in outer par mode", the float is lost, references print `??` | the float moves to just after the outermost box |
| `block-breaks` | the paragraph after a theorem, a quote, an exercise or any block a repair rewrote runs on from `\end{...}`, unindented, as the same paragraph: myst-to-tex's proof handler writes `\end{theorem}` and stops (`proof.js`), and a repair's raw block ends where its LaTeX ends | a LaTeX-only blank line after each native proof and each raw node with children in block content; the site draws it as an empty span. No upstream issue is filed |
| `macros` | myst-to-tex does not define a `math:` macro used only in raw LaTeX, or in a block a repair renders; xelatex stops at the raw block, far from the cause | one `\providecommand` per macro the raw LaTeX uses, at the start of the page |
| `part-headings` | headings in a frontmatter part are demoted one level (`#` becomes `\subsection`), so an appendix part loses its letters ([#2351](https://github.com/jupyter-book/mystmd/issues/2351), fix [#2352](https://github.com/jupyter-book/mystmd/pull/2352)) | the part's headings at the page's depth: `# Title` in an appendix part prints "APPENDIX A: TITLE" |
| `ignored-images` | an image that exists locally but is gitignored builds here and is missing from a clean checkout, in CI or for a coauthor | a build error giving the image's path. `myst build --site --strict` then exits 1; tex and pdf exports still exit 0 |

Only boxes break a float: a figure inside a plain blockquote or a list item compiles.
MyST already reports an image missing from disk ("Cannot find image");
`ignored-images` reports the gitignored image present locally.

Limitations:

- `macros` reads `project.math` from the nearest `myst.yml` with a `project:` key and
  the file's own frontmatter `math:`. It does not follow `extends:`. A file part uses
  its own frontmatter instead of its page's. A definition placed inside the abstract is
  local to that environment.
- `raw-tables` always puts the caption first. Notes from the legend follow the tabular
  as `\legend{}`.
- `table-columns` gives a table too wide for natural columns MyST's equal `p{}`
  columns, with the span and minus fixes. It estimates widths from character counts,
  leaves span cells out of the estimate, sets every span `c` (a span over `X` columns
  does not wrap), writes `\midrule` where MyST wrote `\hline`, and drops myst-to-tex's
  `\displaystyle` in table math. No MyST syntax sets a table `multipage`, so a long
  table cannot become a `longtable`.
- `table-notes` joins the notes with `\endgraf` (econsocart's `\legend` is not long),
  so the second starts unindented, and a list in the notes prints plain.
- `subfigures` sets non-image panel content at its natural width, which can overflow its
  share. Unlabelled nested panels letter after their inner ones, and MyST itself labels
  a nested figure's images in a way that can collide with sibling labels.
- `boxed-floats` does not handle a float inside a footnote.
- `part-headings` leaves MyST's enumerators at the old depth; LaTeX numbers its own
  headings, so only the LaTeX numbering changes.
- `ignored-images` checks gitignored files only; an untracked file, normal while work
  is in progress, passes. The check runs `git check-ignore` once per page.

## Upstream reports already settled

- [#711](https://github.com/jupyter-book/mystmd/issues/711), a DOI citation with no
  authors and a citekey like `2010`: mystmd 1.12.0 fixes it when the DOI matches an
  entry of a loaded `.bib`, whose key the citation then takes, with no doi.org fetch. A
  DOI found in no `.bib` still gets the doi.org record, whose missing authors a plugin
  cannot supply.
- A multi-key `{cite}` prints narratively, "Aumann (1987), Nash (1950)," on the site
  and in the PDF alike, as the MyST documentation intends ("The default citations are
  narrative"). Write `{cite:p}` for a parenthetical citation.

## Changes on adoption

- A worded link to a numbered target prints the author's words. Under stock mystmd,
  `[the closure above](#sec-ge-closure)` printed "Section 6.1"; with the plugin it
  prints "the closure above", as the site does. Write `[Section %s](#sec-ge-closure)`
  where the number should print.
- `??label` and a build warning, naming the label to fix, appear where stock mystmd
  printed nothing or a wrong number (`unnumbered-refs`, `missing-refs`).
- Paragraphs after theorem-like blocks, quotes, and exercises are indented
  (`block-breaks`).
- A `:nonumber:` proof, a heading or equation a numbering key turns off, and a list's
  start print in the PDF as on the site (`unnumbered-proofs`, `section-numbering`,
  `list-start`). A bare link to a solution prints "Solution to Exercise 1" in place of
  `??label`.
- Reference titles print in the sentence case the journal's style sets, from the
  paper's own `.bib`, and the `.tex` carries those entries (`authored-bib`). A title
  that must keep a capital needs braces in the `.bib`, `{Bayesian}`, as in hand-written
  LaTeX.
- Tables set number columns right-aligned under centred headers, minus signs print as
  minus signs, and table notes print as "Note:" under the table (`table-columns`,
  `text-symbols`, `table-notes`). Links to other pages print as their words
  (`page-links`).
- The `.tex` holds an `\iffalse ...\fi{}` copy after each repaired inline node
  ([Raw nodes](#raw-nodes)).
- The site changes where the tables mark "Site": claim and fact boxes, DOI links that
  stay links, item links that read "Item 2" or an `{enumerate}` label, item links that
  count from a list's start, stacked labels that resolve, part-only keys in the
  reference list, `{-}` headings without a number, and the new roles and directive.

## Building

`econsoc.mjs` is generated: `build.mjs` bundles `src/index.mjs`, the repairs it lists
(`refs.mjs`, `citations.mjs`, `proofs.mjs`, `text.mjs`, and `floats.mjs`, one per section of
this README, helpers in `src/util.mjs`), and the exact versions in
`package.json`. Never edit the bundle. Rebuild it with
`cd plugins && npm ci && npm run build`; `node build.mjs --check` fails when the
committed bundle differs from a fresh build. To try a repair in isolation, bundle
another entry point, `node build.mjs --entry <index.mjs> --outfile <scratch.mjs>`, and
list that file in a scratch project.

## Checks

`scripts/check-plugins.sh` builds the fixture project in `tests/plugins/` with the
plugin loaded: an article and its supplement, an unnumbered page (`nonum.md`), a
`.tex` source page (`algo.tex`) and a frontmatter part (`ack.md`). It fails if the
committed bundle does not load, is stale against its source, or was built for another
mystmd. It asserts the emitted LaTeX, `main.bib` and the site
pages: a `jq` pass finds any `raw` node with children left in phrasing content, and a
scan of the `.tex` finds text that runs on after the `\end` of a theorem-like
environment or a quote (`block-breaks`). The full run checks the template's own
lines too: the author particle and suffix, the upright definition style, emphasis in
theorems, curly frontmatter quotes and letters past Latin-1. A rejection run per repair then rebuilds the
fixture with that repair switched off and requires the repair's own assertions to
fail; when they pass, a mystmd release has fixed the bug and the check says to delete
the repair. With `--pdf` it also compiles the fixture and checks the PDF text: each
document prints the numbers the other gives it, and no bare `?` prints. Any LaTeX-log
line that marks a run gone wrong at exit 0 fails the check: an error latexmk forced
through, an undefined or multiply defined reference, or "Not in outer par mode".
