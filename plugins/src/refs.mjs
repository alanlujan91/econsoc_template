// The reference and label repairs: xref, target-labels, unnumbered-refs, missing-refs,
// label-case, stacked-labels, raw-refs and section-numbering, with the helpers they share (the
// LaTeX for a reference that cannot be numbered, a link's own wording around its number, and the
// page's targets with the label myst-to-tex writes for each).

import fs from 'node:fs';
import path from 'node:path';
import {
  escapeRegExp as escape,
  hiddenBlock,
  identifierOf,
  isHiddenBlock,
  labelOf,
  pageParts,
  plainText,
  projectConfig,
  projectRoot,
  rawLatex,
  readFrontmatter,
  renderTex,
  texEscape,
  texOnly,
  textOf,
  walk,
} from './util.mjs';

// What a reference prints when LaTeX has no number for it: the `??` LaTeX prints for an undefined
// \ref, followed by the label, so a reader of the PDF can find the source line
const missingTex = (label) => `\\textbf{??}${texEscape(label)}`;

// Split `text` around the last occurrence of `slot`; null when it does not occur
function splitAt(text, slot) {
  const i = slot ? text.lastIndexOf(slot) : -1;
  return i < 0 ? null : [text.slice(0, i), text.slice(i + slot.length)];
}

// LaTeX for text with `middle` in the slot, tying the preceding word to it as myst-to-tex does
const fill = ([before, after], middle) =>
  texEscape(before).replace(/\s+$/, '~') + middle + texEscape(after);

