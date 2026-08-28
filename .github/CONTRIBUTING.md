# Contributing to the Econometric Society Journals MyST Template

Thank you for your interest in contributing to the Econometric Society Journals MyST Template!

## Development Setup

### Prerequisites

- Python with `uv` package manager
- Node.js with `npm` (for MyST)
- LaTeX distribution (TeX Live or similar)
- Git with submodules support

### Clone the Repository

This repository uses three git submodules to track the official Econometric Society LaTeX templates:

```bash
git clone --recurse-submodules https://github.com/alanlujan91/econsoc_template.git
cd econsoc_template
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

### Install Development Tools

```bash
# Install MyST
npm install -g mystmd
# or
uv tool install mystmd

# Install pre-commit
uv tool install pre-commit

# Enable pre-commit hooks
pre-commit install
```

## Quality Assurance

### Pre-commit Hooks

Pre-commit hooks run automatically before each commit to catch issues early.

**What gets checked**:

- ✅ Template structure validation (`jtex check`)
- ✅ Sample PDF compilation
- ✅ File existence verification
- ✅ Thumbnail presence
- ✅ ASCII-only source files (no unicode/smart quotes)
- ✅ Whitespace/line ending fixes

**Manual commands**:

```bash
# Run all hooks on all files
pre-commit run --all-files

