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
- **Document parts**: abstract and acknowledgements/funding as frontmatter parts; appendices in the body, or as an appendix part with the plugin (see [Appendices](docs/myst-authoring.md#appendices))
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

This example sets no options, so it builds a neutral **preprint** in the default Quantitative Economics layout: no "Submitted to ..." banner. Set `journal: ecta` (or `te`) to typeset for another journal, and `preprint: false` when you actually submit. See [Which mode for which stage](docs/template-options.md#which-mode-for-which-stage).

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

The sample is also published as a website, at
<https://alujan.dev/econsoc_template/sample/>, and this documentation at
<https://alujan.dev/econsoc_template/>.

## Documentation

- [Template options](docs/template-options.md): the export options, the mode for each stage of a submission, and the conventions particular to Econometrica.
- [MyST authoring](docs/myst-authoring.md): the LaTeX MyST writes for each construct, the cases that need raw LaTeX, and the PDF's differences from the hand-written templates.
- [Plugin repairs](docs/plugin-repairs.md): each repair in `plugins/econsoc.mjs`, the LaTeX it writes, and the checks that prove it.
- [Troubleshooting](docs/troubleshooting.md): common LaTeX compilation errors and their fixes.
- [Maintaining the template](docs/maintaining.md): pre-commit hooks, CI, local testing, and upstream synchronization.
- [Template internals](docs/template-internals.md): the class traps `template.tex` works around.

## The econsoc plugin

Released mystmd (1.13.0) writes several constructs to LaTeX wrongly, each at exit 0;
[MyST authoring](docs/myst-authoring.md) lists them. `plugins/econsoc.mjs` repairs
them. A paper lists it in its own `myst.yml`, because MyST loads plugins from the
project and never from an export's `template:`:

```yaml
project:
  plugins:
    - qe_template/plugins/econsoc.mjs
```

The path is relative to `myst.yml`, here a copy of this repository at `qe_template/`.
Each repair, the LaTeX it writes, its limitations and what changes when a paper adopts
the plugin are in [Plugin repairs](docs/plugin-repairs.md). Each limitation in the
documentation gives the repair that removes it and keeps the workaround for a paper
without the plugin. The sample lists it in `sample/myst.yml`, and `sample/exports/`
shows the PDFs a paper that adopts it gets.

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

The documentation is the repository root's project and the sample is its own, in
`sample/`:

```bash
myst start
(cd sample && myst start)
```

Build the PDF as in [Quick Start](#quick-start).
[Troubleshooting](docs/troubleshooting.md) lists compilation errors and their fixes.

## Template Files

- `template.tex` - Main template file (Jinja2 syntax)
- `template.yml` - Template configuration and options
- `econsocart.cls` - Econometric Society document class (shared by all three journals)
- `econsocart.cfg` - Econometric Society class configuration (shared)
- `econsoc.bst` - Econometrica bibliography style
- `qe.bst` - Quantitative Economics bibliography style
- `te.bst` - Theoretical Economics bibliography style
- `thumbnail.png` - Template preview
- `docs/` - Documentation (listed under [Documentation](#documentation))
- `plugins/` - The econsoc plugin (`econsoc.mjs`, generated from `plugins/src/`); see [plugins/README.md](plugins/README.md)
- `sample/` - Complete working examples (main article and supplement)
- `scripts/sync-vendored.sh` - Re-vendors the files above from `original/*`
- `original/{ecta,qe,te}/` - Pinned upstream templates (git submodules)

[Maintaining, Which file comes from where](docs/maintaining.md#which-file-comes-from-where)
gives the submodule each vendored file comes from.

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
Econometric Society's names and marks belong to their owners. They
are used here only to identify the target journal of a submission. See the
unofficial notice at the top of this README.

- **MyST Tools**: [MyST Markdown](https://mystmd.org)

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup, workflow documentation, and guidelines.
