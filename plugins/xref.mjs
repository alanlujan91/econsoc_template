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
//      `\begin{appendix}` raw block, so a sibling document also gets its number wrong.
// Each fix replaces the crossReference with a raw node: myst-to-tex writes its `tex`, while the site
// and Typst render its children, the original node, so only the LaTeX export changes.

const APPENDIX_OPEN = /\\begin\s*\{appendix\}|\\appendix(?![A-Za-z])/;
const APPENDIX_CLOSE = /\\end\s*\{appendix\}/;

// Appendix label -> the number LaTeX prints for it ("A", "B.1"), per file, filled at document stage
// for every page of the project and read at project stage by the page being exported
const appendixByFile = new Map();

const TEX_SPECIALS = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '#': '\\#',
  $: '\\$',
  '%': '\\%',
  '&': '\\&',
  _: '\\_',
  '^': '\\^{}',
  '~': '\\textasciitilde{}',
};
const texEscape = (s) => s.replace(/[\\{}#$%&_^~]/g, (c) => TEX_SPECIALS[c]);

// The text of a node, or null when it holds anything but text (math, an image), which this cannot
// write as LaTeX
function plainText(node) {
  if (node.type === 'text') return node.value ?? '';
  if (!node.children) return null;
  let out = '';
  for (const child of node.children) {
    const text = plainText(child);
    if (text == null) return null;
    out += text;
  }
  return out;
}

// Pre-order walk handing each node its parent and index, so a node can be replaced in place
function walk(node, visit, parent, index) {
  visit(node, parent, index);
  node.children?.forEach((child, i) => walk(child, visit, node, i));
}

const labelOf = (node) => node.label ?? node.identifier;

// Split `text` around the last occurrence of `slot`; null when it does not occur
function splitAt(text, slot) {
  const i = slot ? text.lastIndexOf(slot) : -1;
  return i < 0 ? null : [text.slice(0, i), text.slice(i + slot.length)];
}

// LaTeX for text with `middle` in the slot, tying the preceding word to it as myst-to-tex does
const fill = ([before, after], middle) =>
  texEscape(before).replace(/\s+$/, '~') + middle + texEscape(after);

const alph = (n) => String.fromCharCode(64 + n);

const appendixNumbers = {
  name: 'econsoc-xref-source',
  doc: 'Records what the author wrote in each link, and the number LaTeX prints for each appendix heading',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    // Before resolution fills an empty link with its target's name, so a link worded as its
    // section's title can be told from a bare one
    walk(tree, (node) => {
      if (node.type === 'link' || node.type === 'crossReference') node.authoredText = plainText(node);
    });
    const numbers = new Map();
    const depths = [];
    walk(tree, (node) => {
      if (node.type === 'heading') depths.push(node.depth);
    });
    const top = Math.min(...depths);
    const counts = [];
    let inside = false;
    walk(tree, (node) => {
      if (node.type === 'raw') {
        const source = node.tex ?? node.value ?? '';
        if (APPENDIX_OPEN.test(source)) inside = true;
        if (APPENDIX_CLOSE.test(source)) inside = false;
        return;
      }
      if (!inside || node.type !== 'heading') return;
      const level = node.depth - top;
      counts.length = level + 1;
      counts[level] = (counts[level] ?? 0) + 1;
      const parts = Array.from(counts, (c) => c ?? 1);
      const label = labelOf(node);
      if (label) numbers.set(label, [alph(parts[0]), ...parts.slice(1)].join('.'));
    });
    appendixByFile.set(vfile.path, numbers);
  },
};

// LaTeX for a reference into another document: its number as plain text
function remoteTex(node, text) {
  const appendix = [...appendixByFile.values()].find((m) => m.has(labelOf(node)))?.get(labelOf(node));
  const number = appendix ?? node.enumerator;
  const slot = splitAt(text, node.enumerator);
  if (!slot) return texEscape(text);
  const isDefault = text === node.template?.replaceAll('%s', node.enumerator);
  if (appendix && isDefault && node.kind === 'heading') return `Appendix~${texEscape(appendix)}`;
  return fill(slot, texEscape(number));
}

// LaTeX for a reference within the document, or undefined when myst-to-tex already writes it right
function localTex(node, text, page) {
  const label = labelOf(node);
  const ref = `\\ref{${label}}`;
  const word = page.appendix.has(label) ? 'Appendix' : 'Section';
  const number = node.enumerator;
  if (number != null && node.template?.includes('%s')) {
    if (text === node.template.replaceAll('%s', number)) {
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
    const page = { appendix: appendixByFile.get(vfile.path) ?? new Map(), titles: new Map(), numbered: false };
    walk(tree, (node) => {
      if (node.type !== 'heading') return;
      if (node.enumerator != null) page.numbered = true;
      const label = labelOf(node);
      const title = plainText(node);
      if (label && title != null) page.titles.set(label, title);
    });
    walk(tree, (node, parent, index) => {
      if (node.type !== 'crossReference' || !parent || node.kind === 'definitionTerm') return;
      if (node.remoteBaseUrl || /^[a-z]+:/i.test(node.url ?? '')) return; // another project or site
      const text = plainText(node);
      const remote = node.remote === true;
      if (text == null) {
        if (remote) vfile.message(`econsoc-xref: cannot write "${labelOf(node)}" as plain text; its link holds math or markup`, node);
        return;
      }
      const tex = remote ? remoteTex(node, text) : localTex(node, text, page);
      if (tex === undefined) return;
      parent.children[index] = { type: 'raw', lang: 'latex', tex, children: [node] };
    });
  },
};

export default {
  name: 'Econsoc cross-references',
  transforms: [appendixNumbers, crossReferences],
};