# Auto-fix template.yml packages
pre-commit run jtex-autofix --hook-stage manual
```

### Continuous Integration

GitHub Actions run automatically on every push and pull request. **CI is
TeX-free**: it validates that the template *renders* valid LaTeX (which needs no
TeX toolchain). PDF *compilation*, which needs a full TeX install plus the
packages in `template.yml` `packages:`, is validated locally by the pre-commit
`build-sample-pdf` hook, where the author already has TeX. This keeps CI fast and
avoids pinning a heavy TeX distribution in the workflow.

| Job                       | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| **validate-template**     | Validates `template.yml`, checks files exist, verifies thumbnail |
| **render-samples**        | Renders the sample and supplement to LaTeX via `format: tex` (no TeX) |
| **test-template-options** | Renders `draft`/`seceqn`/`linenumbers`/`supplement` to LaTeX (no TeX) |
| **test-journal-options**  | Renders `preprint`/`qe`/`ecta`/`te` and asserts the class option and `\bibliographystyle` |
| **check-ascii**           | Ensures no unicode in source files                               |
| **check-upstream-drift**  | Runs `scripts/sync-vendored.sh --check`; fails if a vendored root file diverges from the pinned `original/*` submodules. Then runs `scripts/selftest-sync-vendored.sh`, which mutates a disposable copy nine ways and requires the guard to reject each one, so the job cannot pass merely because the guard stopped working |

View results: [Actions tab](../../actions)

### Local Testing

Preview the website locally:

```bash
myst start
```

Build sample PDF manually:

```bash
myst build sample/article.md --pdf
```

Run specific validation:

```bash
# Validate template structure
npx jtex check

# Check for unicode/smart quotes
grep -P "[^\x00-\x7F]" sample/*.md
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
journals, but the three upstreams re-release it independently. There is
therefore no fixed correct source: the vendored copy comes from whichever
submodule ships the newest `\ProvidesClass` / `\ProvidesFile` date. The `.bst`
files are genuinely journal-specific and always come from their own upstream.

`scripts/sync-vendored.sh` is the single place that rule lives; both the sync
workflow and the `check-upstream-drift` CI job call it, so neither has to
hardcode a journal.

```bash
scripts/sync-vendored.sh           # re-vendor the root files
scripts/sync-vendored.sh --check   # verify them (what CI runs)
```

### Automatic Updates

A GitHub Action checks for upstream changes every Monday at 9 AM UTC:

1. Fetches each submodule and advances any whose default branch moved
2. Re-vendors the root files via `scripts/sync-vendored.sh`
3. Creates one pull request covering every submodule that moved
4. Labels the PR as `dependencies` and `automated`

**Manual trigger**: Navigate to [Actions -> Sync Upstream](../../actions/workflows/sync-upstream-template.yml) and click "Run workflow"

**Why polling and not a push trigger**: the upstream repositories belong to
`vtex-soft` and send this repository no events, so GitHub cannot fire a workflow
here when they are pushed to. The schedule is the only way to notice upstream
movement. The complementary guard is `check-upstream-drift`, which runs on every
push and pull request and fails if a submodule pointer moved without the
vendored files being re-synced.

**Review required**: All updates go through pull requests before merging to ensure no breaking changes.

### Manual Sync Process

If you need to manually sync with upstream:

```bash
# Update every submodule to its upstream default branch
git submodule update --remote

# Re-vendor the root files (picks the newest shared class/cfg automatically)
scripts/sync-vendored.sh

# Test the changes
myst build sample/article.md --pdf

# Commit if successful
git add original econsocart.cls econsocart.cfg qe.bst te.bst econsoc.bst
git commit -m "chore: sync with upstream Econometric Society templates"
```

## Making Changes

### Template Files

When modifying template files:

1. **`template.tex`**: Main template with Jinja2 syntax
   - Test with both `draft` and `final` options
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
     in `template.tex`). MyST auto-injects the packages its own content needs
     (booktabs, longtable, graphicx, amsmath, amsthm, natbib, listings, siunitx,
     framed, xcolor, glossaries, ...) at `[-IMPORTS-]`. Declaring one of those
     without also loading it *suppresses* that injection and breaks the build.
     The template additionally pre-loads the set of packages MyST recognizes but
     does not auto-inject (algorithm, subcaption, multirow, mhchem, cleveref,
     ...), each loaded in `template.tex` AND declared in `packages:`, so raw-LaTeX
     content using them compiles. When adding one, verify it loads under
     `econsocart` *with a bibliography present* (that is how `csquotes` was found
     to clash via `\enquote`); `soul` and `algorithm2e` are excluded for the same
     reason.
3. **Class files**: Only update from upstream, don't modify directly
   - `econsocart.cls`, `econsocart.cfg`, `qe.bst`
   - The root copies are kept identical to the pinned `original/*` submodules;
     the `check-upstream-drift` CI job enforces this. Re-vendor with
     `scripts/sync-vendored.sh` rather than copying by hand.

### Sample Document

The sample document demonstrates all template features:

- **`sample/article.md`**: Main sample document
- **`sample/supplement.md`**: Supplementary-material example (`supplement: true`)
- **`sample/appendix.md`**: Appendix example (spliced into the article body with `include`, between raw LaTeX blocks opening and closing the `{appendix}` environment; not a `parts.appendix` entry, which would drop appendix-only citations)
- **`sample/references.bib`**: Bibliography example

**Important**: Keep `article.md` in sync with the original `original/qe/qe_sample.tex` as much as possible. The equivalent upstream samples for the other two journals are `original/ecta/ecta_sample.tex` and `original/te/te_sample.tex`.

### Documentation

- **`README.md`**: User-facing template documentation
- **`.github/CONTRIBUTING.md`**: This file (contributor documentation)
- **Workflow files**: Document changes inline with comments

## Workflow Files

### `.pre-commit-config.yaml`

Defines pre-commit hooks. Each hook includes:
- Description comment
- Purpose and usage
- Any special configuration

### `.github/workflows/ci.yml`

Main CI workflow (TeX-free). Tests:
- Template validation (`jtex check`)
- LaTeX rendering of the sample and supplement (`format: tex`, no compile)
- LaTeX rendering of each option (`draft`, `seceqn`, `linenumbers`, `supplement`)
- ASCII compliance
- Vendored-file drift against the pinned submodule

### `.github/workflows/sync-upstream-template.yml`

Automated upstream synchronization:
- Scheduled: Weekly (Monday 9 AM UTC)
- Manual: On-demand via Actions tab
- Creates PR when updates found

## Troubleshooting

### Common Issues

**LaTeX compilation fails**:
- Check for unicode/smart quotes: `grep -P "[^\x00-\x7F]" sample/*.md`
- Verify all `\begin{}` have matching `\end{}`
- Ensure bibliography file exists and is valid

**Template validation fails**:
- Run `jtex check` for detailed errors
- Use `jtex check --fix` to auto-fix package issues
- Check that all files in `template.yml` exist

**Pre-commit hooks fail**:
- Read the error message carefully
- Many hooks auto-fix issues (trailing whitespace, line endings)
- Run `pre-commit run --all-files` to see all issues

**PDF has incorrect output**:
- Check for curly apostrophes (') instead of backslashes (\)
- Verify raw LaTeX blocks use proper syntax
- Test locally with `myst build sample/article.md --pdf`

## Pull Request Guidelines

1. **Create a feature branch**: `git checkout -b feature/your-feature-name`
2. **Make your changes**: Follow the guidelines above
3. **Run tests**: `pre-commit run --all-files`
4. **Build sample**: `myst build sample/article.md --pdf`
5. **Commit**: Write clear commit messages
6. **Push**: `git push origin feature/your-feature-name`
7. **Open PR**: Describe your changes clearly

### Commit Message Format

Use conventional commit format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `chore:` Maintenance tasks
- `ci:` CI/CD changes
- `refactor:` Code refactoring

Example:
```
fix: correct apostrophe handling in sample document

Replaced 116 curly apostrophes with backslashes in article.md
to prevent LaTeX command corruption.
```

## Code of Conduct

- Be respectful and constructive
- Follow the existing code style
- Test your changes thoroughly
- Document new features
- Keep discussions focused on the template

## Getting Help

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)
- **MyST Documentation**: [mystmd.org](https://mystmd.org)
- **QE Journal**: [qeconomics.org](https://qeconomics.org/)

## License

By contributing, you agree that your contributions will be licensed under the CC-BY-4.0 License.
