---
title: Main article
short_title: Main
math:
  '\PageMac': 'P'
parts:
  abstract: >
    The abstract cites [@aumann1987] alone and @enelow1984 as the body does,
    while the address first@example.com stays plain text.
  acknowledgement: ack.md
---

(sec-intro)=
# Introduction

LOCAL bare top: [](#sec-model). LOCAL bare sub: [](#sec-sub). LOCAL worded: [Sec %s](#sec-model) and [Sec %s](#sec-sub). LOCAL phrase: [the model section](#sec-sub) and the [section on the model](#sec-model), and the [Model](#sec-model) section. LOCAL equation: [](#eq-main) and [Equation %s](#eq-main). LOCAL appendix: [](#app-a), [Appendix %s](#app-b1).

REMOTE: [](#s-top), [](#s-detail), [Supplemental Material %s](#s-detail), [](#eq-supp), [the robustness section](#s-top).

REMOTE PART: [](#app-first), [the appendix section](#app-first).

CITES: the body cites @enelow1984 and [@nash1950; see @debreu1959, p. 3].

CITEFORMS: {cite:t}`{see}nash1950{p. 3}`, [e.g. @nash1950, pg. 22], @debreu1959 [ch. 2], {cite:year}`nash1950`, [-@debreu1959], {cite:author}`nash1950`, {cite:alp}`debreu1959`, [see @nash1950, p. 3; also @debreu1959, ch. 2], {cite:p}`{cf.}nash1950,debreu1959{p. 5}`.

CITENOTE: a comma where `;` belongs, [@nash1950, extended by @debreu1959].

DOILINKS: the [replication files](https://doi.org/10.5281/zenodo.1234567) and the badge [![DOI](../../sample/figure_sample.pdf)](https://doi.org/10.5281/zenodo.1234567).

MISSING: the class member [](#no-such-label) describes, and [see %s](#no-such-other) too.

(sec-model)=
# Model

```{math}
:label: eq-main
x = y
```

:::{prf:assumption} Bounded utility
:label: asm-bounded

Utility is bounded, so that

```{math}
:label: eq-bound
|u(c)| \le \bar{u} \quad \text{for all } c,
```

as in {cite:t}`debreu1959`; see [Supplemental Material %s](#s-detail) and [Sec %s](#sec-sub).[^fn1]

```{image} ../../sample/figure_sample.pdf
:width: 10%
```
:::

[^fn1]: The footnote is referenced from inside the assumption.

:::{prf:algorithm}
:label: alg-iterate

Iterate on {eq}`eq-bound` until the change is small.

```{raw} latex
\textbf{raw inside the algorithm}
```
:::

:::{prf:criterion} Stopping rule
:label: crit-stop

Stop when the residual of {prf:ref}`alg-iterate` is small.
:::

:::{prf:property}
:label: prop-monotone

The policy is monotone under {prf:ref}`asm-bounded`.
:::

(sec-sub)=
## A subsection

:::{figure} ../../sample/figure_sample.pdf
:label: fig-main
:width: 30%

A figure.
:::

KINDS: [](#asm-bounded), [](#alg-iterate), [](#crit-stop), [](#prop-monotone).

(stk-a)=
(stk-b)=
## Stacked heading

(fig-above)=
:::{figure} ../../sample/figure_sample.pdf
:label: fig-dir
:width: 20%

A figure under a stacked target.
:::

STACKED: [](#stk-a) and [](#stk-b), [](#fig-dir) and [](#fig-above).

(sec-Mixed)=
## Mixed Case

```{math}
:label: eq-Mixed
m = n
```

:::{prf:remark} Case
:label: rem-Case

A remark.
:::

MIXED: [](#sec-Mixed), [](#eq-Mixed), [Sec %s](#sec-Mixed), [](#sec-mixed), [](#Sec-Model), [](#rem-Case), {prf:ref}`rem-Case`, [](#rem-case).

# Blocks

:::{prf:proposition} Decay no faster than $1/x$
:label: prop-decay
TITLES: the consumption gap decays.
:::

:::{prf:proof} Proof of {prf:ref}`prop-decay`
TITLES-PROOF: by induction.
:::

::::{prf:remark}
:label: rem-outer
TITLES-NEST: an untitled remark holding a titled example.

:::{prf:example} Inner words
:label: ex-inner
An example.
:::
::::

:::{exercise} Solve for $c$
:label: ex-solve
EXERCISES: find the consumption rule.

$$ c = m $$ (eq-ex)
:::

:::{solution} ex-solve
:label: sol-solve
SOLUTIONS: guess and verify.
:::

EXREFS: [](#ex-solve) and [](#eq-ex).

SOLREFS: [](#sol-solve), [the solution](#sol-solve), [Solution %s](#sol-solve).

:::{prf:claim} Monotone policy
:label: clm-mono
CLAIMS: the policy rises with wealth.
:::

:::{prf:fact}
:label: fct-known
FACTS: a known fact.
:::

CLREFS: [](#clm-mono).

::::{prf:theorem} Items
:label: thm-items

The following hold.

1. (item-first)=
   The first claim.
2. (item-second)=
   The second claim, with a nested list:
   1. (item-nested)=
      A nested claim.
3. A third claim.
::::

ITEMS: [Item %s](#item-second), [](#item-first), [](#item-nested), [claim %s](#item-nested), [the second claim](#item-second).

:::{prf:claim} Unnumbered
:label: clm-unnum
:nonumber:
NONUMBER: a list that opens at 3.

3. (item-third)=
   The third claim.
4. The fourth claim, with a list from 2:

   2. (item-fourth-b)=
      A nested claim.
:::

:::{prf:theorem} Plain unnumbered
:label: thm-unnum
:nonumber:
NONUMBER-THM: a theorem without a number.
:::

LISTREFS: [](#item-third), [](#item-fourth-b), [the claim](#clm-unnum), [](#thm-unnum).

```{list-table}
* - Short cell one, padded out to
  - Short cell two, padded out to
  - Short cell three, padded out
  - Short cell four, padded out t
  - 1. LISTCELL first
    2. LISTCELL second
```

(para-target)=
This paragraph is a target.

PARA: [](#para-target) and [the paragraph](#para-target).

```{math}
:label: eq-unnum
:enumerated: false
u = v
```

UNNUM: [](#eq-unnum) and [Equation %s](#eq-unnum).

(code-target)=
```python
x = 1
```

CODE: [the code](#code-target) and [](#code-target).

```{raw} latex
RAWREF: as in [](#sec-model) and [Figure %s](#fig-main) and [](#eq-main) and [](#s-top).
```

QUOTES: an attributed quotation follows.

> We know what we are, but know not what we may be.
>
> -- William Shakespeare, *Hamlet*

FOOTNOTES: a note[^twice] cited twice[^twice], then a caption and a cell that hold one.

:::{figure} ../../sample/figure_sample.pdf
:label: fig-note
:width: 30%

CAPNOTE: a caption with a note.[^capnote]
:::

| Cell | Note |
| --- | --- |
| x | CELLNOTE[^cellnote] |

[^twice]: Twice-cited note DISTINCTTWICE.
[^capnote]: Caption note DISTINCTCAPNOTE.
[^cellnote]: Cell note DISTINCTCELL.

SMALLCAPS: the {sc}`Small Caps` role and the {kbd}`Ctrl` key.

(sec-remarks)=
# Remarks on $\beta$ {-}

UNNUMHEAD: [](#sec-remarks), [the remarks](#sec-remarks), [Remarks %s](#sec-remarks), [](#plain-remarks), [Appendix](#app-single).

PAGELINK: see the [supplement page](supplement.md) and [the *short* note](nonum.md).

## Plain remarks {.unnumbered}

UNNUMBERED-SUB: a subsection without a number.

# Floats

MACROS: a raw block uses macros only there.

```{raw} latex
$\HRat + \PageMac + \Gfac{t}$ raw-macro-line.
```

RAWTABLE: see [](#tbl-raw).

:::{table} A raw caption.
:label: tbl-raw

```{raw} latex
\begin{tabular}{lr}
\toprule
Name & Value \\
\midrule
alpha & 1.00 \\
\bottomrule
\end{tabular}
```

RAWNOTE: a note under the raw table.
:::

PIPETABLE: see [](#tbl-pipe).

:::{table} A pipe caption.
:label: tbl-pipe

| Variable | N | Description |
| --- | --- | --- |
| consumption | 12 | Real nondurable consumption per capita, deflated by the CPI and measured in dollars of the base year, quarterly |
| income | 345 | Labour income after taxes and transfers, per household member, annual average across the panel waves |
:::

ALIGNTABLE: a bare pipe table with alignment.

| Model | Mean | Note |
| :--- | ---: | :---: |
| A | 1.25 | ok |
| B | 10.5 | fine |

TABNOTES: see [](#tbl-notes).

:::{table} A noted caption.
:label: tbl-notes

| Name | Value |
| --- | --- |
| alpha | 1.25 |

TABNOTE-ONE: the first note.

TABNOTE-TWO: the second note.
:::

MINUSCELLS: signs in a table.

| Coef | Est | Range |
| --- | --- | --- |
| beta0 | -0.30 | 1-2 |
| beta1 | &#8722;12.29 | n-a |

SPANS: see [](#tbl-spans).

:::{table} A spanned caption.
:label: tbl-spans

<table>
<tr><th rowspan="2">Model</th><th colspan="2">Quantile</th></tr>
<tr><th>2.5%</th><th>97.5%</th></tr>
<tr><td>SPANROW</td><td>-1.5</td><td>2.5</td></tr>
<tr><td rowspan="2">Tall</td><td>0.1</td><td>0.9</td></tr>
<tr><td>0.2</td><td>0.8</td></tr>
</table>
:::

PANELS: see [](#fig-panels), [](#fig-panels-pair), [](#fig-panels-left) and [](#fig-panels-one).

::::{figure}
:label: fig-panels

:::{figure}
:label: fig-panels-pair

```{image} ../../sample/figure_sample.pdf
:label: fig-panels-left
```

```{image} ../../sample/figure_sample.pdf
:label: fig-panels-right
```

A pair of images.
:::

:::{figure} ../../sample/figure_sample.pdf
:label: fig-panels-one
:width: 30%

One image.

PANELNOTE: a note under one panel.
:::

| Lag | Value |
| --- | --- |
| one | -0.25 |

Panels of every kind.
::::

SUBTABLES: see [](#tbl-sub).

:::{table} Two tables side by side.
:label: tbl-sub

| Left | Value |
| --- | --- |
| a | 1.0 |

| Right | Value |
| --- | --- |
| b | 2.0 |

SUBTABLENOTE: the note under both.
:::

MULTIFIG: see [](#fig-multi).

:::{figure}
:label: fig-multi

```{image} ../../sample/figure_sample.pdf
:width: 40%
```

```{image} ../../sample/figure_sample.pdf
:width: 40%
```

Two panels.
:::

BOXFIG: see [](#fig-adm).

::::{note}
Note text.

:::{figure} ../../sample/figure_sample.pdf
:label: fig-adm
:width: 20%

In a note.
:::
::::

IGNOREDIMG: ![ignored](_build/img/ignored_figure.pdf)

AUTHOREDBIB: {cite:t}`wittman1990` in its book.

BIBCAPS: {cite:t}`hardnet2024` leaves two acronyms unbraced.

CITEROLES: {cite:ps}`aumannhartperry1997`, {cite:ts}`aumannhartperry1997`, {cite:ct}`vonneumann1944`, {cite:cts}`aumannhartperry1997`, {cite:authors}`aumannhartperry1997`, {cite:cauthor}`vonneumann1944`, {cite:authorpars}`aumannhartperry1997`, {cite:alps}`aumannhartperry1997,vonneumann1944`, {cite:alp}`nash1950,debreu1959`, {cite:label}`nash1950`.

# Text

MATHLABELS: [](#eq-align), [](#eq-row1), [](#eq-row2) and [](#eq-gather).

```{math}
:label: eq-align
\begin{align}
a &= b \\
c &= d
\end{align}
```

$$
\begin{align}
e &= f \label{eq-row1} \\
g &= h \label{eq-row2}
\end{align}
$$

```{math}
:label: eq-gather
\begin{gather}
p = q
\end{gather}
```

SYMBOLS: -0.30 and &minus;0.45, not 10-20 or COVID-19, x &minus; y; a &rarr; b &rArr; c &larr; d &harr; e &hArr; f &lArr; g; wait... then.

PARENMINUS: a math number after a parenthesis ($-3.48$ and $-3.05$).

ABBREVS: e.g. this, i.e. that, cf. Smith, vs. them, etc. and Smith et al. (2000), etc. The end.

QUOTATION: a quotation of two paragraphs follows.

> QUOTATION-ONE first paragraph.
>
> QUOTATION-TWO second paragraph.

QUOTEATTR: an attributed one of two paragraphs.

> QUOTEATTR-ONE first paragraph.
>
> QUOTEATTR-TWO second paragraph.
>
> -- An Author

ROLES: the {sf}`Sans Serif` role and the {logo}`LaTeX`, {logo}`TeX` and {logo}`LaTeX2e` logos.

:::{enumerate} (i)
1. ENUM-FIRST condition.
2. (enum-second)=
   ENUM-SECOND condition.
:::

ENUMREF: [Condition %s](#enum-second).

UNICODE: K&#337;szegi Stra&szlig;e &euro; &#7865; in the text.

:::{prf:theorem} Emphasis
:label: thm-emph

THMEMPH: a theorem with *stressed* words.
:::

:::{prf:definition} Upright
:label: def-upright

DEFUPRIGHT: a definition.
:::

:::{raw:latex}
\begin{appendix}
:::

(app-a)=
# First appendix

Text of the first appendix.

(app-b)=
# Second appendix

Text of the second appendix.

(app-b1)=
## A part of the second appendix

Text of its part.

:::{raw:latex}
\end{appendix}
:::

:::{raw:latex}
\begin{appendix}
:::

(app-single)=
# Single appendix {-}

SINGLEAPP: the one unnumbered appendix.

:::{raw:latex}
\end{appendix}
:::
