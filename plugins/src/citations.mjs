// The citation repairs: citation-forms (natbib forms and notes), part-citations (the bibliography
// entries of frontmatter parts) and doi-links (DOI links that stay links).

import fs from 'node:fs';
import { hasImage, hiddenBlock, identifierOf, isHiddenBlock, pageParts, rawLatex, texEscape, textOf, walk } from './util.mjs';

// ---------------------------------------------------------------------------------------------
// citation-forms
// Citation forms in LaTeX exports. Released myst-to-tex (1.12.0) writes every citation as
// `\citet{keys}`, `\citep{keys}` or `\cite{key}`, silently, at exit 0, so that
//   1. prefix and suffix notes are dropped: `[e.g. @k, pg. 22]` and {cite:p}`{see}k{fig 1}` print
//      a bare `\citep{k}`, and `@k [pg. 22]` a bare `\cite{k}`;
//   2. year-only and author-only citations ({cite:year}, `[-@k]`, {cite:author}) print in full;
//   3. a lone parenthetical cite outside a group ({cite:alp}) prints `\cite`, which natbib in
//      author-year mode renders textually, "Aumann (1987)", where the site prints "Aumann, 1987".
// Each citation the default gets wrong becomes a raw node (util.rawLatex) printing what the site
// prints, so only the LaTeX changes. Inline repair at project stage, where `main.bib` already holds
// every key, so a key cited only through this raw LaTeX still has its entry.
//
// The site's forms (myst-cli getInlineCitation plus the theme's cite-group CSS): narrative item
// "pre Aumann (1987, post)", parenthetical item "pre Aumann, 1987, post", a parenthetical group
// wrapped in parentheses; a year item keeps the parentheses of its narrative form, "(1987)", and
// an author item is "pre Aumann". A group natbib can write as one command gets that command:
// natbib takes one note pair, the prefix before the first key and the suffix after the last. A
// group with notes elsewhere, or with year or author items, is written item by item, joined with
// the comma econsocart.cfg sets as natbib's separator (the site joins parenthetical items with
// "; "). Notes are written in LaTeX even where the site drops them (a year item's prefix, an
// author item's suffix). {cite}, single or multi-key, is narrative on the site as in LaTeX
// (mystmd docs: "The default citations are narrative"), so it is left as it is.

// An optional argument holding a bracket has to be braced, or LaTeX ends it there
const arg = (note) => (/[[\]]/.test(note) ? `[{${note}}]` : `[${note}]`);
const notes = (pre, post) => (pre ? arg(pre) + arg(post) : post ? arg(post) : '');
// natbib puts a `\citet` prefix inside the parentheses, "Aumann (see 1987)"; the site puts it first
function command(name, cites, pre, post) {
  if (name === 'citet' && pre) return `${pre} ${command(name, cites, '', post)}`;
  return `\\${name}${notes(pre, post)}{${cites.map((c) => c.label).join(', ')}}`;
}
// A command with no note arguments, its notes written around it as text
const around = (name, c, pre, post) =>
  `${pre ? `${pre} ` : ''}\\${name}{${c.label}}${post ? `, ${post}` : ''}`;

const notesOf = (c) => [c.prefix ? texEscape(c.prefix) : '', c.suffix ? texEscape(c.suffix) : ''];

// One citation in a context of the given kind, as the site prints it
function itemTex(c, kind) {
  const [pre, post] = notesOf(c);
  if (c.partial === 'author') return around('citeauthor', c, pre, post);
  if (c.partial === 'year') {
    return kind === 'narrative' ? command('citeyearpar', [c], pre, post) : around('citeyear', c, pre, post);
  }
  return command(kind === 'narrative' ? 'citet' : 'citealp', [c], pre, post);
}

function groupTex(group) {
  const cites = group.children;
  const { kind } = group;
  const n = cites.length;
  const plain = cites.every((c) => !c.partial);
  const oneNotePair = cites.every((c, i) => (!c.prefix || i === 0) && (!c.suffix || i === n - 1));
  if (plain && oneNotePair) {
    return command(kind === 'narrative' ? 'citet' : 'citep', cites, notesOf(cites[0])[0], notesOf(cites[n - 1])[1]);
  }
  if (n === 1 && cites[0].partial === 'year') return command('citeyearpar', cites, ...notesOf(cites[0]));
  const items = cites.map((c) => itemTex(c, kind)).join(', ');
  return kind === 'parenthetical' ? `(${items})` : items;
}

// What myst-to-tex writes for the node (its natbib branch), and what the site prints
function texOf(node, parent) {
  if (node.type === 'citeGroup') {
    if (!node.children?.length || node.children.some((c) => c.type !== 'cite')) return null;
    if (!['narrative', 'parenthetical'].includes(node.kind)) return null;
    const keys = node.children.map((c) => c.label).join(', ');
    return [`\\cite${node.kind === 'narrative' ? 't' : 'p'}{${keys}}`, groupTex(node)];
  }
  if (node.type !== 'cite' || parent?.type === 'citeGroup') return null;
  // natbib's `\cite` in author-year mode is `\citet`, so a plain narrative cite needs nothing
  const plainNarrative = node.kind === 'narrative' && !node.partial && !node.prefix && !node.suffix;
  if (plainNarrative || !['narrative', 'parenthetical'].includes(node.kind)) return null;
  return [`\\cite{${node.label}}`, itemTex(node, node.kind)];
}

