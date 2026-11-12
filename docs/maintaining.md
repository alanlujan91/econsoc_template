# Maintaining the template

Development setup and pull-request conventions are in
[CONTRIBUTING](../.github/CONTRIBUTING.md).

## Quality Assurance

### Pre-commit Hooks

Pre-commit hooks run automatically before each commit. They check:

- Template structure validation (`jtex check`, which also requires every file
  in `template.yml` and the thumbnail to exist)
- Sample PDF compilation
- ASCII-only source files (no unicode/smart quotes)
- Whitespace/line ending fixes

**Manual commands**:

```bash
# Run all hooks on all files
pre-commit run --all-files

# Auto-fix template.yml packages
pre-commit run jtex-autofix --hook-stage manual
```

### Continuous Integration

GitHub Actions run on every push and pull request, and weekly, because CI
installs the latest `mystmd` and the plugin `plugins/econsoc.mjs` depends on its
internals.

| Job                       | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| **validate-template**     | Runs `jtex check` (listed files and thumbnail exist) and asserts every declared package is loaded |
| **check-escaping**        | Runs `scripts/check-escaping.sh` and its self-test               |
| **build-pdf**             | Compiles every sample export with TeX via `scripts/build-samples.sh`, gates the logs, diffs the PDF text against the committed artifacts, and runs `scripts/check-plugins.sh --pdf` |
| **check-ascii**           | Runs the pre-commit `check-ascii` hook                           |
| **test-options**          | Renders each boolean option, `extra_packages`/`open_access`, and every journal, preprint, and supplement leg to LaTeX, asserting the class options and `\bibliographystyle` |
| **check-upstream-drift**  | Fails if `scripts/sync-vendored.sh --check` finds a vendored root file diverging from the pinned `original/*` submodules. Then runs its self-test `scripts/selftest-sync-vendored.sh` (see [Vendoring is verbatim](../docs/template-internals.md#vendoring-is-verbatim-by-design)) |

View results: [Actions tab](https://github.com/alanlujan91/econsoc_template/actions)

### Local Testing

Preview the documentation (the repository root) and the sample (its own project in
`sample/`) locally:

```bash
myst start
(cd sample && myst start)
```

Build the sample PDFs and check them:

```bash
scripts/build-samples.sh
```

To regenerate the committed `sample/exports/`, follow
[Rebuilding the sample exports](../docs/template-internals.md#rebuilding-the-sample-exports).

Test the plugin against its fixture, compiling the PDFs too:

```bash
scripts/check-plugins.sh --pdf
```

Run specific validation:

```bash
# Validate template structure
npx jtex check

# Check for unicode/smart quotes (the same hook CI runs)
pre-commit run check-ascii --all-files
```

## Upstream Synchronization

This template tracks all three official Econometric Society LaTeX templates as git submodules:

| Submodule       | Upstream                                                                       | Default branch |
| --------------- | ------------------------------------------------------------------------------ | -------------- |
| `original/ecta` | [texsupport.econometricsociety-ecta](https://github.com/vtex-soft/texsupport.econometricsociety-ecta) | `master` |
| `original/qe`   | [texsupport.econometricsociety-qe](https://github.com/vtex-soft/texsupport.econometricsociety-qe)     | `main`   |
| `original/te`   | [texsupport.econometricsociety-te](https://github.com/vtex-soft/texsupport.econometricsociety-te)     | `master` |

### Which file comes from where

`econsocart.cls` and `econsocart.cfg` are **one shared file** used by all three
journals, but the three upstreams re-release it independently. The vendored copy
therefore comes from whichever submodule carries the newest `\ProvidesClass` /
`\ProvidesFile` date. The `.bst` files are journal-specific and always come from
their own upstream.

`scripts/sync-vendored.sh` is the single place that rule lives; both the sync
workflow and the `check-upstream-drift` CI job call it, so neither has to
hardcode a journal.

```bash
scripts/sync-vendored.sh           # re-vendor the root files
scripts/sync-vendored.sh --check   # verify them (what CI runs)
```

### Automatic Updates

`.github/workflows/sync-upstream-template.yml` checks for upstream changes every Monday at 9 AM UTC:

1. Fetches each submodule and advances any whose default branch moved
2. Re-vendors the root files via `scripts/sync-vendored.sh`
3. Creates one pull request covering every submodule that moved, for review before merging
4. Labels the PR as `dependencies` and `automated`

**Manual trigger**: Navigate to [Actions -> Sync Upstream](https://github.com/alanlujan91/econsoc_template/actions/workflows/sync-upstream-template.yml) and click "Run workflow"

The upstream repositories belong to `vtex-soft` and send this repository no
events, so GitHub cannot fire a workflow here when they are pushed to; the
schedule is the only way to notice upstream movement. `check-upstream-drift`
complements it on every push and pull request, failing if a submodule pointer
moved without the vendored files being re-synced.

### Manual Sync Process

```bash
# Update every submodule to its upstream default branch
git submodule update --remote

# Re-vendor the root files (picks the newest shared class/cfg automatically)
scripts/sync-vendored.sh

# Test the changes
scripts/build-samples.sh

# Commit if successful
git add original econsocart.cls econsocart.cfg qe.bst te.bst econsoc.bst
git commit -m "chore: sync with upstream Econometric Society templates"
```

## Making Changes

### Template Files

When modifying template files:

1. **`template.tex`**: Main template with Jinja2 syntax
   - Test with `draft` both on and off
   - Ensure all placeholders work correctly
   - **Never write a jtex token in a comment.** jtex substitutes `[-...-]`
     (expressions) and `[# ... #]` (blocks) everywhere, including inside `%`
     LaTeX comments, which jtex cannot see. Writing e.g. `[-IMPORTS-]` in a
     comment expands it a second time and breaks the build. Describe tokens in
     prose ("the imports placeholder") instead.
2. **`template.yml`**: Template configuration
   - Run `jtex check` after changes
   - Use `jtex check --fix` to auto-add missing packages
   - **Packages rule**: the `packages:` list must contain only packages the
     template actually loads (via `econsocart.cls` or an explicit `\usepackage`
     in `template.tex`). MyST auto-injects the packages its own content needs at
     `[-IMPORTS-]`; declaring one of those without also loading it *suppresses*
     that injection and breaks the build. The groups of packages, and the ones
     excluded, are listed in the [MyST authoring](myst-authoring.md#latex-packages). A package
     added to the pre-loaded group is loaded in `template.tex` AND declared in
     `packages:`. Verify it loads under `econsocart` *with a bibliography
     present*: that is how `csquotes` was found to clash via `\enquote`.
3. **Class files**: Only update from upstream, don't modify directly
   - `econsocart.cls`, `econsocart.cfg`, `econsoc.bst`, `qe.bst`, `te.bst`
   - Re-vendor with `scripts/sync-vendored.sh` rather than copying by hand;
     `check-upstream-drift` enforces that the root copies match the pinned
     submodules.
4. **`plugins/`**: the econsoc plugin
   - Edit `plugins/src/` (one module per README section, one named export per repair, shared helpers in `util.mjs`),
     never the generated `econsoc.mjs`. Rebuild it with
     `cd plugins && npm ci && npm run build`; CI fails on a stale bundle.
   - A new repair joins the order in `src/index.mjs` and gets a fixture case in
     `tests/plugins/` whose assertions in `scripts/check-plugins.sh` fail with the
     repair switched off. The check enforces that rule for every repair.
   - MyST loads a package only for content it renders itself. A package that LaTeX
     written whole by the plugin may need is loaded in `template.tex` and declared in
     `packages:` instead, as `framed` and `ulem` are. Repair details:
     [plugins/README.md](../plugins/README.md).

### Sample Document

The sample document demonstrates all template features:

- **`sample/article.md`**: Main sample document
- **`sample/supplement.md`**: Supplementary-material example (`supplement: true`)
- **`sample/appendix.md`**: Appendix example, spliced into the article body as described in [MyST authoring, Appendices](myst-authoring.md#appendices)
- **`sample/references.bib`**: Bibliography example

The sample's text is the upstream samples' own, written in MyST:
`original/qe/qe_sample.tex`, with `original/ecta/ecta_sample.tex` and
`original/te/te_sample.tex` for the other two journals, and the `*_supp_sample.tex`
files for the supplement. A note about MyST's behaviour goes in `docs/`. `scripts/check-fidelity.py` scores each exported `.tex` against its
upstream sample and fails CI when a score falls below its floor in
`scripts/fidelity-floors.json`; after a change that raises a score,
`scripts/check-fidelity.py --update` raises the floor.

### Documentation

- **`README.md`**: Overview, quick start, and the index of `docs/`
- **`.github/CONTRIBUTING.md`**: Development setup and pull-request guidelines
- **`docs/template-options.md`**: Export options and journal conventions
- **`docs/myst-authoring.md`**: What MyST writes for each construct, and its limitations against the hand-written templates
- **`docs/plugin-repairs.md`**: The plugin's repairs, one row each, with their limitations and checks
- **`docs/troubleshooting.md`**: Compilation errors and their fixes
- **`docs/maintaining.md`**: This file
- **`docs/template-internals.md`**: Maintainer notes on the silent traps `template.tex` works around
- **`plugins/README.md`**: Enabling and building the plugin
- **Workflow files**: Document changes inline with comments

## Workflow Files

`.pre-commit-config.yaml` defines the pre-commit hooks, each with a comment on its
purpose and any special configuration. `.github/workflows/ci.yml` runs the jobs in
[Continuous Integration](#continuous-integration);
`.github/workflows/sync-upstream-template.yml` runs the
[Automatic Updates](#automatic-updates), on schedule or on demand from the Actions
tab.

## Troubleshooting

### Common Issues

**LaTeX compilation fails**:
- Check for unicode/smart quotes: `pre-commit run check-ascii --all-files`
- Verify all `\begin{}` have matching `\end{}`
- Ensure bibliography file exists and is valid

**Template validation fails**:
- Run `jtex check` for detailed errors, and `jtex check --fix` for package issues
- Check that all files in `template.yml` exist

**Pre-commit hooks fail**:
- Read the error message carefully
- Many hooks auto-fix issues (trailing whitespace, line endings)
- Run `pre-commit run --all-files` to see all issues

**PDF has incorrect output**:
- Check for curly apostrophes (') instead of backslashes (\)
- Verify raw LaTeX blocks use proper syntax
- Build the sample locally (see [Local Testing](#local-testing))