// The node for a reference whose LaTeX is `tex`. myst-to-tex's crossReference handler writes
// `template` when it holds `%s`, else the link's text, with each whitespace turned `~` and
// `%s` turned `\ref{label}`, unescaped. So a `tex` of one `\ref` and no whitespace, or the
// link's own plain text so written, is the node itself, steered, and reads as stock MyST
// output; any other `tex` needs a raw node, and the site an `\iffalse` copy of it.
function refNode(node, tex) {
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
const isProjectRef = (node, parent) =>
  node.type === 'crossReference' &&
  Boolean(parent) &&
  node.kind !== 'definitionTerm' &&
  !node.remoteBaseUrl &&
  !/^[a-z]+:/i.test(node.url ?? '');

// Nodes that hold a label without being a target
const NOT_TARGETS = new Set(['crossReference', 'link', 'cite', 'citeGroup', 'footnoteReference', 'footnoteDefinition', 'mystTarget']);

// identifier -> { node, parent, index } for every target of the tree
function pageTargets(tree) {
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
function texLabelOf(node) {
  if (node.texLabel) return node.texLabel; // set by target-labels, which wrote one itself
  switch (node.type) {
    case 'proof':
      return node.identifier;
    // Written by the exercises repair (proofs.mjs), as labelOf spells it
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

// ---------------------------------------------------------------------------------------------
// xref
// Cross-references in LaTeX exports: the number LaTeX prints, the words the author wrote, and plain
// text for targets in a sibling document (article to supplement and back).
//
// Released myst-to-tex (1.12.0) gets four cases wrong, each silently, at exit 0:
//   1. A target in another document of the project is written `\ref{label}`. Each export compiles
//      alone, so the label is undefined and the PDF prints `??`. The class forbids `xr`/`xr-hyper`
//      ("Replace all references to external documents with plain text", econsocart.cfg), so this
//      writes the number as plain text. MyST already resolves it from the sibling's numbering.
//   2. A link's own wording is discarded: `[Sec %s](#x)` and `[the model](#x)` both print
//      `Section~\ref{x}`, because the kind's template wins over the link text.
//   3. In a single-article export a top-level heading has no number (jupyter-book/mystmd#3035): a
//      bare link prints the heading's title and `[Sec %s](#x)` prints `Sec ??`.
//   4. A section inside the appendix is labelled "Section"; MyST knows nothing of the
//      `\begin{appendix}` raw block or of the appendix part template.tex sets inside one, so
//      a sibling document also gets its number wrong.
// Each fix steers the crossReference or replaces it with a raw node (refNode), so only the
// LaTeX changes.

const APPENDIX_OPEN = /\\begin\s*\{appendix\}|\\appendix(?![A-Za-z])/;
const APPENDIX_CLOSE = /\\end\s*\{appendix\}/;

// Per file of the project, filled at document stage: appendix label -> the number LaTeX prints
// for it ("A", "B.1"), counting the headings inside a raw `\begin{appendix}` block (`raw`) or,
// for an appendix part, which template.tex sets inside one, all of them (`whole`)
const appendixByFile = new Map();
// Appendix part (inline, `<page>#parts.appendix`, or a file) -> its page
const appendixParts = new Map();

const alph = (n) => String.fromCharCode(64 + n);

// True when the link shows what MyST writes for its kind, rather than words of the author's own
const isDefault = (node, text) =>
  node.enumerator != null && text === node.template?.replaceAll('%s', node.enumerator);

const appendixOf = (file) => appendixByFile.get(file)?.[appendixParts.has(file) ? 'whole' : 'raw'] ?? new Map();

// The appendix numbers an export of `page` prints: its own, and its appendix part's
function pageAppendix(page) {
  const parts = [...appendixParts].filter(([, owner]) => owner === page).map(([part]) => appendixOf(part));
  return new Map([appendixOf(page), ...parts].flatMap((numbers) => [...numbers]));
}

// The number LaTeX prints for an appendix heading of any page, or undefined
function appendixNumber(label) {
  for (const file of appendixByFile.keys()) if (appendixOf(file).has(label)) return appendixOf(file).get(label);
  return undefined;
}

// Numbers `heading` as a heading of an appendix, with `counts` the count so far at each level
function numberHeading(numbers, counts, heading, top) {
  const level = heading.depth - top;
  counts.length = level + 1;
  counts[level] = (counts[level] ?? 0) + 1;
  const parts = Array.from(counts, (c) => c ?? 1);
  const label = labelOf(heading);
  if (label) numbers.set(label, [alph(parts[0]), ...parts.slice(1)].join('.'));
}

const xrefSource = {
  name: 'econsoc-xref-source',
  doc: 'Records what the author wrote in each link, and the number LaTeX prints for each appendix heading',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    const depths = [];
    walk(tree, (node) => {
      // Before resolution fills an empty link with its target's name, so a link worded as its
      // section's title can be told from a bare one
      if (node.type === 'link' || node.type === 'crossReference') node.authoredText = plainText(node);
      if (node.type === 'heading') depths.push(node.depth);
    });
    const numbers = { raw: new Map(), whole: new Map() };
    const counts = { raw: [], whole: [] };
    const top = Math.min(...depths);
    let inside = false;
    walk(tree, (node) => {
      if (node.type === 'raw') {
        const source = node.tex ?? node.value ?? '';
        if (APPENDIX_OPEN.test(source)) inside = true;
        if (APPENDIX_CLOSE.test(source)) inside = false;
        return;
      }
      if (node.type !== 'heading') return;
      numberHeading(numbers.whole, counts.whole, node, top);
      if (inside) numberHeading(numbers.raw, counts.raw, node, top);
    });
    appendixByFile.set(vfile.path, numbers);
    if (vfile.path?.includes('#')) return;
    for (const part of pageParts(vfile.path)) {
      if (part.name === 'appendix') appendixParts.set(part.file ?? `${vfile.path}#parts.appendix`, vfile.path);
    }
  },
};

// LaTeX for a reference into another document: its number as plain text
function remoteTex(node, text) {
  const appendix = appendixNumber(labelOf(node));
  const slot = splitAt(text, node.enumerator);
  if (!slot) return texEscape(text);
  if (appendix && isDefault(node, text) && node.kind === 'heading') return `Appendix~${texEscape(appendix)}`;
  return fill(slot, texEscape(appendix ?? node.enumerator));
}

// LaTeX for a reference within the document, or undefined when myst-to-tex already writes it right
function localTex(node, text, page) {
  const label = labelOf(node);
  const ref = `\\ref{${label}}`;
  const word = page.appendix.has(label) ? 'Appendix' : 'Section';
  const number = node.enumerator;
  if (number != null && node.template?.includes('%s')) {
    if (isDefault(node, text)) {
      return node.kind === 'heading' && page.appendix.has(label) ? `Appendix~${ref}` : undefined;
    }
    const slot = splitAt(text, number);
    return slot ? fill(slot, ref) : `\\hyperref[${label}]{${texEscape(text)}}`;
  }
  const missing = splitAt(text, '??');
  if (missing) return fill(missing, ref);
  // A node this plugin did not see at document stage falls back to comparing with the title
  const worded = node.authoredText === undefined ? text !== page.titles.get(label) : node.authoredText !== '';
  if (worded) return `\\hyperref[${label}]{${texEscape(text)}}`;
  const numbered = page.numbered || page.appendix.has(label) || numberedHeadings.has(node.identifier);
  if (node.kind === 'heading' && numbered) return `${word}~${ref}`;
  return undefined;
}

const crossReferences = {
  name: 'econsoc-xref',
  doc: 'Writes cross-references the way the PDF needs them; the site keeps the original node',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const page = { appendix: pageAppendix(vfile.path), titles: new Map(), numbered: false };
    walk(tree, (node) => {
      if (node.type !== 'heading') return;
      if (node.enumerator != null) page.numbered = true;
      const label = labelOf(node);
      const title = plainText(node);
      if (label && title != null) page.titles.set(label, title);
    });
    walk(tree, (node, parent, index) => {
      if (!isProjectRef(node, parent)) return;
      const text = plainText(node);
      const remote = node.remote === true;
      if (text == null) {
        if (remote) vfile.message(`econsoc-xref: cannot write "${labelOf(node)}" as plain text; its link holds math or markup`, node);
        return;
      }
      const tex = remote ? remoteTex(node, text) : localTex(node, text, page);
      if (tex === undefined) return;
      parent.children[index] = refNode(node, tex);
    });
  },
};

export const xref = { repair: 'xref', transforms: [xrefSource, crossReferences] };

// ---------------------------------------------------------------------------------------------
// target-labels
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
      // From the list's start, which list-start makes LaTeX count from too
      const path = [...levels, (node.start ?? 1) + i];
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

const textNode = (value) => ({ type: 'text', value });

const targetLabelsTransform = {
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
      if (authored.includes('%s')) node.children = [textNode(authored.replaceAll('%s', number))];
      else if (!authored) node.children = [textNode('Item '), textNode(number)];
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

export const targetLabels = { repair: 'target-labels', transforms: [itemNumbers, targetLabelsTransform] };

// ---------------------------------------------------------------------------------------------
// unnumbered-refs
// References to targets that have no number. MyST prints the kind's bare word for them ("Paragraph",
// "Equation"), and for `[Equation %s](#x)` the LaTeX gets `Equation~\ref{x}`; LaTeX then prints the
// last number before the target (a labelled `:enumerated: false` equation still writes `\label`
// inside `equation*`) or `??`. The first is a wrong number at exit 0; neither is caught by a gate
// that greps the PDF for `??`. Such a reference now prints `??label` and the build warns, whatever
// the target: a paragraph that is no list item (target-labels numbers those), a code block, an
// unnumbered equation or figure, or a heading on a page with `numbering: {headings: false}`
// (section-numbering). A bare link to a heading prints its title and one to a solution "Solution
// to Exercise 1", as the site does; a worded link keeps its words. Runs before xref, which would
// turn the `??` back into `\ref`.

// Whether LaTeX numbers a target of the page: MyST also numbers a code block ("Program 2.1"),
// which myst-to-tex writes with neither number nor label
function texNumbers(target) {
  switch (target.type) {
    // A `fact` or a `:nonumber:` block is a starred environment, and an exercise is numbered
    // by the exercises repair; a solution's environment is starred
    case 'proof':
    case 'exercise':
      return target.enumerated !== false;
    // A heading's label from target-labels, an implicit one's included, sits after it, so \ref
    // prints its number; one before an uncaptioned figure would print the section's
    case 'heading':
      return target.enumerated !== false;
    case 'container':
      return Boolean(texLabelOf(target)) && !target.texPhantom;
    case 'math':
      return target.enumerated !== false && Boolean(target.label);
    case 'paragraph':
      return Boolean(target.texItem);
    default:
      return false;
  }
}

function hasNoNumber(node, targets) {
  if ((node.kind === 'heading' || node.kind === 'equation') && unnumberedTargets.has(node.identifier)) return true;
  const target = node.remote ? undefined : targets.get(node.identifier)?.node;
  if (target) return !texNumbers(target);
  // In a sibling document, MyST's number is all there is
  return node.enumerator == null ? node.kind !== 'heading' : node.kind === 'code';
}

// The site's "Solution to Exercise 1": the solution's own heading, linked to it (`\ref*`, since a
// link inside a link breaks), or MyST's text for a solution in the sibling document
function solutionTex(node, target, file) {
  if (!target) return texEscape(plainText(node) ?? '');
  const title = target.children?.find((child) => child.type === 'admonitionTitle')?.children ?? [];
  return () => `\\hyperref[${texLabelOf(target)}]{${renderTex(title, [], file).trim().replaceAll('\\ref{', '\\ref*{')}}`;
}

// LaTeX with `??label` in the number's place, the title a bare link prints, or undefined when the
// reference prints its words
function unnumberedTex(node, target, file) {
  const label = labelOf(node);
  const text = plainText(node) ?? '';
  const authored = node.authoredText ?? (text === node.template ? '' : text.replace('??', '%s'));
  if (authored.includes('%s')) return fill(splitAt(authored, '%s'), missingTex(label));
  if (authored) return undefined;
  if (node.kind === 'solution') return solutionTex(node, target, file);
  if (node.kind !== 'heading') return missingTex(label);
  const title = target ? plainText(target) : unnumberedTargets.get(node.identifier);
  return title == null ? undefined : texEscape(title).replace(/\s+/g, '~');
}

const unnumberedRefsTransform = {
  name: 'econsoc-unnumbered-refs',
  doc: 'Prints ?? and warns for a reference to a target the PDF does not number',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const targets = pageTargets(tree);
    walk(tree, (node, parent, index) => {
      if (!isProjectRef(node, parent) || !hasNoNumber(node, targets)) return;
      const target = node.remote ? undefined : targets.get(node.identifier)?.node;
      const tex = unnumberedTex(node, target, vfile);
      if (tex === undefined) return;
      if (typeof tex === 'string' && tex.includes('{??}')) {
        vfile.message(`econsoc: the reference to "${labelOf(node)}" prints ??, its ${node.kind} target has no number`, node);
      }
      parent.children[index] = rawLatex(node, tex);
    });
  },
};

export const unnumberedRefs = { repair: 'unnumbered-refs', transforms: [unnumberedRefsTransform] };

// ---------------------------------------------------------------------------------------------
// missing-refs
// Links to labels that do not exist. MyST leaves `[](#x)` a plain link when no target has the
// label x, and myst-to-tex writes `\href{\#x}{}`: the PDF prints nothing at all, so "the class
// member [](#x) describes" reads "the class member describes" and no `??` gate sees it
// (myst-references.md). Such a link now prints `??x` and the build warns. A label defined by
// `\label{x}` in a raw LaTeX block of the page is no miss: the link becomes a `\ref` to it, with
// the word of the environment around that label ("Table~\ref{x}", or `(\ref{x})` for an equation).

const EQUATIONS = new Set(['equation', 'align', 'gather', 'multline', 'eqnarray', 'flalign', 'alignat']);

// The innermost environment open at `at` in `tex`, starred form folded in
function environmentAt(tex, at) {
  const open = [];
  for (const m of tex.slice(0, at).matchAll(/\\(begin|end)\s*\{([A-Za-z]+)\*?\}/g)) {
    if (m[1] === 'begin') open.push(m[2]);
    else open.pop();
  }
  return open.at(-1);
}

// label -> environment name (or '') of every `\label` in a raw LaTeX node of the tree
function rawLabels(tree) {
  const labels = new Map();
  walk(tree, (node) => {
    if (node.type !== 'raw' || typeof node.tex !== 'string') return;
    for (const m of node.tex.matchAll(/\\label\{([^}]+)\}/g)) labels.set(m[1], environmentAt(node.tex, m.index) ?? '');
  });
  return labels;
}

// LaTeX for a link to a label of a raw block
function rawTargetTex(label, env, text) {
  const ref = `\\ref{${label}}`;
  if (text.includes('%s')) return fill(splitAt(text, '%s'), ref);
  if (text) return `\\hyperref[${label}]{${texEscape(text)}}`;
  if (EQUATIONS.has(env)) return `(${ref})`;
  return env && env !== 'center' ? `${env[0].toUpperCase()}${env.slice(1)}~${ref}` : ref;
}

const missingRefsTransform = {
  name: 'econsoc-missing-refs',
  doc: 'Prints ?? and warns for a link to a label nothing defines',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const raw = rawLabels(tree);
    walk(tree, (node, parent, index) => {
      if (node.type !== 'link' || !parent || !/^#./.test(node.url ?? '')) return;
      const label = decodeURIComponent(node.url.slice(1));
      const text = plainText(node) ?? '';
      if (raw.has(label)) {
        parent.children[index] = rawLatex(node, rawTargetTex(label, raw.get(label), text));
        return;
      }
      vfile.message(`econsoc: no target has the label "${label}", so the PDF prints ??${label}`, node);
      const tex = text.includes('%s') ? fill(splitAt(text, '%s'), missingTex(label)) : missingTex(label);
      parent.children[index] = rawLatex(node, text && !text.includes('%s') ? `${texEscape(text)}~${tex}` : tex);
    });
  },
};

export const missingRefs = { repair: 'missing-refs', transforms: [missingRefsTransform] };

// ---------------------------------------------------------------------------------------------
// label-case
// The case of a label in `\ref`. MyST resolves a reference by its lowercased identifier, while
// myst-to-tex writes `\ref{...}` with the label as the link spells it and `\label{...}` with the
// target's own spelling, lowercased for a proof (proof.js writes its identifier). So `(sec-Model)=`
// with `[](#sec-model)`, or `:label: thm-Main` on a theorem with `[](#thm-Main)`, works on the site
// and prints `??` in the PDF. Every `\ref` and `\hyperref` to a target of the page now takes the
// label the target writes. Runs after the repairs that write references (xref, unnumbered-refs).

const labelCaseTransform = {
  name: 'econsoc-label-case',
  doc: 'Spells every \\ref label the way its target writes \\label',
  stage: 'project',
  plugin: () => (tree) => {
    const targets = pageTargets(tree);
    walk(tree, (node, parent) => {
      const ref = node.type === 'raw' && node.children?.[0]?.type === 'crossReference' ? node.children[0] : node;
      if (ref.type !== 'crossReference' || ref.remote || !parent || ref.kind === 'definitionTerm') return;
      const target = targets.get(ref.identifier);
      const wanted = target && texLabelOf(target.node);
      const written = labelOf(ref);
      if (!wanted || wanted === written) return;
      // myst-to-tex writes a crossReference's \ref from its label, a steered one's too (refNode)
      if (node === ref) ref.label = wanted;
      else {
        const old = escape(written);
        node.tex = node.tex
          .replace(new RegExp(`\\\\ref\\{${old}\\}`, 'g'), `\\ref{${wanted}}`)
          .replace(new RegExp(`\\\\hyperref\\[${old}\\]`, 'g'), `\\hyperref[${wanted}]`);
      }
    });
  },
};

export const labelCase = { repair: 'label-case', transforms: [labelCaseTransform] };

// ---------------------------------------------------------------------------------------------
// stacked-labels
// Labels lost to stacking. MyST gives a node one label: of `(a)=` and `(b)=` on consecutive lines
// above a heading only `a` survives, and a `(a)=` line directly above a directive replaces its
// `:label: b`. Links to `b` then print nothing in the PDF and never resolve on the site (MyST
// warns "label replaced", then "No target for internal reference"). Each lost label becomes an
// alias of the one that survived: before resolution, every link and reference to it is pointed at
// the survivor, in every page of the project, so both outputs resolve it (a fix of the site too).
//
// The lost labels are gone from the tree by document stage, so they are read from the sources:
// every .md file under the project directory, scanned once, so a page sees the aliases of a
// sibling page whatever order MyST processes them in. The first label of a stack survives, as
// MyST's transferTargetAttrs decides (measured on 1.12.0, three stacked targets on an equation).

const TARGET = /^\s*\(([^()\s]+)\)=\s*$/;
const FENCE = /^\s*(`{3,}|~{3,}|:{3,})\s*(\{[^}]*\})?/;
const OPTION = /^\s*:([\w-]+):\s*(.*?)\s*$/;

// project directory -> Map(identifier of a lost label -> surviving label)
const aliasesByRoot = new Map();
// identifier -> surviving label, for the other repairs (raw-refs); empty while this one is off
const aliases = new Map();

function markdownFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_build') || entry.name === 'node_modules') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(file, out);
    else if (/\.md$/i.test(entry.name)) out.push(file);
  }
  return out;
}

// The stacks of one source: arrays of labels, the survivor first
function stacks(source) {
  const lines = source.split(/\r?\n/);
  const found = [];
  // Open fences, innermost last: a code fence hides its lines, a directive fence does not
  const fences = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(FENCE);
    const top = fences.at(-1);
    if (open && !open[2] && top && open[1][0] === top.mark[0] && open[1].length >= top.mark.length) {
      fences.pop();
      continue;
    }
    if (top?.code) continue;
    if (open && (open[2] || open[1][0] !== ':')) {
      fences.push({ mark: open[1], code: !open[2] });
      if (!open[2]) continue;
    }
    if (!TARGET.test(lines[i])) continue;
    const stack = [];
    for (; i < lines.length && TARGET.test(lines[i]); i++) stack.push(lines[i].match(TARGET)[1]);
    if (lines[i]?.match(FENCE)?.[2]) {
      for (let j = i + 1; j < lines.length && OPTION.test(lines[j]); j++) {
        const [, key, value] = lines[j].match(OPTION);
        if (key === 'label' && value) stack.push(value);
      }
    }
    i--;
    if (stack.length > 1) found.push(stack);
  }
  return found;
}

function projectAliases(file) {
  const root = projectRoot(file);
  if (!aliasesByRoot.has(root)) {
    const map = new Map();
    for (const source of markdownFiles(root)) {
      for (const [survivor, ...lost] of stacks(fs.readFileSync(source, 'utf8'))) {
        for (const label of lost) if (identifierOf(label) !== identifierOf(survivor)) map.set(identifierOf(label), survivor);
      }
    }
    aliasesByRoot.set(root, map);
  }
  return aliasesByRoot.get(root);
}

const stackedLabelsTransform = {
  name: 'econsoc-stacked-labels',
  doc: 'Points links to a label lost to a stack of targets at the label that survived',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    if (!vfile.path || !fs.existsSync(vfile.path.split('#')[0])) return;
    const map = projectAliases(vfile.path.split('#')[0]);
    for (const [k, v] of map) aliases.set(k, v);
    if (!map.size) return;
    walk(tree, (node) => {
      if (node.type === 'link' && /^#./.test(node.url ?? '')) {
        const survivor = map.get(identifierOf(decodeURIComponent(node.url.slice(1))));
        if (survivor) node.url = `#${survivor}`;
      } else if (node.type === 'crossReference' && map.has(node.identifier)) {
        node.label = map.get(node.identifier);
        node.identifier = identifierOf(node.label);
      }
    });
  },
};

