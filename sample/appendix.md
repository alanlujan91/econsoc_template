---
title: Appendix
---

(appA)=

# Title of the first appendix

If there are more than one appendix, then please refer to it
as $\ldots$ in [](#appA), [](#appB), etc.

(appB)=

# Title of the second appendix

(appB1)=

## First subsection of [](#appB)

If your appendix is long, make sure to divide it into subsections and refer to them in text. Use the standard {logo}`LaTeX` commands for headings in `{appendix}`.
Headings and other objects will be numbered automatically.

```{math}
:label: path
\mathcal{P}=(j_{k,1},j_{k,2},\dots,j_{k,m(k)}).
```

Sample of cross-reference to formula {eq}`path` in [](#appB1).
Note that it is better to refer to [](#appB1) as opposed to [](#appB), because it is easier for the reader to locate the necessary place.
