---
title: Appendix
---

(appA)=

# Title of the first appendix

This file is spliced into the article body with `include`, between raw LaTeX blocks that open and close the `{appendix}` environment. It is not a `parts.appendix` frontmatter entry, and its headings are `#` level, for the reasons the template README gives under "Appendices". If there is only one appendix, then please refer to it in text as ... in the Appendix, with no letter and no cross-reference. If there is more than one appendix, then please refer to them as ... in Appendix {raw:latex}`\ref{appA}`, Appendix {raw:latex}`\ref{appB}`, etc.

Raw LaTeX is needed because MyST's LaTeX renderer labels every section-type target "Section" and **discards the link text**: `@appA`, `[Appendix A](#appA)`, `[Appendix {number}](#appA)` and `[Appendix %s](#appA)` all render "Section A". Supplying the word yourself and letting `\ref` supply the letter gives "Appendix A", and it still nests correctly ("Appendix B.1").

(appB)=

# Title of the second appendix

(appB1)=

## First subsection of Appendix B

If your appendix is long, make sure to divide it into subsections and refer to them in text. Use the standard LaTeX commands for headings in a `{appendix}` environment. Headings and other objects will be numbered automatically.

```{math}
:label: path
\mathcal{P}=(j_{k,1},j_{k,2},\dots,j_{k,m(k)}).
```

Sample of cross-reference to formula {eq}`path` in Appendix {raw:latex}`\ref{appB1}`. Note that it is better to refer to Appendix {raw:latex}`\ref{appB1}` as opposed to Appendix {raw:latex}`\ref{appB}`, because it is easier for the reader to locate the necessary place.

The word "Appendix" stays outside the raw role deliberately. HTML output drops the role, so putting the whole phrase inside it would leave a gap in the sentence on the website; this way the PDF reads "Appendix B.1" and the web page reads "Appendix", losing only the number.
