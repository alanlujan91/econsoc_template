// LaTeX for the inline nodes released myst-to-tex has no handler for. mystmd 1.12.0 logs
// `Unhandled LaTeX conversion for node of "smallcaps"` (the {sc} role) or `"keyboard"` (the {kbd}
// role), writes nothing in its place, and exits 0, so the words vanish from the PDF.
//
// {sc} becomes a span styled as the site styles small caps, its children bracketed by
// `\textsc{` and `}`, so both outputs render the children natively. {kbd} keeps its node for the
// site's <kbd> box behind a raw node of `\texttt{...}`; inline-raws.mjs keeps that raw node
// inline on the site, and its `\iffalse` copy of the node still logs the line above.
// An inline repair: it runs before footnotes.mjs and the block repairs.

import { collect, rawLatex, renderTex, replaceNode, texOnly } from './util.mjs';

const smallcapsTransform = {
  name: 'smallcaps',
  doc: 'LaTeX for {sc} and {kbd}, which released myst-to-tex drops',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const found = collect(tree, (node) => node.type === 'smallcaps' || node.type === 'keyboard');
    if (!found.length) return;
    const footnotes = utils.selectAll('footnoteDefinition', tree);
    found.forEach(({ node, parent }) => {
      const children = node.children ?? [];
      if (node.type === 'smallcaps') {
        const style = { fontVariant: 'small-caps' };
        replaceNode(parent, node, { type: 'span', style, children: [texOnly('\\textsc{'), ...children, texOnly('}')] });
      } else {
        replaceNode(parent, node, rawLatex(node, `\\texttt{${renderTex(children, footnotes, file).trim()}}`));
      }
    });
  },
};

export default { repair: 'smallcaps', transforms: [smallcapsTransform] };
