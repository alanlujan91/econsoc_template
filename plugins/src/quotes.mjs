// LaTeX for a blockquote with an attribution. MyST reads a final `> -- Name` line after a blank
// `>` line as an attribution and wraps the quote in a container of kind `quote`, which myst-to-tex
// writes as a `figure` float holding `quote` and `\caption*{Name}`. econsocart ignores the star:
// the quote floats away from its paragraph and prints a phantom "FIGURE 0." under it, at exit 0.
//
// Each such container is rendered as a plain `quote` environment with the attribution set flush
// right on its last line, no float, and swapped for a raw node (util.rawLatex), so the site keeps
// its quote and attribution. A block repair: it renders a subtree, so inline repairs run first.

import { collect, rawLatex, renderTex, replaceNode } from './util.mjs';

const quotes = {
  name: 'quotes',
  doc: 'LaTeX for attributed blockquotes, which released myst-to-tex writes as a figure',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const found = collect(tree, (node) => node.type === 'container' && node.kind === 'quote');
    if (!found.length) return;
    const footnotes = utils.selectAll('footnoteDefinition', tree);
    const render = (nodes) => renderTex(nodes, footnotes, file).trim();
    found.forEach(({ node, parent }) => {
      const quote = node.children.find((child) => child.type === 'blockquote');
      const caption = node.children.find((child) => child.type === 'caption');
      if (!quote || !caption) return;
      const tex = () => `\n\\begin{quote}\n${render(quote.children)}\n\\par\\hfill---${render(caption.children)}\n\\end{quote}\n\n`;
      replaceNode(parent, node, rawLatex(node, tex));
    });
  },
};

export default { repair: 'quotes', transforms: [quotes] };
