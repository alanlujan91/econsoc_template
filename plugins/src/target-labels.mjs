// Labels for targets the LaTeX export leaves unlabelled, and numbers for list items.
//
// myst-to-tex writes `\label` only for a heading, a captioned figure or table, an equation and a
// proof. A `(label)=` target on anything else (a paragraph, a list, a code block) gets none, so a
// worded link `[the result](#x)` becomes `\hyperref[x]{...}` to an undefined label: LaTeX logs
// "Hyper reference undefined" and the "There were undefined references" summary that hides the
// real ones. Each such target that a link of its page names gets `\phantomsection\label{x}`.
//
// A `(label)=` line opening an item of an ordered list attaches to the item's first paragraph,
// and MyST has no item numbers: `[](#x)` prints "Paragraph" on the site and in the PDF, and
// `[Item %s](#x)` prints `Item~\ref{x}` with no `\label`, so `??`. Here the item's paragraph opens
// with `\label{x}`, which LaTeX gives the item's number, and every reference to it gets the number
// as its enumerator with the template "Item %s", so the PDF prints `Item~\ref{x}`, a sibling
// document prints the number as text (xref), and the site link reads "Item 2" (a deliberate fix
// of the site too). A nested item's `\ref` in econsocart prints its own letter alone ("a"), so its
// label sets the number in full, from LaTeX's counters: "2(a)", then "2(a)i", then "2(a)iA".

import { labelOf, texOnly, walk } from './util.mjs';
import { pageTargets, texLabelOf } from './refs.mjs';

// identifier -> item number, per file, filled at document stage for every page of the project
const itemsByFile = new Map();

const alpha = (n) => String.fromCharCode(96 + n);
const roman = (n) =>
  [['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]].reduce((out, [s, v]) => {
    for (; n >= v; n -= v) out += s;
    return out;
  }, '');
// An item's number from those of its enumerate levels, and the counters LaTeX prints it from
const FORMATS = [
  ([a]) => `${a}`,
  ([a, b]) => `${a}(${alpha(b)})`,
  ([a, b, c]) => `${a}(${alpha(b)})${roman(c)}`,
  ([a, b, c, d]) => `${a}(${alpha(b)})${roman(c)}${alpha(d).toUpperCase()}`,
];
const COUNTERS = ['', '\\theenumi(\\theenumii)', '\\theenumi(\\theenumii)\\theenumiii', '\\theenumi(\\theenumii)\\theenumiii\\theenumiv'];

// The item's \label, preceded at a nested level by the full number for \ref to print
function itemLabel(level, label) {
  const number = COUNTERS[level - 1];
  return (number ? `\\expandafter\\edef\\csname @currentlabel\\endcsname{${number}}` : '') + `\\label{${label}}`;
}

function recordItems(node, levels, items) {
  if (node.type === 'list' && node.ordered) {
    node.children.forEach((item, i) => {
      // LaTeX counts from 1 whatever the list's start: econsocart reads myst-to-tex's [resume] as a width
      const path = [...levels, i + 1];
      const first = item.children?.[0];
      if (first?.type === 'paragraph' && first.identifier && path.length <= FORMATS.length) {
        items.set(first.identifier, { number: FORMATS[path.length - 1](path), level: path.length });
      }
      item.children?.forEach((child) => recordItems(child, path, items));
    });
    return;
  }
  node.children?.forEach((child) => recordItems(child, levels, items));
}

const itemNumbers = {
  name: 'econsoc-item-numbers',
  doc: 'Records the number LaTeX prints for each labelled item of an ordered list',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    const items = new Map();
    recordItems(tree, [], items);
    itemsByFile.set(vfile.path, items);
  },
};

function itemNumber(identifier, file, remote) {
  if (!remote) return itemsByFile.get(file)?.get(identifier)?.number;
  for (const [other, items] of itemsByFile) if (other !== file && items.has(identifier)) return items.get(identifier).number;
  return undefined;
}

const text = (value) => ({ type: 'text', value });

const targetLabels = {
  name: 'econsoc-target-labels',
  doc: 'Labels the targets myst-to-tex leaves unlabelled and numbers references to list items',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const referenced = new Set();
    walk(tree, (node) => {
      if (node.type !== 'crossReference' || node.kind === 'definitionTerm') return;
      const number = itemNumber(node.identifier, vfile.path, node.remote === true);
      if (!node.remote) referenced.add(node.identifier);
      if (number === undefined || node.kind !== 'paragraph') return;
      node.enumerator = number;
      node.template = 'Item %s';
      const authored = node.authoredText ?? '';
      if (authored.includes('%s')) node.children = [text(authored.replaceAll('%s', number))];
      else if (!authored) node.children = [text('Item '), text(number)];
    });
    const items = itemsByFile.get(vfile.path) ?? new Map();
    // Insert after collecting, last first, so earlier indices in a parent stay valid
    const inserts = [];
    for (const [identifier, { node, parent, index }] of pageTargets(tree)) {
      if (!referenced.has(identifier) || texLabelOf(node) || !parent) continue;
      const label = labelOf(node);
      node.texLabel = label;
      if (items.has(identifier)) node.texItem = true;
      else node.texPhantom = true;
      if (node.type === 'paragraph') {
        const item = items.get(identifier);
        const tex = item ? itemLabel(item.level, label) : `\\phantomsection\\label{${label}}`;
        node.children.unshift(texOnly(tex));
      } else {
        // After a heading, which the label must not precede; before anything else
        inserts.push([parent, node.type === 'heading' ? index + 1 : index, `\\phantomsection\\label{${label}}`]);
      }
    }
    inserts.sort((a, b) => b[1] - a[1]);
    for (const [parent, index, tex] of inserts) parent.children.splice(index, 0, texOnly(tex));
  },
};

export default { repair: 'target-labels', transforms: [itemNumbers, targetLabels] };
