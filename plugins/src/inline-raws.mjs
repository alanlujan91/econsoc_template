// Inline repairs on the site. Every repair swaps a node for a raw node holding the original as
// its child (util.rawLatex), and the site theme, which has no `raw` renderer, draws a raw node
// with children as a <div>: inside a paragraph, a caption, a title or a table cell the browser
// closes the paragraph there, and the rest of the sentence can set one letter per line. The site
// JSON looks right, so only a structural check or a rendered page shows it.
//
// Each such raw node becomes util.siteSafe's span: LaTeX unchanged, the original node in place
// for the site. Runs last, so it reaches every repair's inline raw nodes, including those in a
// block raw node's children, which the site renders and the block's LaTeX does not use.

import { siteSafe } from './util.mjs';

const inlineRaws = {
  name: 'inline-raws',
  doc: 'Keeps inline raw nodes inline on the site',
  stage: 'project',
  plugin: () => (tree) => siteSafe(tree),
};

export default { repair: 'inline-raws', transforms: [inlineRaws] };
