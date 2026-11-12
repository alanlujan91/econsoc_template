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
SOLUTIONS: guess and verify.
:::

EXREFS: [](#ex-solve) and [](#eq-ex).

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
