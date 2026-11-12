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
// Each fix steers the crossReference or replaces it with a raw node (refs.refNode), so only the
// LaTeX changes.

import { labelOf, pageParts, plainText, texEscape, walk } from './util.mjs';
import { fill, isProjectRef, refNode, splitAt } from './refs.mjs';

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
  if (node.kind === 'heading' && (page.numbered || page.appendix.has(label))) return `${word}~${ref}`;
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

export default { repair: 'xref', transforms: [xrefSource, crossReferences] };
