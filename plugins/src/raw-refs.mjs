// MyST links written inside a raw LaTeX block. MyST never resolves them: "as in [](#tab-speed)"
// in a `{raw} latex` table note reaches the PDF verbatim (myst-references.md). At document stage
// each such link is copied into a hidden block at the end of the page, so MyST resolves it like any
// other, across documents too; at project stage, once the other reference repairs have written
// it, its LaTeX replaces the link's text in the raw block's `tex`, and the hidden block goes. Only
// `tex` changes: myst-to-tex writes it, while the site renders the block's parsed children, which
// stay as they are. Runs after xref, unnumbered-refs, label-case and missing-refs.

import { hiddenBlock, identifierOf, isHiddenBlock, renderTex, walk } from './util.mjs';
import { aliases } from './stacked-labels.mjs';

const LINK = /\[([^\]\n]*)\]\(#([^)\s]+)\)/g;
const MARKER = 'rawRefs';

const isRawLatex = (node) => node.type === 'raw' && typeof node.tex === 'string' && /^(la)?tex$/.test(node.lang ?? '');
const isMarker = (node) => isHiddenBlock(node, MARKER);

const inject = {
  name: 'econsoc-raw-refs-inject',
  doc: 'Copies each link written inside a raw LaTeX block into a hidden block, for MyST to resolve',
  stage: 'document',
  plugin: () => (tree) => {
    tree.children = (tree.children ?? []).filter((node) => !isMarker(node));
    const links = [];
    walk(tree, (node) => {
      if (!isRawLatex(node)) return;
      const found = [...node.tex.matchAll(LINK)];
      if (!found.length) return;
      node.rawRefs = found.map(([, text, label]) => {
        const survivor = aliases.get(identifierOf(label)) ?? label;
        links.push({
          type: 'link',
          url: `#${survivor}`,
          children: text ? [{ type: 'text', value: text }] : [],
          authoredText: text,
          rawRef: links.length,
        });
        return links.length - 1;
      });
    });
    if (links.length) {
      tree.children.push(hiddenBlock(MARKER, [{ type: 'paragraph', children: links }]));
    }
  },
};

const substitute = {
  name: 'econsoc-raw-refs',
  doc: 'Writes the LaTeX of each link inside a raw LaTeX block in place of its MyST text',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const hidden = (tree.children ?? []).find(isMarker);
    if (!hidden) return;
    tree.children = tree.children.filter((node) => node !== hidden);
    const written = new Map();
    for (const node of hidden.children[0].children) {
      const index = node.rawRef ?? node.children?.[0]?.rawRef;
      if (index === undefined) continue;
      written.set(index, renderTex([{ type: 'paragraph', children: [node] }], [], vfile).trim());
    }
    walk(tree, (node) => {
      if (!isRawLatex(node) || !node.rawRefs) return;
      let k = 0;
      const indices = node.rawRefs;
      node.tex = node.tex.replace(LINK, (match) => written.get(indices[k++]) ?? match);
      delete node.rawRefs;
    });
  },
};

export default { repair: 'raw-refs', transforms: [inject, substitute] };