// `[@a, prose @b]` (a comma where `;` belongs) parses as ONE cite of b whose prefix holds "@a":
// stock LaTeX dropped the note and with it the citation of a; the note now prints the raw key
const KEY_IN_NOTE = /(?:^|[^\w@])@([A-Za-z][\w:.-]*)/;

const formsTransform = {
  name: 'citation-forms',
  doc: 'Writes citation notes, year-only and author-only forms, and lone parenthetical cites as natbib commands',
  stage: 'project',
  plugin: () => (tree, file) => {
    walk(tree, (node, parent, index) => {
      if (!parent || parent.type === 'raw') return;
      const key = node.type === 'cite' && `${node.prefix ?? ''} ${node.suffix ?? ''}`.match(KEY_IN_NOTE)?.[1];
      if (key) file.message(`econsoc: the note of citation ${node.label} holds "@${key}", printed as a raw key: separate citations with ";" ([@${key}; ... @${node.label}])`);
      const tex = texOf(node, parent);
      if (tex && tex[0] !== tex[1]) parent.children[index] = rawLatex(node, tex[1]);
    });
  },
};

export const citationForms = { repair: 'citation-forms', transforms: [formsTransform] };

// ---------------------------------------------------------------------------------------------
// part-citations
// Carries the citations of a page's frontmatter parts (an abstract, an acknowledgement, any
// `parts:` entry, inline or a file) into that page's exported bibliography. MyST loads each part
// as a file of its own, so its `cite` nodes land in the part's references and never in the
// page's, and a LaTeX export writes main.bib from the page's references alone: the .tex carries
// `\citep{key}` for a part citation, main.bib lacks the entry, and the PDF prints `?` with exit
// status 0. Upstream: jupyter-book/mystmd#3032, fixed in the bib writer by #3033 (unmerged),
// whose semantics this follows: every part in the page's own frontmatter counts, project parts
// do not (a LaTeX export renders them into no page), and part keys follow the body's keys in main.bib.
//
// At document stage the page's tree gets one hidden block, appended, holding a `cite` node per
// part key, so `transformCitations` harvests the keys into the page's references after the
// body's. The block renders nowhere and the project stage strips it again, so the page body is
// unchanged. The page's references do change, on the site too: its reference list gains the
// part-only entries.
//
// The keys come from the page's source on disk. Reading them off the parts' own trees would be
// exact, but MyST runs a page and its parts through one Promise.all with no ordering between
// them, and in practice the page reaches the plugins first, so a page cannot read its parts.
// Only the part values of the frontmatter are scanned, so an email or a handle elsewhere in it
// never counts.

const PART_MARKER = 'partCitations';

// The citation grammar of markdown-it-myst (citations.js) and myst-roles (cite.ts)
const ROLE = /\{cite(?::[a-z]+)?\}`([^`]*)`/g;
const ROLE_ITEM = /^(?:\{[^{]*\})?([^{]*)(?:\{[^{]*\})?$/;
const BRACKET = /\[([^[\]]+)\](?![([])/g;
const BRACKET_ITEM = /^([^^-]|[^^].+?)?(-)?@([\w][\w:.#$%&\-+?~/]*)(.+)?$/;
const IN_TEXT = /@((?:[\w|{][\w:.#$%&\-+?~/]*[\w|}])|\w)/g;

const trimBraces = (label) => label.replace(/^\{(.*)\}$/, '$1');
const blank = (match) => ' '.repeat(match.length);

// markdown-it-myst isUrlContext: an `@` inside a URL or a bare domain path is no citation
function inUrl(before) {
  if (!before || /\s$/.test(before)) return false;
  const word = before.match(/(\S+)$/)[1];
  if (word.startsWith('<') && word.includes('>')) return false;
  return word.includes('://') || word.startsWith('www.') || /^([a-z0-9-]+\.)+[a-z]{2,}(\/|$)/i.test(word);
}

// Citation labels of one part's MyST source, in order of appearance
function citationKeys(text) {
  const found = [];
  for (const m of text.matchAll(ROLE)) {
    for (const item of m[1].split(/[,;]/)) {
      const label = item.trim().match(ROLE_ITEM)?.[1]?.trim();
      if (label) found.push([m.index, label]);
    }
  }
  // Blanked to the same length, so roles and code spans keep every other match's position
  const prose = text.replace(ROLE, blank).replace(/`[^`]*`/g, blank);
  for (const m of prose.matchAll(BRACKET)) {
    const items = m[1].split(';').map((item) => item.match(BRACKET_ITEM));
    if (items.every(Boolean)) items.forEach((item) => found.push([m.index, trimBraces(item[3])]));
  }
  for (const m of prose.matchAll(IN_TEXT)) {
    const before = prose.slice(0, m.index);
    // The parser's allowedBefore: the start of the text or a character that is not alphanumeric
    if (/[a-zA-Z0-9]$/.test(before) || inUrl(before)) continue;
    found.push([m.index, trimBraces(m[1])]);
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, label]) => label);
}

