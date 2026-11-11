---
title: Main article
short_title: Main
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

CITES: the body cites @enelow1984 and [@nash1950; see @debreu1959, p. 3].

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
