// Heading depth in frontmatter parts (jupyter-book/mystmd#2351, fix in #2352, unmerged). MyST
// numbers a page's headings from the export's article level (0 in a single-article export, so
// `#` is \section), but transforms each part with no level, as on the site, so a part's `#`
// becomes \subsection: an appendix part `parts: {appendix: appendix.md}` loses its letters.
//
// A plugin cannot tell an export from the site, but the page's depth shows which: MyST runs the
// document stage of every file once per export (its article at depth 1, the rest at 2, the
// site's way) and once for the site, each page before its parts, and only then any project
// stage. So when a part's document stage runs, its page's top heading depth is the one of the
// same run, and a part whose top heading sits deeper is shifted up to match it there. On the
// site, and where the page is only another export's dependency, both sit at 2 and nothing moves.

import fs from 'node:fs';
import { pageParts, walk } from './util.mjs';

// Page -> its top heading depth in the run under way; part file -> its page
const pageDepth = new Map();
const pageOfPart = new Map();

function shallowest(tree) {
  let depth = Infinity;
  walk(tree, (node) => {
    if (node.type === 'heading' && node.depth < depth) depth = node.depth;
  });
  return depth;
}

const alignDepths = {
  name: 'parts-align-depths',
  doc: 'Lifts the headings of a frontmatter part to the depth of its page headings',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    const file = vfile.path;
    if (!file) return;
    // An inline part is `<page>#parts.<name>`; a page names its file parts in its frontmatter
    const page = file.includes('#') ? file.slice(0, file.indexOf('#')) : pageOfPart.get(file);
    if (!page) {
      pageDepth.set(file, shallowest(tree));
      if (fs.existsSync(file)) for (const part of pageParts(file)) if (part.file) pageOfPart.set(part.file, file);
      return;
    }
    const shift = shallowest(tree) - (pageDepth.get(page) ?? Infinity);
    // NaN or Infinity when either has no heading: nothing to align with
    if (!(shift > 0 && Number.isFinite(shift))) return;
    walk(tree, (node) => {
      if (node.type === 'heading') node.depth -= shift;
    });
  },
};

export default { repair: 'part-headings', transforms: [alignDepths] };