// The node shape the parser gives a citation (myst-parser tokensToMyst)
const citeNode = (label) => ({ type: 'cite', kind: 'parenthetical', label, identifier: identifierOf(label) });

const isPartMarker = (node) => isHiddenBlock(node, PART_MARKER);

const injectTransform = {
  name: 'part-citations-inject',
  doc: 'Appends the citations of the page frontmatter parts, hidden, so the page bibliography holds them',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    const file = vfile.path;
    // An inline part has the synthetic path `<page>#parts.<name>`; only a page carries parts
    if (!file || file.includes('#') || !/\.md$/i.test(file) || !fs.existsSync(file)) return;
    tree.children = (tree.children ?? []).filter((node) => !isPartMarker(node));
    const keys = [...new Set(pageParts(file).flatMap((part) => citationKeys(part.source)))];
    if (keys.length) tree.children.push(hiddenBlock(PART_MARKER, keys.map(citeNode)));
  },
};

const stripTransform = {
  name: 'part-citations-strip',
  doc: 'Removes the hidden citation block once its citations are in the page references',
  stage: 'project',
  plugin: () => (tree) => {
    if (tree.children) tree.children = tree.children.filter((node) => !isPartMarker(node));
  },
};

export const partCitations = { repair: 'part-citations', transforms: [injectTransform, stripTransform] };

// ---------------------------------------------------------------------------------------------
// doi-links
// DOI links that carry their own text or an image. Released mystmd (1.12.0) turns every link to a
// DOI into a citation before any project-stage plugin runs (myst-cli transformLinkedDOIs), silently,
// at exit 0. A link whose text is the DOI itself (`[](doi:...)`, `<https://doi.org/...>`) is meant
// as a citation, but a badge `[![DOI](badge.svg)](https://doi.org/10.5281/zenodo.X)` or a worded
// link `[the data](https://doi.org/...)` becomes `\cite{...}` in LaTeX: the badge or the words
// vanish, a citation of the fetched record prints instead, and a References entry appears for it.
// The site shows the badge or the words as a citation and lists the same bogus reference.
//
// At document stage, before transformLinkedDOIs, such a link's DOI moves into `data` and its URL
// becomes an inert placeholder that no link transformer claims; the project stage puts the doi.org
// URL back. The link stays a link in LaTeX (`\href`) and on the site, which loses the bogus
// reference too: a deliberate site change. Inline repair; the restore must run before any block
// repair renders a subtree, or that subtree keeps the placeholder.
//
// Not repaired here, measured on 1.12.0: a DOI that matches an entry of a loaded bibliography
// (project `bibliography:`, page `bibliography:`, or a .bib MyST finds in the project) already
// cites that entry's key, with the authored entry in main.bib and no doi.org fetch, which is the
// fix jupyter-book/mystmd#711 asks for. A DOI in no .bib still resolves through doi.org.

const DOI_MARKER = 'econsocDoiLink';
const PLACEHOLDER = 'https://econsoc.invalid/doi-link';
// myst-transforms isRecognizedDoi for a doi.org URL, a `doi:` link or a bare DOI
const DOI = /^(?:doi:|https?:\/\/(?:dx\.|www\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i;

const doiOf = (url) => (url ?? '').trim().match(DOI)?.[1];

// True for a link MyST would cite although its text says something of its own
function isWordedDoiLink(node) {
  if (node.type !== 'link' || !doiOf(node.url)) return false;
  if ((node.children ?? []).some(hasImage)) return true;
  const text = textOf(node).trim();
  return Boolean(text) && !doiOf(text);
}

const hideTransform = {
  name: 'doi-links-hide',
  doc: 'Keeps a DOI link with its own text or image a link, out of reach of the DOI citation transform',
  stage: 'document',
  plugin: () => (tree) => {
    walk(tree, (node) => {
      if (!isWordedDoiLink(node)) return;
      node.data = { ...node.data, [DOI_MARKER]: node.url };
      node.url = PLACEHOLDER;
    });
  },
};

const restoreTransform = {
  name: 'doi-links-restore',
  doc: 'Gives a DOI link kept as a link its doi.org URL back',
  stage: 'project',
  plugin: () => (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'link' || !node.data?.[DOI_MARKER]) return;
      // What myst-transforms DOITransformer makes of a DOI link it is allowed to see
      const source = node.data[DOI_MARKER];
      const id = doiOf(source);
      delete node.data[DOI_MARKER];
      Object.assign(node, { url: `https://doi.org/${id}`, urlSource: source, internal: false });
      node.data.doi = id;
    });
  },
};

export const doiLinks = { repair: 'doi-links', transforms: [hideTransform, restoreTransform] };
