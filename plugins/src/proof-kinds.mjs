// LaTeX for the four proof kinds that released myst-to-tex drops. mystmd 1.12.0 (myst-to-tex
// 1.0.48) has no environment for {prf:assumption}, {prf:algorithm}, {prf:criterion} or
// {prf:property}: it logs `Unhandled LaTeX proof environment` and writes neither the body nor
// the `\label`, so every `\ref` to one prints `??` (jupyter-book/mystmd#3030, fix in #3031).
// The site renders them fine.
//
// mystmd has no renderer plugins, so this project-stage transform renders each such block with
// the myst-to-tex bundled here, which carries PR 3031 (see ../build.mjs), and swaps the proof
// node for a `raw` node: myst-to-tex writes the node's `tex`, and the site renders its
// `children`, the untouched proof node, so the page keeps its "Assumption 1" box. The site
// labels a box from its `kind`, so the kind cannot be changed to one myst-to-tex knows.
// template.tex defines the four environments.
//
// The outer render never sees inside the raw node: a math macro or a package used only inside
// these blocks is not added to the preamble. Citations reach main.bib, harvested before this
// stage runs.
//
// Built into ../proof-kinds.mjs by `npm run build` in plugins/; edit this file, not the bundle.

import { unified } from 'unified';
import { VFile } from 'vfile';
import mystToTex from 'myst-to-tex';

const KINDS = new Set(['assumption', 'algorithm', 'criterion', 'property']);

// Every proof node of a dropped kind, with its parent, innermost first, so that an outer block
// renders an inner one already swapped for its raw node.
function collect(node, parent, found) {
  node.children?.forEach((child) => collect(child, node, found));
  if (node.type === 'proof' && KINDS.has(node.kind)) found.push({ node, parent });
  return found;
}

// myst-to-tex on a detached root holding the one block. Footnote definitions are looked up from
// the root of the tree being rendered, so the page's own are appended; their handler writes
// nothing in place. The nodes are cloned because the proof handler deletes the title it reads,
// and the site shows the original.
function toTex(proof, footnotes, file) {
  const root = { type: 'root', children: structuredClone([proof, ...footnotes]) };
  const sub = new VFile({ path: file.path });
  const pipe = unified().use(mystToTex);
  const out = pipe.stringify(pipe.runSync(root, sub), sub);
  file.messages.push(...sub.messages);
  return `\n${out.result.value}\n`;
}

const proofKinds = {
  name: 'LaTeX for dropped proof kinds',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const found = collect(tree, null, []);
    if (!found.length) return;
    const footnotes = utils.selectAll('footnoteDefinition', tree);
    found.forEach(({ node, parent }) => {
      const tex = toTex(node, footnotes, file);
      parent.children[parent.children.indexOf(node)] = { type: 'raw', lang: 'latex', tex, children: [node] };
    });
  },
};

export default {
  name: 'Proof kinds',
  transforms: [proofKinds],
};
