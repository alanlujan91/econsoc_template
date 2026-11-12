// Helpers shared by the repairs in this directory: LaTeX text, tree walks, the raw node every
// repair swaps in, the bundled renderer, and the frontmatter a plugin has to read from disk.

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import mystToTex from 'myst-to-tex';
import { unified } from 'unified';
import { VFile } from 'vfile';

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
export const texEscape = (s) => s.replace(/[\\{}#$%&_^~]/g, (c) => TEX_SPECIALS[c]);
export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The text of a node, or null when it holds anything but text (math, an image)
export function plainText(node) {
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

export const hasImage = (node) => node.type === 'image' || (node.children ?? []).some(hasImage);

// mdast toText: the values of every descendant, math source included
export const textOf = (node) => (typeof node.value === 'string' ? node.value : (node.children ?? []).map(textOf).join(''));

// Pre-order walk handing each node its parent and index, so a node can be replaced in place
export function walk(node, visit, parent, index) {
  visit(node, parent, index);
  node.children?.forEach((child, i) => walk(child, visit, node, i));
}

// Every node passing `test`, innermost first, with its ancestors (its parent last), so an outer
// block renders an inner one already swapped. A raw node's children, which only the site
// renders, are not searched.
export function collect(tree, test) {
  const found = [];
  const visit = (node, ancestors) => {
    if (node.type !== 'raw') node.children?.forEach((child) => visit(child, [...ancestors, node]));
    if (test(node)) found.push({ node, parent: ancestors.at(-1), ancestors });
  };
  visit(tree, []);
  return found;
}

export const replaceNode = (parent, node, next) => {
  parent.children[parent.children.indexOf(node)] = next;
};

export const labelOf = (node) => node.label ?? node.identifier;

// myst-common normalizeLabel: the identifier MyST resolves a label by (built from code points,
// to keep this file ASCII)
const QUOTES = new RegExp(`['"${String.fromCharCode(0x2018, 0x2019, 0x201c, 0x201d)}]+`, 'g');
export const identifierOf = (label) => label.replace(/[\t\n\r ]+/g, ' ').replace(QUOTES, '').trim().toLowerCase();

// The format split every repair uses: myst-to-tex writes `tex`, while the site renders the
// children, the original node (or nodes). `tex` must be non-empty, or myst-to-tex renders the
// children too. A function is called each time `tex` is read: myst-to-tex reads it after the
// export has copied the images and rewritten their urls (finalizeMdast, after the project
// stage, on this same tree), so a block rendered then gets the exported image paths. A clone or
// a spread freezes it.
export function rawLatex(node, tex) {
  const raw = { type: 'raw', lang: 'latex', children: Array.isArray(node) ? node : [node] };
  if (typeof tex !== 'function') return { ...raw, tex: tex || ' ' };
  return Object.defineProperty(raw, 'tex', {
    get: () => tex() || ' ',
    set: (value) => Object.defineProperty(raw, 'tex', { value, writable: true, enumerable: true, configurable: true }),
    enumerable: true,
    configurable: true,
  });
}

// Whether a raw node's `tex` is rendered when read, so its children can still change its LaTeX
export const isLazy = (node) => Boolean(Object.getOwnPropertyDescriptor(node, 'tex')?.get);

// LaTeX the site never shows: a raw node with neither children nor `value`
export const texOnly = (tex) => ({ type: 'raw', lang: 'latex', tex });

// A raw node LaTeX writes as `tex` while the site and Typst show the plain `text`: the theme
// draws a childless raw node as a <span> of its `value`, and myst-to-typst writes its `typst`.
// Having no children, it needs no `\iffalse` copy (inline-raws). An empty `tex` is site only.
export const texText = (tex, text) => ({ type: 'raw', lang: 'latex', tex, typst: text, value: text });

// Nodes whose text is not written through myst-to-tex's text escaping, or whose cells
// table-columns rewrites itself, so the text repairs leave them alone
const TEXT_SKIP = new Set(['raw', 'crossReference', 'cite', 'citeGroup', 'inlineCode', 'code', 'math', 'inlineMath', 'table']);

// Calls `split(value, { start, next })` on every text node outside TEXT_SKIP and a link that
// prints its own URL, and swaps the node for the nodes it returns. `start` says whether the
// text opens a word, `next` is the first character after it in the parent.
export function splitTexts(node, split) {
  const children = node.children;
  if (!children || TEXT_SKIP.has(node.type)) return;
  if (node.type === 'link' && children.length === 1 && children[0].value === node.url) return;
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (child.type !== 'text') {
      splitTexts(child, split);
      continue;
    }
    const start = i === 0 || /\s$/.test(textOf(children[i - 1]));
    const next = i + 1 < children.length ? textOf(children[i + 1]).charAt(0) : '';
    const nodes = split(child.value ?? '', { start, next });
    if (nodes) children.splice(i, 1, ...nodes);
  }
}

// The text cut at each `{ index, length, tex }` (in order, not overlapping) into text nodes and
// texText nodes, which show the cut text on the site; null when there is no cut
export function cutText(value, cuts) {
  if (!cuts.length) return null;
  const nodes = [];
  let at = 0;
  for (const { index, length, tex } of cuts) {
    if (index > at) nodes.push({ type: 'text', value: value.slice(at, index) });
    nodes.push(texText(tex, value.slice(index, index + length)));
    at = index + length;
  }
  if (at < value.length) nodes.push({ type: 'text', value: value.slice(at) });
  return nodes;
}

// The characters myst-to-tex writes wrongly in text (text.mjs, text-symbols): the minus sign
// U+2212 and a hyphen opening a number, six arrows written as math commands, three periods.
// Built from code points, to keep this file ASCII.
export const MINUS_SIGN = String.fromCharCode(0x2212);
const ARROWS = Object.fromEntries(
  [
    [0x2190, '\\leftarrow'],
    [0x2192, '\\rightarrow'],
    [0x2194, '\\leftrightarrow'],
    [0x21d0, '\\Leftarrow'],
    [0x21d2, '\\Rightarrow'],
    [0x21d4, '\\Leftrightarrow'],
  ].map(([code, tex]) => [String.fromCharCode(code), tex]),
);
const SYMBOL = new RegExp(`${MINUS_SIGN}|-(?=\\.?\\d)|[${Object.keys(ARROWS).join('')}]|\\.\\.\\.`, 'g');
// What an ASCII hyphen must follow to open a number: a word start
const NUMBER_START = /[\s([{/;:=,]$/;

// The cuts of `value` for each symbol myst-to-tex writes wrongly; `start` says whether the
// value opens a word (an ASCII hyphen there opens a number)
export function texSymbols(value, start = true) {
  const cuts = [];
  for (const m of value.matchAll(SYMBOL)) {
    const s = m[0];
    if (s === '-' && !(m.index === 0 ? start : NUMBER_START.test(value.slice(0, m.index)))) continue;
    const tex = s === '...' ? '\\ldots{}' : ARROWS[s] ? `$${ARROWS[s]}$` : '$-$';
    cuts.push({ index: m.index, length: s.length, tex });
  }
  return cuts;
}

// List counters as LaTeX prints them: lowercase roman, and a letter from 1 = a (wrapping at z)
const ROMAN = [['m', 1000], ['cm', 900], ['d', 500], ['cd', 400], ['c', 100], ['xc', 90], ['l', 50], ['xl', 40]];
ROMAN.push(['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]);
export function roman(n) {
  let out = '';
  for (const [s, v] of ROMAN) for (; n >= v; n -= v) out += s;
  return out;
}
export const alpha = (n) => String.fromCharCode(96 + (((n - 1) % 26) + 1));

// A YAML value that may be one item or a list of them, as a list
export const asList = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

// Files under `dir` whose names pass `test`, skipping what MyST skips (dot files, _build, node_modules)
export function filesUnder(dir, test, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_build' || entry.name === 'node_modules') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(file, test, out);
    else if (test.test(entry.name)) out.push(file);
  }
  return out;
}

// A block both outputs skip (myst-to-tex and the theme drop `visibility: 'remove'`), which MyST
// still resolves and harvests, marked so the repair that added it can find it again
export const hiddenBlock = (marker, children) => ({ type: 'block', visibility: 'remove', data: { [marker]: true }, children });
export const isHiddenBlock = (node, marker) => node.type === 'block' && Boolean(node.data?.[marker]);

// The site has no `raw` renderer: it draws a node holding children as a <div>, which splits the
// paragraph around it, and a childless one as an empty <span>. siteSafe makes each raw node with
// children in phrasing content a span of three: its LaTeX, the original node, which myst-to-tex
// renders natively inside `\iffalse ... \fi{}` (so the export still collects its packages and
// macros; `{}` keeps the space after), and the close. The site renders the node in place.
const PHRASING = new Set([
  'paragraph', 'heading', 'emphasis', 'strong', 'underline', 'delete', 'link', 'span', 'superscript',
  'subscript', 'smallcaps', 'keyboard', 'abbreviation', 'crossReference', 'admonitionTitle',
  'tableCell', 'definitionTerm', 'captionNumber',
]);
export const isInlineRaw = (node, parent) => node.type === 'raw' && node.children?.length > 0 && PHRASING.has(parent?.type);

// span -> the raw node it stands for, so renderTex writes the LaTeX alone
const INLINE = new WeakMap();

// Searches raw nodes' children too, which only the site renders; a lazy `tex` stays lazy
export function siteSafe(node) {
  node.children?.forEach((child, i) => {
    siteSafe(child);
    if (!isInlineRaw(child, node)) return;
    const site = child.children.length === 1 ? child.children[0] : { type: 'span', children: child.children };
    const open = Object.defineProperty({ type: 'raw', lang: 'latex' }, 'tex', {
      get: () => `${child.tex}\\iffalse `,
      enumerable: true,
    });
    const span = { type: 'span', children: [open, site, texOnly('\\fi{}')] };
    INLINE.set(span, child);
    node.children[i] = span;
  });
}

// A proof in a subtree renderTex renders goes to proofs.mjs's writer, which registers here
// (util cannot import it): the bundled proof handler mangles titles and drops four kinds
let proofWriter = () => undefined;
export const setProofWriter = (write) => {
  proofWriter = write;
};

// The tree as the LaTeX export sees it: an inline span is its raw node, a proof its raw LaTeX
function texView(node, footnotes, file) {
  if (INLINE.has(node)) return INLINE.get(node);
  if (node.type === 'proof') {
    const tex = proofWriter(node, footnotes, file);
    if (tex !== undefined) return rawLatex(node, tex);
  }
  if (node.type === 'raw' || !node.children) return node;
  return { ...node, children: node.children.map((child) => texView(child, footnotes, file)) };
}

// LaTeX for nodes rendered on their own by the bundled myst-to-tex. Footnote definitions are
// looked up from the root of the tree being rendered, so the page's own are passed in; their
// handler writes nothing in place. Nodes are cloned, since some handlers delete what they read.
export function renderTex(nodes, footnotes, file) {
  const view = [...nodes, ...footnotes].map((node) => texView(node, footnotes, file));
  const root = { type: 'root', children: structuredClone(view) };
  const sub = new VFile({ path: file.path });
  const pipe = unified().use(mystToTex);
  const out = pipe.stringify(pipe.runSync(root, sub), sub);
  // A lazy node renders at each read, so each message is reported once
  const seen = new Set(file.messages.map(String));
  file.messages.push(...sub.messages.filter((m) => !seen.has(String(m))));
  return out.result.value;
}

// Frontmatter. A plugin is handed no frontmatter object, so the repairs that need it read the
// page and myst.yml from disk, with js-yaml (myst-to-tex's own dependency).
const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const stripFrontmatter = (source) => source.replace(FRONTMATTER, '');

// A file's YAML frontmatter as an object, {} for a part's synthetic path (`<page>#parts.<name>`),
// a missing file, no frontmatter, or YAML MyST would reject itself
export function readFrontmatter(file) {
  try {
    const block = fs.readFileSync(file, 'utf8').match(FRONTMATTER)?.[1];
    return (block && yaml.load(block)) || {};
  } catch {
    return {};
  }
}

// The nearest myst.yml at or above `dir` that has a `project:`, and that project
function projectFile(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    const file = path.join(d, 'myst.yml');
    try {
      const project = fs.existsSync(file) && yaml.load(fs.readFileSync(file, 'utf8'))?.project;
      if (project) return { root: d, project };
    } catch {
      return undefined;
    }
    if (path.dirname(d) === d) return undefined;
  }
}
export const projectConfig = (dir) => projectFile(dir)?.project ?? {};
export const projectRoot = (file) => projectFile(path.dirname(file))?.root ?? path.dirname(file);

// myst-frontmatter PAGE_KNOWN_PARTS, in the order MyST lists them, and the FRONTMATTER_ALIASES
// entries that name a part or the `parts` mapping itself
const KNOWN_PARTS = ['abstract', 'summary', 'keypoints', 'dedication', 'epigraph', 'data_availability', 'acknowledgments'];
const PART_ALIASES = {
  part: 'parts',
  ack: 'acknowledgments',
  acknowledgements: 'acknowledgments',
  acknowledgment: 'acknowledgments',
  acknowledgement: 'acknowledgments',
  availability: 'data_availability',
  dataAvailability: 'data_availability',
  'data-availability': 'data_availability',
  plain_language_summary: 'summary',
  'plain-language-summary': 'summary',
  plainLanguageSummary: 'summary',
  lay_summary: 'summary',
  'lay-summary': 'summary',
};
// myst-cli VALID_FILE_EXTENSIONS: a part given as one value with such an ending is a file
const PART_FILE = /\.(md|ipynb|tex|myst\.json)$/i;

// A part's value: one file name (a scalar or a one-item list) names a file part
function partOf(name, value, dir) {
  const one = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (typeof one === 'string' && PART_FILE.test(one.trim())) {
    const file = path.resolve(dir, one.trim());
    if (fs.existsSync(file)) return { name, file, source: stripFrontmatter(fs.readFileSync(file, 'utf8')) };
  }
  return { name, source: Array.isArray(value) ? value.join('\n') : String(value ?? '') };
}

// Each frontmatter part of a page, {name, source, file?}, in the order MyST validates them: the
// `parts` mapping, then the known parts. A known part set both ways is a validation error, and
// MyST keeps the `parts` one.
export function pageParts(page) {
  const fm = readFrontmatter(page);
  const dir = path.dirname(page);
  const keyOf = (key) => PART_ALIASES[key] ?? key;
  const parts = new Map();
  const mapping = Object.entries(fm).find(([key]) => keyOf(key) === 'parts')?.[1];
  if (mapping && typeof mapping === 'object') {
    for (const [key, value] of Object.entries(mapping)) parts.set(keyOf(key), partOf(keyOf(key), value, dir));
  }
  for (const name of KNOWN_PARTS) {
    const entry = Object.entries(fm).find(([key]) => keyOf(key) === name);
    if (entry && !parts.has(name)) parts.set(name, partOf(name, entry[1], dir));
  }
  return [...parts.values()];
}
