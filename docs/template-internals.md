# Template internals

Maintainer notes for `template.tex`. Every item here is a constraint that fails
*silently*: wrong output at exit 0. User-facing behavior is in the [README](../README.md).

## Class options

`econsocart`'s `\ProcessOptions` is unstarred, so options execute in declaration
order, not the order the template writes them. The class declares `linenumbers`
(:127) before `draft` (:131) and `final` (:139), and both of the latter overwrite
the line-number flag. `final` is therefore omitted when `linenumbers` is
requested on its own, or the option is inert.

## Theorem counters

MyST emits section-based counters; the journals number globally. `\counterwithout`
does the reset and is a LaTeX2e kernel command (2023-06-01 or newer), not etoolbox.

`corollary` is the one exception: MyST parents it to `theorem`, not `section`.
Detach it from `theorem`. Sweeping it with `{section}` is a no-op on the reset
that still strips the `\thetheorem.` prefix, leaving every corollary in every
section numbered "Corollary 1" with cross-references resolving to that string.

`algorithm` is a numbered theorem environment, not the `algorithm` float. MyST
emits it with a `\label` and no `\caption`, and a float takes its number from the
caption, so under the float package the block renders with no label at all.

## Dropped proof kinds (upstream, unfixed)

Released `myst-to-tex` maps 11 of the 15 `PROOF_KINDS`. `algorithm`, `assumption`,
`criterion` and `property` match no case, hit `default`, and are omitted from the `.tex`
along with their `\label`, so cross-references to them render `??`. The build says
`Unhandled LaTeX proof environment` and exits 0.

Upstream [issue 3030](https://github.com/jupyter-book/mystmd/issues/3030) and
[PR 3031](https://github.com/jupyter-book/mystmd/pull/3031), open since 2026-08-19.
`sample/exports/` is built with stock mystmd, so the article PDFs omit the three
blocks `sample/article.md` declares, and that section says so in its own prose.
Committed artifacts are always built from a release: anything produced by a patched
toolchain is transient, since no one else can reproduce it.

The `\newtheorem{assumption}` and `\newtheorem{algorithm}` definitions in
`template.tex` are correct and take effect as soon as the writer emits the
environments. Once #3031 is released, rebuild `sample/exports/` and drop the note from
`sample/article.md`.

## Packages

`template.yml` `packages:` declares what the template or class already loads, which
tells MyST not to re-inject it. Declaring a package that nothing actually loads
suppresses the injection and breaks the build.

## Preprint running head

Empty the journal name via `\form@runauthors`, which the class calls before its own
`\markboth`. Do not rewrite `\markboth`: that drops the `\hfill` spacing and pushes
the line-number box onto the text.

`\copyright@text` must keep its `\hfill` for the same reason. Defining it empty
removes glue the head box needs, and under `draft` the line-number boxes then print
on top of the first-page footnote block.

## Authors and addresses

Emit the `[...]` optional argument only for authors that have affiliations. A bare
`\author[]{...}` makes the class look up an address keyed on the empty string,
raising "Missing \endcsname inserted" and "there is no address with number", then
dropping the affiliation line while still producing a PDF.

Emit `\orgdiv` and its separating comma only when the affiliation carries a
`department`. A bare `name:` affiliation otherwise yields `\orgdiv{}` and the class
prints the literal comma ("Johns Hopkins University and , Econ-ARK").

`\address[default]{}` is declared unconditionally. The class defines `\author` as
`\@ifnextchar[{\author@fmt}{\author@fmt[default]}`, so omitting the bracket
substitutes the literal label `default` rather than skipping the lookup. The empty
address satisfies it, and is inert when unused.

## JEL codes

The class prints its "JEL CLASSIFICATION" label whatever the block contains, so an
empty block renders as a stray label with dangling punctuation. Omit the block
instead. It is also suppressed under `journal: ecta`, where upstream carries no JEL
block; a comment trace survives into the `.tex` so the codes read as withheld
rather than lost.

## Appendix

There is no `parts.appendix` branch, and a document that declares `parts: appendix:`
loses its appendix entirely and silently. MyST excludes frontmatter parts from the
rendered document, so bibliography harvesting never sees them: a reference cited
only in the appendix reaches the `.tex` while its entry never reaches the `.bib`,
leaving an undefined citation. Open the appendix in the document body with raw
LaTeX instead, per the README.

Nothing checks this automatically. Verify by grepping the emitted `main.bib` for
every key cited in the emitted `.tex`.

## Bibliography styles

One style per journal: `ecta` uses `econsoc`, `qe` uses `qe`, `te` uses `te`.
`preprint` does not change the style. Supplements use the same style as the article.

Upstream's `qe_supp_template.tex` and `te_supp_template.tex` name `ecta-fullname`,
which is stale. That file only ever existed in the Econometrica repository, which
deleted it on 2026-03-06 (commit 959c321) and added `econsoc.bst` in the same commit.
