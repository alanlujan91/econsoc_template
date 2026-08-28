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

## Vendoring is verbatim, by design

`scripts/sync-vendored.sh --check` asserts the root class and `.bst` copies are
byte-identical to the pinned submodules, and `selftest-sync-vendored.sh` mutates
the inputs nine ways to prove the guard can still fail. That design admits no local
patch: modifying `econsocart.cls` makes CI fail rather than tracking the change.

If a patch ever becomes necessary, the guard has to change with it, to re-deriving
the patched file from the pristine source and byte-comparing that. Do not weaken
the check to accommodate a patch.

## Rebuilding the sample exports

`--force` does not regenerate `main.bib` inside `sample/exports/*_pdf_tex/`, and the
cache is the project-root `_build/`, not `sample/_build/`. A `.bib` edit therefore
does not reach the build, silently, at exit 0. Remove all three:

```bash
rm -rf _build sample/exports/*_pdf_tex sample/exports/*_pdf_logs
myst build --pdf --force
```

Verify by grepping the emitted `main.bib` for the field you changed. A fresh mtime
on that file is not evidence it was regenerated from source.

## Name and affiliation precedence

Given name: `nameParsed.given`, then `name.given`, then `given`, then nothing.
Surname: `nameParsed.family`, then `name.surname`, then `surname`, then `family`,
and only then the whole `name`.

The whole name is the last resort of the SURNAME chain deliberately. Feeding it to
the given-name chain as well rendered a one-part name ("Aristotle") as "Aristotle
Aristotle", because both chains resolved independently. A mononym is a surname with
no `\fnms`, so the `~` separator is emitted only when a given name exists.

Affiliation display name: `institution`, then `name`, then empty.

## Escaping LaTeX specials

MyST escapes the content it renders itself. It does NOT escape frontmatter that
reaches jtex as a raw string, and `\title{}` is fed from the substitution, not from
the AST. An unescaped `&` was silently deleted from the PDF and an unescaped `%`
opened a comment that swallowed the rest of the line, both while a PDF was still
produced and copied into place.

The discriminator is which side of that line a key falls on, and it is not inferable
from the template. Measure it.

Arrive ESCAPED, never escape again (doing so emits `50\\%`): `doc.abstract`, every
`parts.*`, and body content.

Arrive RAW, escaped here via the `esc()` macro (`\ & % # _ ~ ^`): author given,
family and surname names, `affiliation.institution`, `affiliation.department`,
`doc.keywords`, `doc.tags` (JEL codes).

Arrive RAW, escaped via `escmath()` (`& % #` only): `doc.title`, `doc.short_title`.
These deliberately leave `_ ~ ^` alone so `$x_1$` in a title still renders. The cost
is that a literal underscore in a title is still unguarded.

Arrive RAW and NOT escaped: `author.email`. `\ead` builds a `mailto:` link, and
escaping `_` there breaks the URL. Addresses containing `% # &` will still break the
build; that is a loud failure, not a silent one.

Both macros open with `default('')`, and the order matters: `string` calls
`.toString()` and throws on an absent key. Without it, a page with no `short_title`
of its own raised `TypeError: Cannot read properties of undefined` at the
`\runtitle` line, which aborts the export while `myst` still exits 0 and leaves the
previous PDF in `exports/`. The only symptom is a stale artifact. Any new field
routed through these macros inherits that requirement.

`default('')` alone was not enough. A page inherits `short_title` from the project
rather than receiving it, so `doc.short_title` is undefined there and the head
rendered `\runtitle{}`: a blank running head on every odd page. No check looked at
the running head at all, so a real paper carried the blank for months. The running head therefore falls back to `doc.title`. A
running head that is too long is visibly wrong and gets fixed; an empty one is not.

`.github/workflows/ci.yml` job `check-escaping` is the regression test, and it has
been checked against the unescaped template: all six assertions fail on it. The same
job asserts a page inheriting project frontmatter still renders.

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

## What build-samples.sh guards, and why each check exists

Each of these was a real shipped defect. They live here rather than as comment
blocks in the script, per the three-line cap.

**A missing dependency must fail, not skip.** The bibliography check is the only
thing that catches a dead bibliography, and it guards `ecta` and `te`, which
nothing else compiles. Without `poppler-utils` it would quietly do nothing, and a
gate that degrades to nothing is indistinguishable from a gate that passed.

**Exports are cleared first.** `myst` does not overwrite an export file that
already exists, so a stale artifact survives a rebuild and satisfies every
assertion below it. That is how the vendored copies once rotted a full class
release behind.

**The log regex matches the condition, never the decoration.** MyST runs xelatex
through latexmk with `-file-line-error`, which rewrites `! message` into
`file:line: message`, so a pattern anchored on `^! ` matches nothing. Class- and
package-branded errors read `Class econsocart Error:` rather than `LaTeX Error:`.
An earlier `^! ` version passed a build whose log held
`./article_ecta.tex:460: Undefined control sequence.`

**Cited keys are compared against the emitted `.bib` as sets.** MyST harvests the
bibliography from the *rendered* document, so a key reachable only from unrendered
content lands in the `.tex` and never in the `.bib`. BibTeX leaves it undefined,
natbib logs a warning rather than an error, and the PDF ships a visible `?`.
Counting entries cannot catch this, because the other citations still resolve and
keep any threshold satisfied.

**`|| true` on the leading greps is load-bearing.** `grep` exits 1 when it matches
nothing, which is legitimate here (a `.tex` with no citations, an empty `.bib`).
Under `set -euo pipefail` that exit propagates through the pipe and kills the
script at the assignment, with no message and no further exports checked.

**Numbered section references need `headings: true` in the document's own
frontmatter.** `heading_1`/`2`/`3` is ignored there. Getting it wrong fails
silently: headings stay numbered so the document looks right, while every
reference degrades to the heading title.

**An unresolved reference prints a literal `??`.** No LaTeX event occurs, so no
log gate can see it. A numbered `[Sec %s](#label)` link does this in every
single-article export ([mystmd#3035](https://github.com/jupyter-book/mystmd/pull/3035)),
and a `\ref` to a dropped `prf:algorithm` block does it too, so the artifact check
is the only one that covers both.
