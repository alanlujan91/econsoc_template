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
// body's. The block renders nowhere (myst-to-tex and the site theme both skip `visibility:
// 'remove'`) and the project stage strips it again, so the page body is unchanged. The page's
// references do change, on the site too: its reference list gains the part-only entries.
//
// The keys come from the page's source on disk. Reading them off the parts' own trees would be
// exact, but MyST runs a page and its parts through one Promise.all with no ordering between
// them, and in practice the page reaches the plugins first, so a page cannot read its parts.
// A plugin has no YAML parser either; the scan below reads only the part values of the
// frontmatter, so an email or a handle elsewhere in it never counts.

import fs from 'node:fs';
import path from 'node:path';

// myst-frontmatter PAGE_KNOWN_PARTS, in its order, which is the order MyST lists them in
const KNOWN_PARTS = [
  'abstract',
  'summary',
  'keypoints',
  'dedication',
  'epigraph',
  'data_availability',
  'acknowledgments',
];
// The FRONTMATTER_ALIASES entries that name a part, or the `parts` mapping itself
const ALIASES = {
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
const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

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

const indentOf = (line) => line.match(/^ */)[0].length;
const isContent = (line) => line.trim() && !line.trim().startsWith('#');

// Split a YAML block mapping at one indentation into [key, value lines] pairs. A value runs to
// the next key at that indentation; a `- item` at that indentation still belongs to it.
function yamlEntries(lines, indent) {
  const keyLine = new RegExp(`^ {${indent}}([A-Za-z_][\\w-]*)\\s*:(?:\\s+(.*))?$`);
  const entries = [];
  for (const line of lines) {
    const key = line.match(keyLine);
    if (key) entries.push([key[1], [key[2] ?? '']]);
    else if (isContent(line) && indentOf(line) < indent) break;
    else if (entries.length) entries.at(-1)[1].push(line);
  }
  return entries;
}

// A part value naming one file (a scalar or a one-item list) gives that file's source
function partSource(valueLines, dir) {
  const items = valueLines.map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  if (items.length === 1) {
    const value = items[0].replace(/^-\s+/, '').replace(/^(['"])(.*)\1$/, '$2');
    const file = path.resolve(dir, value);
    if (PART_FILE.test(value) && fs.existsSync(file)) {
      return fs.readFileSync(file, 'utf8').replace(FRONTMATTER, '');
    }
  }
  return valueLines.join('\n');
}

// Each part's source, in the order MyST validates them: the `parts` mapping, then known parts
export function pageParts(file) {
  const yaml = fs.readFileSync(file, 'utf8').match(FRONTMATTER)?.[1];
  if (!yaml) return [];
  const dir = path.dirname(file);
  const top = new Map(yamlEntries(yaml.split(/\r?\n/), 0).map(([k, v]) => [ALIASES[k] ?? k, v]));
  const parts = new Map();
  const mapping = top.get('parts');
  const indent = mapping?.slice(1).find(isContent);
  if (indent) {
    for (const [name, lines] of yamlEntries(mapping.slice(1), indentOf(indent))) {
      parts.set(ALIASES[name] ?? name, partSource(lines, dir));
    }
  }
  // A known part set both ways is a validation error, and MyST keeps the `parts` one
  for (const name of KNOWN_PARTS) {
    if (top.has(name) && !parts.has(name)) parts.set(name, partSource(top.get(name), dir));
  }
  return [...parts.values()];
}

// normalizeLabel drops straight and curly quotes; built from code points to keep this file ASCII
const QUOTES = new RegExp(`['"${String.fromCharCode(0x2018, 0x2019, 0x201c, 0x201d)}]+`, 'g');

// The node shape the parser gives a citation (myst-parser tokensToMyst, normalizeLabel)
const citeNode = (label) => ({
  type: 'cite',
  kind: 'parenthetical',
  label,
  identifier: label.replace(/[\t\n\r ]+/g, ' ').replace(QUOTES, '').trim().toLowerCase(),
});

const isMarker = (node) => node.type === 'block' && node.data?.[MARKER];

const injectTransform = {
  name: 'part-citations-inject',
  doc: 'Appends the citations of the page frontmatter parts, hidden, so the page bibliography holds them',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    const file = vfile.path;
    // An inline part has the synthetic path `<page>#parts.<name>`; only a page carries parts
    if (!file || file.includes('#') || !/\.md$/i.test(file) || !fs.existsSync(file)) return;
    tree.children = (tree.children ?? []).filter((node) => !isMarker(node));
    const keys = [...new Set(pageParts(file).flatMap(citationKeys))];
    if (!keys.length) return;
    tree.children.push({
      type: 'block',
      visibility: 'remove',
      data: { [MARKER]: true },
      children: keys.map(citeNode),
    });
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

export default {
  name: 'Part citations',
  transforms: [injectTransform, stripTransform],
};