export const stackedLabels = { repair: 'stacked-labels', transforms: [stackedLabelsTransform] };

// ---------------------------------------------------------------------------------------------
// raw-refs
// MyST links written inside a raw LaTeX block. MyST never resolves them: "as in [](#tab-speed)"
// in a `{raw} latex` table note reaches the PDF verbatim (myst-references.md). At document stage
// each such link is copied into a hidden block at the end of the page, so MyST resolves it like any
// other, across documents too; at project stage, once the other reference repairs have written
// it, its LaTeX replaces the link's text in the raw block's `tex`, and the hidden block goes. Only
// `tex` changes: myst-to-tex writes it, while the site renders the block's parsed children, which
// stay as they are. Runs after xref, unnumbered-refs, label-case and missing-refs.

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

export const rawRefs = { repair: 'raw-refs', transforms: [inject, substitute] };

// ---------------------------------------------------------------------------------------------
// section-numbering
// The numbering keys that turn headings or equations off (`headings`, `heading_N`, `equation`,
// `all`) reach the site and never the LaTeX. Each unnumbered heading is set with secnumdepth
// lowered around it, which also unnumbers a level above a numbered one, and each equation starred.

// identifier -> title (null for an equation) of every target these keys unnumber, and the
// headings they number, which xref then refers to by number, project-wide
const unnumberedTargets = new Map();
const numberedHeadings = new Set();

