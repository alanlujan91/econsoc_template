# Template Options

Configure via `exports` in frontmatter:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `journal` | choice | `qe` | Which journal to typeset for: `qe`/`ecta`/`te`. Sets the class option, layout, running head and bibliography style. See [Which mode for which stage](#which-mode-for-which-stage). |
| `preprint` | boolean | `true` | Strip journal identification (no "Submitted to ..." banner, running head, copyright line, or co-editor line) while keeping the journal layout and style. The co-editor line is suppressed because the class emits a placeholder reading "Co-editor [Name Surname; will be inserted later] handled this manuscript", which asserts journal handling on a publicly posted working paper. Set `false` when you submit. |
| `draft` | boolean | `false` | Draft mode for initial submission |
| `supplement` | boolean | `false` | Supplementary material document |
| `seceqn` | boolean | `false` | Number equations by section (e.g., Equation 2.1) |
| `linenumbers` | boolean | `false` | Adds line numbers to a non-draft build. A draft numbers its lines unless `linenumbers: false` is set explicitly. |
| `extra_packages` | string | (none) | Comma-separated LaTeX packages to load, e.g. `mhchem,cancel` (see [LaTeX Packages](myst-authoring.md#latex-packages)) |

The `open_access` frontmatter field automatically enables the econsocart `openaccess` class option. It produces no visible change in a PDF you build: the license statement it controls is part of the copyright block, which the journal adds during production. Measured in both preprint and non-preprint builds.

`corresponding: true` on an author is likewise not rendered. econsocart marks the corresponding author through a `corref` key that only feeds the production-side open-access license line, so this template does not emit it.

#### Special characters in frontmatter

Write `&`, `%`, `#`, `_` in your title, keywords, JEL codes, author names and
affiliations as ordinary characters. The template escapes them. Titles keep `_`, `~`,
and `^` unescaped so `$x_1$` still renders as math, which means a *literal*
underscore in a title is the one case you must write as `\_` yourself. Paired
straight double quotes become ``` ``...'' ```, and `Supplement to "Title"` prints
curly quotes. Letters beyond Latin-1 (the Hungarian double acute, the Polish
barred L, the Czech caron, the euro sign) print under xelatex in every field and
in the body. The T1 fonts lack the Vietnamese horn and hook-above letters.

Name fields: a `non_dropping_particle` or `dropping_particle` ("van" in "Vincent van
Gogh") prints as econsocart's `\particle`. For a suffix, write the name structured,
`name: {given: George, family: Lucas, suffix: Jr.}`; MyST misparses "Jr." in a plain
name string.

Author emails are not escaped, because `\ead` builds a `mailto:` link that `\_`
would break. An address containing `&`, `%`, or `#` fails the build loudly.

#### Blockquote attributions

With the plugin, write an attribution either way: its `quotes` repair sets the quote in
place with the attribution flush right ([Plugin repairs](plugin-repairs.md#running-text)).
Without the plugin, do not leave a blank `>` line before a dash-prefixed attribution:

```markdown
> We know what we are, but know not what we may be.
> -- William Shakespeare, Hamlet
```

With a blank `>` line in between, MyST reads the last line as an attribution,
wraps the quote in a `figure`, and emits `\caption*{...}`. econsocart ignores the
star and typesets a phantom **"FIGURE 0."** into the paper, at exit 0 with nothing
in the log.

The dash count is irrelevant: `--` and `---` behave identically, and both are safe
without the blank line. Measured across all six forms; an attribution with no
leading dashes is also safe. CI asserts no `\caption*` reaches the emitted LaTeX.

#### Citations in the abstract

With the plugin, cite in the `abstract` as anywhere else: its `part-citations` repair
carries those keys into the `.bib` ([Plugin repairs](plugin-repairs.md#citations)).
Without the plugin, do not cite there. MyST excludes frontmatter parts from the
rendered document, and bibliography harvesting walks that document, so the
`\cite` reaches the `.tex` while its entry never reaches the `.bib`: the citation
is undefined, at exit 0. An appendix part has the same cause. See
[jupyter-book/mystmd#3032](https://github.com/jupyter-book/mystmd/issues/3032).

#### Which mode for which stage

The three journals want a different PDF at each stage, and getting the stage wrong
is the likeliest way to send one the journal did not ask for.

`preprint` and `draft` are independent switches on top of `journal`. Keep
`journal` set to your actual target at every stage, so the layout and bibliography
style are always the right ones.

| Stage | Options | Produces |
| --- | --- | --- |
| Working paper / preprint posting | `journal: <target>`, `preprint: true` (default) | the journal's layout with no journal identification |
| **Initial submission** | `journal: <target>`, `preprint: false`, `draft: true` | proof layout: US Letter, line numbers, increased line spacing, "Submitted to ..." banner |
| Camera-ready, after acceptance | `journal: <target>`, `preprint: false` | the typeset journal layout |

`preprint` is deliberately left out of the values of `journal`. It once was, and that
forced the Quantitative Economics layout on every neutral build, so a
Theoretical Economics preprint was silently typeset as Quantitative Economics
and used `qe.bst`. As a switch it strips the identification and leaves the
journal unchanged.

#### Econometrica house style

Setting `journal: ecta` gets you Econometrica's layout, class option and
bibliography style. The `econsocart` class itself enforces none of Econometrica's
house style: there is no case-forcing or keyword-suppressing logic in the class
for the author to inherit. Comparing Econometrica's own sample against the
Quantitative Economics and Theoretical Economics ones:

| | Econometrica | Quantitative Economics / Theoretical Economics |
| --- | --- | --- |
| Title, running head, and every section and subsection heading | Title Case: "Section Headings", "Equations and the Like" | sentence case: "Section headings" |
| JEL codes | none (suppressed by the template, below) | up to 3, in alphabetical order |
| Keyword guidance | 3-8 keywords | 3-8 keywords and up to 3 JEL codes |

The template suppresses the JEL block for `journal: ecta` even when the document
supplies `tags`, because both `ecta_sample.tex` and `ecta_template.tex` lack one
while the qe and te equivalents each carry one. Keep your `tags:` in frontmatter:
they still emit for the qe and te exports of the same source, so one document
retargets across all three journals without hand-editing. The suppression leaves a
comment in the emitted `.tex` recording that codes were withheld.

Title Case is yours to apply: write Econometrica headings in Title Case in your
own prose, since neither the template nor the class does it.

Two more Econometrica conventions:

- Papers with five or more authors cite as the initials of the first four
  followed by a plus sign. `econsoc.bst` renders `[HNPS+]` where the other two
  styles render "Hortacsu et al." This needs the `\xcitelabel` support added in
  `econsocart.cfg` v1.0.7, so the vendored config tracks the newest release;
  `scripts/check-citation-labels.sh` checks the label.
- An approved supplement is referenced at the end of the introduction and cited
  like any other work. It is a separate document, so a reference into it prints as
  plain text; see [Cross-References](myst-authoring.md#cross-references).

All three journals state their own requirements for the **submitted** PDF, and
all three treat their LaTeX class as optional at that stage:

| | Econometrica | Quantitative Economics | Theoretical Economics |
| --- | --- | --- | --- |
| Format | PDF | PDF only | PDF |
| Font | at least 12pt | at least 12pt | at least 12pt |
| Spacing | at least 1.5 | 1.5 or double | at least 1.5, at most 32 lines per page |
| Page size | - | - | US Letter, margins at least 1.25in |
| Length | 45pp including references and appendices; supplement at most 25pp | - | brevity weighed during review |
| Class required? | recommended, not required | - | not mandatory at submission |

The `draft` option targets that stage: the class configuration switches to a
proof layout (`\proof@papersize`, increased `\baselinestretch`, line numbers in
both margins). Econometrica additionally notes that the submitted manuscript need
not follow its style specifications at all, since the copyeditor and typesetter
apply them; and it asks for complete source files (LaTeX preferred, figures as
`.eps` or `.jpg`) only *after* acceptance.

These requirements change, so check each journal's current ones before submitting:

- [Econometrica](https://www.econometricsociety.org/publications/econometrica/information-authors/instructions-submitting-articles)
- [Quantitative Economics](https://www.econometricsociety.org/publications/quantitative-economics/submissions/instructions-for-submitting-articles)
- [Theoretical Economics](https://www.econometricsociety.org/publications/theoretical-economics/submission-guidelines)

> **Numbered cross-references need the right `numbering` keys, and where you put
> them matters.** Set `numbering: {title: true, headings: true}`: in the
> document frontmatter for a standalone paper, as the samples do, or once under
> `project:` in `myst.yml` if you have a MyST project, in which case every
> document inherits it. Both keys are required; either may come from either
> place, and they merge.
>
> The trap is the older per-level keys: **`heading_1: true` and friends are
> honoured only at project scope. In document frontmatter they are ignored.** So
> `numbering: {title: true, heading_1: true}` in frontmatter still numbers the
> headings while `@s1` renders the heading *title*: "the Introduction should be
> Introduction" where a hand-written manuscript reads "should be Section 1". In a
> submitted PDF that reads as an error rather than a formatting nicety, and it is
> easy to miss precisely because the headings themselves look correctly numbered.
> `headings: true` works at both scopes, so prefer it everywhere.

#### Preprint mode

By default (`preprint: true`) the PDF omits all journal identification (see the `preprint` row of the options table at the top of this page), so it is safe to post as a working paper without signalling where it was submitted. A Theoretical Economics preprint still looks like Theoretical Economics.

When you submit, turn it off:

```yaml
exports:
  - format: tex+pdf
    template: https://github.com/alanlujan91/econsoc_template.git
    output: paper.pdf
    journal: ecta
    preprint: false   # renders "Submitted to Econometrica"
    draft: true       # proof layout for the submission stage
```

Draft mode switches to the proof layout described above and shows the "Submitted to ..." banner unless `preprint` is left on.

Use `acknowledgement` (singular) in frontmatter, not `acknowledgements`.
