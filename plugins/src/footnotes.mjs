// LaTeX for the two footnote cases released myst-to-tex gets wrong. It writes the whole
// `\footnote{...}` at every reference, so:
// - a footnote inside a float or a table (a figure or table caption, a table cell) prints its
//   mark and loses its text, since LaTeX drops a `\footnote` inside a float or a `tabular`;
// - a footnote referenced twice prints its body twice, under two numbers.
// Both pass silently at exit 0 and are invisible on the site.
//
// Such a footnote becomes `\footnotemark[N]`, N counted from the footnote counter, and its text
// a `\footnotetext` right after the float or table in the body flow. A fixed N, since econsocart
// typesets a caption twice and a stepping `\footnotemark` would skip a number. A repeated footnote
// gets a `\label` at its first reference and `\footref` at the later ones. Every changed reference is
// swapped for a raw node (util.rawLatex), so the site keeps it. An inline repair that renders
// footnote bodies: it runs after the other inline repairs and before the block ones.

import { rawLatex, renderTex, replaceNode, texOnly } from './util.mjs';

const fnLabel = (id) => `fn:${id}`;

// The nodes whose LaTeX loses a `\footnote`: a container is a float, a table a `tabular`
const BOXES = new Set(['container', 'table']);

// Every footnote reference in reading order, with its parent and the outermost box holding it,
// with that box's parent. References inside a footnote's own text are left alone.
function footnoteRefs(node, parent, box, found) {
  if (node.type === 'footnoteDefinition') return found;
  if (node.type === 'footnoteReference') found.push({ node, parent, box });
  const outer = box ?? (BOXES.has(node.type) ? { node, parent } : undefined);
  node.children?.forEach((child) => footnoteRefs(child, node, outer, found));
  return found;
}

const footnotes = {
  name: 'footnotes',
  doc: 'LaTeX for footnotes in floats and tables and footnotes referenced twice',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const refs = footnoteRefs(tree, null, undefined, []);
    if (!refs.length) return;
    const defs = utils.selectAll('footnoteDefinition', tree);
    const byId = new Map(defs.map((def) => [def.identifier, def]));
    const uses = new Map();
    refs.forEach(({ node }) => uses.set(node.identifier, (uses.get(node.identifier) ?? 0) + 1));
    // The text of a footnote, labelled when another reference points back to it
    const text = (id) => {
      const label = uses.get(id) > 1 ? `\\label{${fnLabel(id)}}` : '';
      return renderTex(byId.get(id).children, defs, file).trim() + label;
    };
    const seen = new Set();
    const pending = new Map();
    refs.forEach(({ node, parent, box }) => {
      const id = node.identifier;
      if (!byId.has(id)) return;
      let tex;
      if (seen.has(id)) tex = `\\footref{${fnLabel(id)}}`;
      else if (box) {
        const notes = pending.get(box.node) ?? { parent: box.parent, texts: [] };
        pending.set(box.node, notes);
        notes.texts.push(text(id));
        tex = `\\footnotemark[\\numexpr\\value{footnote}+${notes.texts.length}\\relax]`;
      } else if (uses.get(id) > 1) tex = `\\footnote{${text(id)}}`;
      seen.add(id);
      if (tex) replaceNode(parent, node, rawLatex(node, tex));
    });
    // The texts follow their box, a raw node with nothing for the site to render. The optional
    // argument keeps hyperref from anchoring each text at the previous footnote's anchor.
    pending.forEach(({ parent, texts }, box) => {
      const tex = texts.map((t) => `\\stepcounter{footnote}\\footnotetext[\\value{footnote}]{${t}}`).join('\n');
      parent.children.splice(parent.children.indexOf(box) + 1, 0, texOnly(`\n${tex}\n\n`));
    });
  },
};

export default { repair: 'footnotes', transforms: [footnotes] };
