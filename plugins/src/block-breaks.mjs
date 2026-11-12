// Stock myst-to-tex closes no block after a proof (proof.js writes `\end{theorem}` and stops), and
// a raw block ends where its LaTeX ends, so the paragraph after a theorem, a quote or any block a
// repair wrote ran on from `\end{...}` and LaTeX set it unindented, as the same paragraph. A
// LaTeX-only blank line after each one ends the paragraph there; the site draws it as an empty span.

import { texOnly, walk } from './util.mjs';

// Parents whose children are blocks: a break anywhere else would land inside running text
const FLOW = new Set(['root', 'block', 'proof', 'admonition', 'exercise', 'solution', 'div', 'listItem', 'footnoteDefinition']);
const BREAK = '\n\n';
// Childless first, so the check never reads the lazy `tex` of a repair's raw node
const isBreak = (node) => node?.type === 'raw' && !node.children && node.tex === BREAK;

const blockBreaks = {
  name: 'block-breaks',
  doc: 'Ends the paragraph after each proof and raw block in the LaTeX export',
  stage: 'project',
  plugin: () => (tree) => {
    const after = [];
    walk(tree, (node, parent) => {
      // A raw node with children stands for a block a repair rewrote; a childless one is a command
      if (FLOW.has(parent?.type) && (node.type === 'proof' || (node.type === 'raw' && node.children?.length))) after.push([parent, node]);
    });
    for (const [parent, node] of after) {
      const i = parent.children.indexOf(node);
      if (!isBreak(parent.children[i + 1])) parent.children.splice(i + 1, 0, texOnly(BREAK));
    }
  },
};

export default { repair: 'block-breaks', transforms: [blockBreaks] };
