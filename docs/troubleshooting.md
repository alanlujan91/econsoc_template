# Troubleshooting

**LaTeX compilation errors**:

1. **Missing fonts**: The `econsocart` class loads the `times` package (Times Roman via `psnfss`), which every TeX distribution includes. If it is somehow missing, `tlmgr install psnfss`.
2. **Missing bibliography** (also "Bibliography not found"): Ensure `bibliography: file.bib` is in frontmatter and the `.bib` file exists at that location.
3. **Author format**: Check name structure matches the example in the [README Quick Start](../README.md#quick-start).
4. **Citations**: Verify all `{cite:}` references have matching BibTeX entries.
5. **Math**: Ensure all `$` and `$$` are properly closed.
6. **`Undefined control sequence ... \counterwithout`**: The theorem-numbering fix uses `\counterwithout`, a LaTeX2e kernel command added in the 2023-06-01 release. Update to TeX Live 2023 or newer.
7. **Line numbers overlapping text in `draft` mode**: `draft` prints line numbers in both margins. Content wider than the text block (an `Overfull \hbox`) spills into the margin and collides with them. This is over-wide content, not the line numbers: search the build log for `Overfull \hbox ... too wide`, then break the wide equation (`align`/`multline`), shorten the long token, or wrap the wide table/figure in `\resizebox{\linewidth}{!}{...}`.

**Common issues**:

- **"Template not found"**: Check `exports` -> `template` path is correct

**Getting help**:

- Review [MyST Documentation](https://mystmd.org)
- Open an [issue](https://github.com/alanlujan91/econsoc_template/issues) for template-specific problems