const NUMBERING_ALIASES = {
  sections: 'headings', equations: 'equation', math: 'equation', titles: 'title',
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].flatMap((n) => [[`h${n}`, `heading_${n}`], [`heading${n}`, `heading_${n}`]])),
};

// A numbering item's `enabled`, as myst-frontmatter validates it, or undefined when it sets none
function enabledOf(item) {
  if (typeof item === 'boolean') return item;
  if (typeof item === 'string' && /^(true|false)$/i.test(item)) return item.toLowerCase() === 'true';
  return typeof item?.enabled === 'boolean' ? item.enabled : undefined;
}

const numberingOf = (value) => {
  const object = enabledOf(value) === undefined || typeof value === 'object' ? value : { all: value };
  return Object.fromEntries(Object.entries(object ?? {}).map(([key, item]) => [NUMBERING_ALIASES[key] ?? key, item]));
};

// What a page's keys set (myst-frontmatter fillNumbering): the page's own key (`headings` for a
// heading level), then its `all`, then the project's. Only a key set false unnumbers the LaTeX,
// which numbers headings MyST leaves off by default; one set true marks a heading numbered.
function pageNumbering(file) {
  if (!file || file.includes('#')) return null;
  const page = numberingOf(readFrontmatter(file).numbering);
  const project = numberingOf(projectConfig(path.dirname(file)).numbering);
  const enabled = (key) => {
    for (const n of [page, project]) {
      const own = enabledOf(n[key]) ?? (key.startsWith('heading_') ? enabledOf(n.headings) : undefined);
      if ((own ?? enabledOf(n.all)) !== undefined) return own ?? enabledOf(n.all);
    }
    return undefined;
  };
  const title = page.title ?? project.title;
  // The site numbers a heading by its rank among the page's depths, shifted by a numbered title
  const shift = (enabledOf(title) ? 1 : 0) + (title?.offset ?? 0);
  const heading = (rank) => enabled(`heading_${rank + 1 + shift}`);
  const headingOff = (rank) => heading(rank) === false;
  const equationOff = enabled('equation') === false;
  const off = [0, 1, 2, 3, 4, 5].some(headingOff) || equationOff;
  return { off, headingOff, equationOff, headingOn: (rank) => heading(rank) === true };
}

