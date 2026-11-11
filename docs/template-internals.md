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
the inputs seven ways to prove the guard can still fail. That design admits no local
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

## Dropped proof kinds

Released `myst-to-tex` maps 11 of the 15 `PROOF_KINDS`. `algorithm`, `assumption`,
`criterion`, and `property` match no case, hit `default`, and are omitted from the `.tex`
along with their `\label`, so cross-references to them render `??`. The build says
`Unhandled LaTeX proof environment` and exits 0. Upstream
[issue 3030](https://github.com/jupyter-book/mystmd/issues/3030) and
[PR 3031](https://github.com/jupyter-book/mystmd/pull/3031), open since 2026-08-19.

`plugins/proof-kinds.mjs` restores all four kinds in a paper that lists it
([plugins/README.md](../plugins/README.md)), and `scripts/check-plugins.sh` tests it.
The sample does not list the plugins, so `sample/exports/` is still built without it:
the article PDFs omit the `assumption` and `algorithm` blocks `sample/article.md`
declares, and that section says so in its own prose. `scripts/build-samples.sh`
asserts both kinds stay absent and fails once one reaches the `.tex`.

The `\newtheorem{assumption}` and `\newtheorem{algorithm}` definitions in
`template.tex` take effect as soon as the writer emits the environments. Once #3031
is released, rebuild `sample/exports/`, drop the note from `sample/article.md`, and
delete the plugin.

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

`scripts/build-samples.sh` catches the missing entry by comparing, as sets, the keys
cited in each emitted `.tex` with the entries of the `main.bib` in the same export
directory.

## Bibliography styles

One style per journal: `ecta` uses `econsoc`, `qe` uses `qe`, `te` uses `te`.
`preprint` does not change the style. Supplements use the same style as the article.

Upstream's `qe_supp_template.tex` and `te_supp_template.tex` name `ecta-fullname`,
which is stale. That file only ever existed in the Econometrica repository, which
deleted it on 2026-03-06 (commit 959c321) and added `econsoc.bst` in the same commit.

## What build-samples.sh guards, and why each check exists

Each check answers a defect that once reached a built PDF at exit 0. The rationale
is kept here because a comment block in the script is capped at three lines.

**A missing dependency must fail, not skip.** The bibliography check is the only
thing that catches a dead bibliography. Without `poppler-utils` it would do nothing,
and a gate that degrades to nothing looks the same as a gate that passed.

**The bibliography is read from the PDF.** A missing or unreadable `.bst` produces
no error anywhere: `myst` exits 0, the LaTeX logs stay clean, and no `.blg` survives
to grep, because the failure happens in BibTeX. The PDF comes out with its bibliography
absent. The script therefore counts `Aumann` in the PDF text, a name that appears in
`references.bib` and nowhere in the sample prose, so only a resolved citation prints
it.

**The emitted `\bibliographystyle` is checked against upstream.** A wrong but valid
`.bst` passes every content check. Econometrica's `econsoc.bst` fed to a Theoretical
Economics document yields a full bibliography, a clean log and a normal-size PDF,
typeset in the wrong journal's style. Per-journal style selection exists to prevent
exactly that, so each export's style is compared with what its journal's own upstream
template prescribes (`journal_bst` in `scripts/lib-econsoc.sh`).

**Exports are cleared first, then counted.** `myst` does not overwrite an export file
that already exists, so a stale artifact survives a rebuild and satisfies every
assertion below it; the vendored copies once fell a full class release behind this
way. With no TeX toolchain `myst` also exits 0 and produces nothing, while the
previous PDFs would pass every assertion. For both reasons the script deletes
`sample/exports/` before the build and requires as many PDFs, and as many `.tex`
files, as the sources declare exports. CI job `build-pdf` runs this script.

**The log regex matches the condition, never the decoration.** MyST runs xelatex
through latexmk with `-file-line-error`, which rewrites `! message` into
`file:line: message`, so a pattern anchored on `^! ` matches nothing. Class- and
package-branded errors read `Class econsocart Error:` rather than `LaTeX Error:`.
An earlier `^! ` version passed a build whose log held
`./article_ecta.tex:460: Undefined control sequence.`

**Cited keys are compared against the emitted `.bib` as sets.** MyST harvests the
bibliography from the *rendered* document, so a key reachable only from unrendered
content appears in the `.tex` and never in the `.bib`. BibTeX leaves it undefined,
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

**Declared proof kinds reach the `.tex`, and dropped ones stay out.** Rendering
without error says nothing about content, because `myst-to-tex` drops the proof kinds
it cannot map and still exits 0. Every emitted `.tex` must hold the kinds the samples
declare and released `myst-to-tex` maps (`theorem`, `proposition`, `lemma`,
`definition`, `remark`, `axiom`, `example`), and must lack `assumption` and
`algorithm` (see "Dropped proof kinds" above). When either appears, mystmd#3031 has
been released: rebuild `sample/exports/` and drop the note in `sample/article.md`.

**No `\caption*` reaches the `.tex`.** A `---` attribution line in a blockquote makes
MyST wrap the quote in a figure with `\caption*`. econsocart ignores the star and
typesets "FIGURE 0." into the paper, with exit 0 and a clean log. Writing the
attribution with `--` keeps it inside the quote.

**An unresolved reference prints a literal `??`.** No LaTeX event occurs, so no
log gate can see it. A numbered `[Sec %s](#label)` link does this in every
single-article export ([mystmd#3035](https://github.com/jupyter-book/mystmd/pull/3035)),
and a `\ref` to a dropped `prf:algorithm` block does it too, so the artifact check
is the only one that covers both. `plugins/xref.mjs` repairs the first cause and
`plugins/proof-kinds.mjs` the second, in a paper that lists them
([plugins/README.md](../plugins/README.md)).
