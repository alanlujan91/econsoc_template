# Contributing to the Econometric Society Journals MyST Template

Thank you for your interest in contributing to the Econometric Society Journals MyST Template!

## Development Setup

### Prerequisites

- Python with `uv` package manager
- Node.js with `npm` (for MyST, and for rebuilding the plugin bundle)
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

Install MyST as in the [README Quick Start](../README.md#quick-start), then:

```bash
# Install pre-commit
uv tool install pre-commit

# Enable pre-commit hooks
pre-commit install
```

[Maintaining the template](../docs/maintaining.md) covers the pre-commit hooks, CI,
local testing, upstream synchronization, and the conventions for changing each kind of
file.

## Pull Request Guidelines

1. **Create a feature branch**: `git checkout -b feature/your-feature-name`
2. **Make your changes**: Follow [Maintaining the template](../docs/maintaining.md)
3. **Run tests**: `pre-commit run --all-files`
4. **Build sample**: `scripts/build-samples.sh`
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

- **Issues**: [GitHub Issues](https://github.com/alanlujan91/econsoc_template/issues)
- **Discussions**: [GitHub Discussions](https://github.com/alanlujan91/econsoc_template/discussions)
- **MyST Documentation**: [mystmd.org](https://mystmd.org)
- **QE Journal**: [qeconomics.org](https://qeconomics.org/)

## License

By contributing, you agree that your contributions will be licensed under the CC-BY-4.0 License.
