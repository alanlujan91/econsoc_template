// Helpers shared by the reference repairs (target-labels, unnumbered-refs, label-case,
// missing-refs, xref): the LaTeX for a reference that cannot be numbered, a link's own wording
// around its number, and the page's targets with the label myst-to-tex writes for each.

import { rawLatex, texEscape, textOf, walk } from './util.mjs';

// What a reference prints when LaTeX has no number for it: the `??` LaTeX prints for an undefined
// \ref, followed by the label, so a reader of the PDF can find the source line
export const missingTex = (label) => `\\textbf{??}${texEscape(label)}`;

// Split `text` around the last occurrence of `slot`; null when it does not occur
export function splitAt(text, slot) {
  const i = slot ? text.lastIndexOf(slot) : -1;
  return i < 0 ? null : [text.slice(0, i), text.slice(i + slot.length)];
}

// LaTeX for text with `middle` in the slot, tying the preceding word to it as myst-to-tex does
export const fill = ([before, after], middle) =>
  texEscape(before).replace(/\s+$/, '~') + middle + texEscape(after);

// The node for a reference whose LaTeX is `tex`. myst-to-tex's crossReference handler writes
// `template` when it holds `%s`, else the link's text, with each whitespace turned `~` and
// `%s` turned `\ref{label}`, unescaped. So a `tex` of one `\ref` and no whitespace, or the
// link's own plain text so written, is the node itself, steered, and reads as stock MyST
// output; any other `tex` needs a raw node, and the site an `\iffalse` copy of it.
export function refNode(node, tex) {
  if (/\s|%/.test(tex)) return rawLatex(node, tex);
  const refs = [...tex.matchAll(/\\ref\{([^{}]*)\}/g)];
  if (refs.length === 1) {
    node.template = tex.replace(refs[0][0], '%s');
    node.label = refs[0][1];
    return node;
  }
  const text = textOf(node);
  if (refs.length || texEscape(text) !== text || text.replace(/\s/g, '~') !== tex) return rawLatex(node, tex);
  delete node.template;
  return node;
}

// A reference to a target of this project: no glossary term, nor a link into another site
export const isProjectRef = (node, parent) =>
  node.type === 'crossReference' &&
  Boolean(parent) &&
  node.kind !== 'definitionTerm' &&
  !node.remoteBaseUrl &&
  !/^[a-z]+:/i.test(node.url ?? '');

// Nodes that hold a label without being a target
const NOT_TARGETS = new Set(['crossReference', 'link', 'cite', 'citeGroup', 'footnoteReference', 'footnoteDefinition', 'mystTarget']);

// identifier -> { node, parent, index } for every target of the tree
export function pageTargets(tree) {
  const targets = new Map();
  walk(tree, (node, parent, index) => {
    if (node.identifier && !NOT_TARGETS.has(node.type) && !targets.has(node.identifier)) {
      targets.set(node.identifier, { node, parent, index });
    }
  });
  return targets;
}

// The label myst-to-tex writes for a target, or undefined when it writes none: a proof gets its
// lowercased identifier, a heading, a captioned container and an equation their label as written
export function texLabelOf(node) {
  if (node.texLabel) return node.texLabel; // set by target-labels, which wrote one itself
  switch (node.type) {
    case 'proof':
      return node.identifier;
    // Written by exercises.mjs, as labelOf spells it
    case 'exercise':
    case 'solution':
      return node.label ?? node.identifier;
    case 'heading':
      return node.enumerated !== false && !node.implicit ? node.label : undefined;
    case 'math':
      return node.label;
    case 'container':
      return node.enumerated !== false && node.children?.some((c) => c.type === 'caption')
        ? (node.label ?? node.identifier)
        : undefined;
    default:
      return undefined;
  }
}
