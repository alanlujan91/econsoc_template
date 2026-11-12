# MyST plugin for the Econometric Society template

`econsoc.mjs` holds every repair this template has for a LaTeX-export bug in released
mystmd (1.13.0). Each bug passes silently: the build exits 0 and the PDF is wrong.
Four have an upstream fix in an unmerged pull request
([#2352](https://github.com/jupyter-book/mystmd/pull/2352),
[#3031](https://github.com/jupyter-book/mystmd/pull/3031),
[#3033](https://github.com/jupyter-book/mystmd/pull/3033),
[#3035](https://github.com/jupyter-book/mystmd/pull/3035)); the rest have none.
Delete a repair once a mystmd release fixes its bug; `scripts/check-plugins.sh` says
when ([Checks](../docs/plugin-repairs.md#checks)). [Plugin repairs](../docs/plugin-repairs.md)
gives each repair, the LaTeX it writes, and its limitations.

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

## Building

`econsoc.mjs` is generated: `build.mjs` bundles `src/index.mjs`, the repairs it lists
(`refs.mjs`, `citations.mjs`, `proofs.mjs`, `text.mjs`, and `floats.mjs`, one per section of
[Plugin repairs](../docs/plugin-repairs.md#repairs), helpers in `src/util.mjs`), and the
exact versions in `package.json`. Never edit the bundle. Rebuild it with
`cd plugins && npm ci && npm run build`; `node build.mjs --check` fails when the
committed bundle differs from a fresh build. To try a repair in isolation, bundle
another entry point, `node build.mjs --entry <index.mjs> --outfile <scratch.mjs>`, and
list that file in a scratch project.
