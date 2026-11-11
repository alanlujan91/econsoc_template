# MyST plugins for the Econometric Society template

Three MyST plugins repair LaTeX-export bugs that released mystmd (1.12.0) commits
silently, at exit 0. Each bug has an upstream fix in an open pull request. Delete a
plugin once a mystmd release contains its fix.

| Plugin | Repairs | Upstream |
| --- | --- | --- |
| `xref.mjs` | references into a sibling document, link wording, top-level section numbers, the appendix label word | [#3035](https://github.com/jupyter-book/mystmd/pull/3035) (numbers only) |
| `part-citations.mjs` | citations that appear only in a frontmatter part (an `abstract:`, an acknowledgement file) | [#3032](https://github.com/jupyter-book/mystmd/issues/3032), [#3033](https://github.com/jupyter-book/mystmd/pull/3033) |
| `proof-kinds.mjs` | `{prf:assumption}`, `{prf:algorithm}`, `{prf:criterion}`, and `{prf:property}`, which the export drops with their labels | [#3030](https://github.com/jupyter-book/mystmd/issues/3030), [#3031](https://github.com/jupyter-book/mystmd/pull/3031) |

Each plugin replaces a node with a `raw` node. myst-to-tex writes that node's `tex`
field verbatim, while the website and Typst render its children, which hold the
original node. Only the LaTeX changes, with one exception noted under
`part-citations.mjs`.

## Enabling them

MyST loads plugins from the project's own `myst.yml` and from nowhere else, so an
export's `template:` cannot bring one along. Every paper lists them itself:

```yaml
project:
  plugins:
    - qe_template/plugins/xref.mjs
    - qe_template/plugins/part-citations.mjs
    - qe_template/plugins/proof-kinds.mjs
```

The paths are relative to `myst.yml`. The MyST documentation says a URL to the file
works too. Keep this order. Because `proof-kinds.mjs` renders each restored block's body
to LaTeX itself, `xref.mjs` must run before it, while the references inside are still
links.

A paper that omits a line still builds and exits 0, with the bug back. Look for the
plugin in the build log, which prints `Econsoc cross-references (...) loaded` and the
like for each one it loads.

## `xref.mjs`

Write ordinary MyST links. The PDF then prints:

| Link | Within one document | Into the sibling document |
| --- | --- | --- |
| `[](#sec-model)` | `Section~\ref{sec-model}`, top-level sections included | `Section 2`, as plain text |
| `[Sec %s](#sec-model)` | `Sec~\ref{sec-model}`, in the author's word | `Sec 2` |
| `[the model section](#sec-model)` | the words, linked with `\hyperref` | the words |
| `[Supplemental Material %s](#s-detail)` | | `Supplemental Material S1.1` |
| `[](#eq-supp)` | `(\ref{eq-supp})` | `(S1)` |
| `[](#app-a)`, for a section inside the appendix | `Appendix~\ref{app-a}` | `Appendix A` |

A cross-document reference has to be plain text. econsocart rejects `xr` and
`xr-hyper` with "Replace all references to external documents with plain text"
(`econsocart.cfg`). For MyST to resolve the target from the sibling's own numbering,
both documents must be pages of one MyST project.

### Limitations

- The plugin prints MyST's numbering of the sibling document, while that document's PDF
  prints LaTeX's. The two agree only when both documents number alike. For a supplement
  numbered `S1`, set `numbering: {enumerator: S%s}` in its frontmatter as well as
  `\renewcommand{\thesection}{S\arabic{section}}` in its LaTeX. Under the `seceqn` class
  option a reference to an equation in the other document prints the wrong number,
  because LaTeX then numbers equations by section and MyST does not.
- A cross-document link whose text holds math or markup prints `??`. The plugin leaves
  it alone with a warning, because it cannot write that text as LaTeX. Keep such link
  text plain.
- A bare link to a top-level section gains its number only on a page with at least one
  numbered heading. Use the object form `numbering: {headings: true}`. Upstream discards
  the boolean `numbering: true` in page frontmatter, the second cause #3035 fixes.
- The plugin finds the appendix from a raw `\begin{appendix}` (or `\appendix`) block in
  the same page, the form the main README prescribes.

## `part-citations.mjs`

A citation in a frontmatter part is written as anywhere else. The plugin reads the page's parts from disk and finds their citations with MyST's own grammar. It
adds those keys to the page's citations before MyST writes `main.bib`. On the upstream
PR's own fixture it produces the `main.bib` that PR expects.

### Limitations

- The website's reference list now shows the part-only keys too. MyST builds `main.bib`
  and that list from one object. A plugin is not told which of the two it is serving.
  Without the plugin the website shows the abstract's citations and leaves them out of
  its references, the same bug in HTML.
- The plugin reads `.md` pages only. It does not see a part given as a URL, a part set
  in an export entry, or a part written as a YAML flow mapping
  (`parts: {abstract: ...}`).
- Like #3033, it ignores project-level parts in `myst.yml`; they render into no page's
  LaTeX.

## `proof-kinds.mjs`

Write `{prf:assumption}` and the rest as usual. The website labels each block by its
kind. The PDF gets `\begin{assumption}[Title]\label{...} ... \end{assumption}`, numbered
by the template's own counters, which makes the `{prf:axiom}` workaround in the main
README unnecessary.

`proof-kinds.mjs` bundles myst-to-tex 1.0.48 with #3031's change to `proof.ts` applied,
built from `src/proof-kinds.mjs` by `build.mjs`. Rebuild it with
`cd plugins && npm ci && npm run build`. `node build.mjs --check` fails when the
committed bundle is stale.

### Limitations

- A math macro or package used only inside one of these blocks never reaches the
  preamble.
- A block title goes into the LaTeX unescaped, exactly as #3031 writes it. A `%` or
  `&` in a title therefore breaks the build.
- Images inside these blocks are untested.

## Checks

`scripts/check-plugins.sh` builds the fixture project in `tests/plugins/`, an article and
its supplement with all three plugins loaded, and asserts the emitted LaTeX, `main.bib`
and site pages. It then rebuilds the fixture once without each plugin and requires that
plugin's own assertions to fail; when they pass, a mystmd release has fixed the bug and
the check says to delete the plugin. With `--pdf` it also compiles the fixture and reads
the PDF text, checking that each document prints the numbers the other one gives it.
