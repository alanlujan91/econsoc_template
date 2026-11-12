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

import fs from 'node:fs';
import { hiddenBlock, identifierOf, isHiddenBlock, pageParts } from './util.mjs';

const MARKER = 'partCitations';

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
export function citationKeys(text) {
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

const isMarker = (node) => isHiddenBlock(node, MARKER);

const injectTransform = {
  name: 'part-citations-inject',
  doc: 'Appends the citations of the page frontmatter parts, hidden, so the page bibliography holds them',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    const file = vfile.path;
    // An inline part has the synthetic path `<page>#parts.<name>`; only a page carries parts
    if (!file || file.includes('#') || !/\.md$/i.test(file) || !fs.existsSync(file)) return;
    tree.children = (tree.children ?? []).filter((node) => !isMarker(node));
    const keys = [...new Set(pageParts(file).flatMap((part) => citationKeys(part.source)))];
    if (keys.length) tree.children.push(hiddenBlock(MARKER, keys.map(citeNode)));
  },
};

const stripTransform = {
  name: 'part-citations-strip',
  doc: 'Removes the hidden citation block once its citations are in the page references',
  stage: 'project',
  plugin: () => (tree) => {
    if (tree.children) tree.children = tree.children.filter((node) => !isMarker(node));
  },
};

export default { repair: 'part-citations', transforms: [injectTransform, stripTransform] };