// rank of each heading depth of the tree: the same for the site and an export, whose depths differ
function depthRanks(tree) {
  const depths = new Set();
  walk(tree, (node) => node.type === 'heading' && depths.add(node.depth));
  return new Map([...depths].sort((a, b) => a - b).map((depth, rank) => [depth, rank]));
}

const isOff = (node, numbering, ranks) =>
  node.type === 'heading' ? numbering.headingOff(ranks.get(node.depth)) : node.type === 'math' && numbering.equationOff;

const record = {
  name: 'econsoc-section-numbering-record',
  doc: 'Records the headings and equations the page numbering keys turn off',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    const numbering = pageNumbering(vfile.path);
    if (!numbering) return;
    const ranks = depthRanks(tree);
    walk(tree, (node) => {
      if (!node.identifier) return;
      if (isOff(node, numbering, ranks)) unnumberedTargets.set(node.identifier, node.type === 'heading' ? plainText(node) : null);
      else if (node.type === 'heading' && numbering.headingOn(ranks.get(node.depth))) numberedHeadings.add(node.identifier);
    });
  },
};

const SECTIONS = [undefined, 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph', 'subparagraph'];
const AMSMATH = /^\s*\\begin\{(align|alignat|gather|multline|flalign|eqnarray|equation)\}/;

// `\the<level>` for each numbered level below an unnumbered one, skipping it, as the site
// joins only its numbered levels ("1.1" under an unnumbered level 2), and its restoring
function counterTex(numbered) {
  const set = [];
  const restore = [];
  numbered.forEach((on, depth) => {
    if (!on || numbered[depth - 1] !== false) return;
    const parent = numbered.slice(0, depth).lastIndexOf(true);
    const name = SECTIONS[depth];
    set.push(`\\let\\econsocthe${name}\\the${name}\\renewcommand{\\the${name}}{${parent > 0 ? `\\the${SECTIONS[parent]}.` : ''}\\arabic{${name}}}`);
    restore.push(`\\let\\the${name}\\econsocthe${name}`);
  });
  return [set.join(''), restore.join('')];
}

const unnumber = {
  name: 'econsoc-section-numbering',
  doc: 'Writes the headings and equations the page numbering keys turn off without numbers',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    // A reference keeps the number MyST gave the target in this export, which ignores the keys
    walk(tree, (node) => {
      if (node.type === 'crossReference' && unnumberedTargets.has(node.identifier)) delete node.enumerator;
    });
    const numbering = pageNumbering(vfile.path);
    if (!numbering?.off) return;
    const ranks = depthRanks(tree);
    // depth -> numbered, for the depths myst-to-tex writes as sectioning commands
    const numbered = [];
    for (const [depth, rank] of ranks) if (SECTIONS[depth]) numbered[depth] = !numbering.headingOff(rank);
    const headings = [];
    walk(tree, (node, parent, index) => {
      if (!parent || !isOff(node, numbering, ranks)) return;
      delete node.enumerator;
      if (node.type === 'heading') headings.push([parent, index, node.depth]);
      else if (AMSMATH.test(node.value ?? '')) {
        const env = node.value.match(AMSMATH)[1];
        const starred = node.value.replace(new RegExp(`\\\\(begin|end)\\{${env}\\}`, 'g'), `\\$1{${env}*}`);
        parent.children[index] = rawLatex(node, `\n${starred}\n`);
      } else node.enumerated = false;
    });
    // Last first, so the earlier indices in a parent stay valid
    for (const [parent, index, depth] of headings.reverse()) {
      parent.children.splice(index + 1, 0, texOnly('\\setcounter{secnumdepth}{\\econsocsecnumdepth}'));
      parent.children.splice(index, 0, texOnly(`\\setcounter{secnumdepth}{${depth - 1}}`));
    }
    const [set, restore] = counterTex(numbered);
    tree.children = [
      texOnly(`\\edef\\econsocsecnumdepth{\\the\\value{secnumdepth}}${set}`),
      ...(tree.children ?? []),
      ...(restore ? [texOnly(restore)] : []),
    ];
  },
};

export const sectionNumbering = { repair: 'section-numbering', transforms: [record, unnumber] };
