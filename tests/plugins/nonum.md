---
title: "Unnumbered note, Kőszegi"
short_title: Note
numbering:
  headings: false
  heading_2: true
  equation: false
---

(n-first)=
# First part

NONUM: [](#n-second), [Section %s](#n-second).

NONUM-SUB: [](#n-sub), [the sub part](#n-sub), [](#n-eq), [Equation %s](#n-eq).

CREF: raw LaTeX that needs cleveref, {raw:latex}`\cref{n-sub}`.

(n-second)=
# Second part

(n-sub)=
## A sub part

Text.

```{math}
:label: n-eq
a = b
```

# Code in a heading `\headcode`

INLINECODE: `\textheight` and `a|b[0]`, `plain` stays, then *emphasis `\emphcode`*, [a link `\linkcode`](https://example.com) and a note[^code].

[^code]: FOOTCODE: `\footcode` in a footnote.

- INLINELIST: `\listcode` in a list.

| Cell |
| --- |
| CELLCODE: `\cellcode` |

:::{prf:remark} Title `\titlecode`
:nonumber:
PROOFCODE: `\proofcode` in a proof.
:::
