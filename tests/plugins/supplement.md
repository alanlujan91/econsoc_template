---
title: Supplement
short_title: Supplement
numbering:
  enumerator: S%s
parts:
  appendix: |
    (app-first)=
    # First appendix section

    APPENDIX: appendix text.

    ## Nested appendix subsection
---

:::{raw:latex}
\renewcommand{\thesection}{S\arabic{section}}\renewcommand{\theequation}{S\arabic{equation}}
:::

(s-top)=
## Robustness

(s-detail)=
### A detail

```{math}
:label: eq-supp
a = b
```

REMOTE BACK: [](#sec-model), [](#sec-sub), [](#eq-main), [](#app-a), [Appendix %s](#app-b1), [the model section](#sec-model), [Figure %s of the main text](#fig-main), [](#asm-bounded).

SUPP LOCAL: [](#s-top) and [Sec %s](#s-detail).

REMOTE ITEMS: [](#item-second), [Claim %s](#item-nested), [](#para-target), [the claim](#item-first).

REMOTE STACKED: [](#stk-b).

PART LOCAL: [](#app-first) and [Appendix %s](#app-first).
