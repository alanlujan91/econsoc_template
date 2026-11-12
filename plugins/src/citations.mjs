// The citation repairs: citation-forms (natbib forms and notes), part-citations (the bibliography
// entries of frontmatter parts), doi-links (DOI links that stay links) and authored-bib (the
// paper's own .bib entries in place of main.bib).

import fs from 'node:fs';
import path from 'node:path';
import {
  asList,
  collect,
  filesUnder,
  hasImage,
  hiddenBlock,
  identifierOf,
  isHiddenBlock,
  isLazy,
  pageParts,
  projectConfig,
  projectRoot,
  rawLatex,
  readFrontmatter,
  texEscape,
  textOf,
  walk,
} from './util.mjs';

// ---------------------------------------------------------------------------------------------
// citation-forms
// Citation forms in LaTeX exports. Released myst-to-tex (1.12.0) writes every citation as
// `\citet{keys}`, `\citep{keys}` or `\cite{key}`, silently, at exit 0, so that
//   1. prefix and suffix notes are dropped: `[e.g. @k, pg. 22]` and {cite:p}`{see}k{fig 1}` print
//      a bare `\citep{k}`, and `@k [pg. 22]` a bare `\cite{k}`;
//   2. year-only and author-only citations ({cite:year}, `[-@k]`, {cite:author}) print in full;
//   3. a lone parenthetical cite outside a group ({cite:alp}) prints `\cite`, which natbib in
//      author-year mode renders textually, "Aumann (1987)", where the site prints "Aumann, 1987";
//   4. the star and capital of {cite:ps}, {cite:ts}, {cite:ct}, {cite:cts}, {cite:alps},
//      {cite:authors}, {cite:authorpars}, {cite:cauthor} and {cite:cauthors} are lost (myst-roles
//      cite.js keeps no field for them), and a multi-key {cite:alp} runs its cites together.
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
// (mystmd docs: "The default citations are narrative"), so it is left as it is. Item 4 gets
// natbib's `\citep*`, `\Citet`, `\Citeauthor*`, ...: the site prints neither star nor capital, so
// a starred citation lists every author in LaTeX alone, and the cites of one {cite:alp} are
// joined with ", " where the site runs them together.

// An optional argument holding a bracket has to be braced, or LaTeX ends it there
const arg = (note) => (/[[\]]/.test(note) ? `[{${note}}]` : `[${note}]`);
const notes = (pre, post) => (pre ? arg(pre) + arg(post) : post ? arg(post) : '');
// natbib's starred (full author list) and capitalized forms; the year commands have neither
const form = (name, role) =>
  !role || name.startsWith('citeyear') ? name : `${role.cap ? `C${name.slice(1)}` : name}${role.star ? '*' : ''}`;
// natbib puts a `\citet` prefix inside the parentheses, "Aumann (see 1987)"; the site puts it first
function command(name, cites, pre, post, role) {
  if (name === 'citet' && pre) return `${pre} ${command(name, cites, '', post, role)}`;
  return `\\${form(name, role)}${notes(pre, post)}{${cites.map((c) => c.label).join(', ')}}`;
}
// A command with no note arguments, its notes written around it as text
const around = (name, c, pre, post, role) =>
  `${pre ? `${pre} ` : ''}\\${form(name, role)}{${c.label}}${post ? `, ${post}` : ''}`;

const notesOf = (c) => [c.prefix ? texEscape(c.prefix) : '', c.suffix ? texEscape(c.suffix) : ''];

// One citation in a context of the given kind, as the site prints it
function itemTex(c, kind, role) {
  const [pre, post] = notesOf(c);
  if (c.partial === 'author') return around('citeauthor', c, pre, post, role);
  if (c.partial === 'year') {
    return kind === 'narrative' ? command('citeyearpar', [c], pre, post) : around('citeyear', c, pre, post);
  }
  return command(kind === 'narrative' ? 'citet' : 'citealp', [c], pre, post, role);
}

function groupTex(group, role) {
  const cites = group.children;
  const { kind } = group;
  const n = cites.length;
  const plain = cites.every((c) => !c.partial);
  const oneNotePair = cites.every((c, i) => (!c.prefix || i === 0) && (!c.suffix || i === n - 1));
  if (plain && oneNotePair) {
    const name = kind === 'narrative' ? 'citet' : 'citep';
    return command(name, cites, notesOf(cites[0])[0], notesOf(cites[n - 1])[1], role);
  }
  if (n === 1 && cites[0].partial === 'year') return command('citeyearpar', cites, ...notesOf(cites[0]));
  const items = cites.map((c) => itemTex(c, kind, role)).join(', ');
  return kind === 'parenthetical' ? `(${items})` : items;
}

// What myst-to-tex writes for the node (its natbib branch), and what the site prints
function texOf(node, parent, role) {
  if (node.type === 'citeGroup') {
    if (!node.children?.length || node.children.some((c) => c.type !== 'cite')) return null;
    if (!['narrative', 'parenthetical'].includes(node.kind)) return null;
    const keys = node.children.map((c) => c.label).join(', ');
    return [`\\cite${node.kind === 'narrative' ? 't' : 'p'}{${keys}}`, groupTex(node, role)];
  }
  if (node.type !== 'cite' || parent?.type === 'citeGroup') return null;
  // natbib's `\cite` in author-year mode is `\citet`, so a plain narrative cite needs nothing
  const plainNarrative = node.kind === 'narrative' && !node.partial && !node.prefix && !node.suffix && !role;
  if (plainNarrative || !['narrative', 'parenthetical'].includes(node.kind)) return null;
  const tex = itemTex(node, node.kind, role);
  return [`\\cite{${node.label}}`, role?.joined ? `${tex}, ` : tex];
}

// The roles of item 4 leave nodes with no position, so the roles are read from the source lines
// of the nearest positioned ancestor and matched to the nodes in order, key by key; a mismatch
// (an include, a role in code) leaves those lines' citations alone.

// The nodes role number `at` writes: a cite per key for {cite:alp} and {cite:alps}, one node
// (a cite or a citeGroup) otherwise
function roleNodes(name, body, at) {
  const labels = body.split(/[,;]/).map((item) => identifierOf(item.trim().match(ROLE_ITEM)?.[1]?.trim() ?? ''));
  if (name.includes('cite:alp')) return labels.map((label) => ({ name, at, labels: [label] }));
  return [{ name, at, labels }];
}

// The source a tree's positions count lines of: the file, or an inline part's value
function sourceOf(path) {
  const [file, part] = path.split('#parts.');
  if (part) return pageParts(file).find((p) => p.name === part)?.source;
  return /\.md$/i.test(file) && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
}

const roleOf = (name) => {
  const sub = name.slice('cite:'.length);
  const star = /s$/.test(sub);
  const cap = /^c(?:t|ts|author|authors)$/.test(sub);
  return star || cap ? { star, cap } : undefined;
};

// citation node -> {star, cap, joined}, for each node a starred or capitalized role made, and
// each {cite:alp} cite followed by another of the same role
function citationRoles(tree, path) {
  const roles = new Map();
  const lines = path && sourceOf(path)?.split(/\r?\n/);
  if (!lines) return roles;
  // Positions hold lines alone (every column is 1), and some are wrong (a table's second cell
  // says line 1), so a node goes with the line range of its nearest ancestor holding a role;
  // narrower ranges match first, and an emphasis's roles are then gone from its paragraph's
  const found = lines.map((line, i) => [...line.matchAll(ROLE)].map((m, k) => ({ id: `${i}:${k}`, m })));
  const used = new Set();
  const rolesIn = ([a, b]) => found.slice(a - 1, b).flat().filter((r) => !used.has(r.id));
  const made = collect(tree, (n) => (n.type === 'citeGroup' || n.type === 'cite') && !n.position);
  const byLines = new Map();
  for (const { node, parent, ancestors } of made) {
    if (parent?.type === 'citeGroup') continue;
    const range = ancestors
      .map((a) => a.position?.start && a.position?.end && [a.position.start.line, a.position.end.line])
      .findLast((r) => r && rolesIn(r).length);
    if (!range) continue;
    const key = range.join('-');
    if (!byLines.has(key)) byLines.set(key, { range, nodes: [] });
    byLines.get(key).nodes.push(node);
  }
  const groups = [...byLines.values()].sort((x, y) => x.range[1] - x.range[0] - (y.range[1] - y.range[0]));
  for (const { range, nodes } of groups) {
    const within = rolesIn(range);
    const expected = within.flatMap(({ id, m }) => roleNodes(`cite${m[1] ?? ''}`, m[2], id));
    const labelsOf = (n) => (n.type === 'cite' ? [n] : n.children).map((c) => identifierOf(c.label ?? ''));
    const matches = expected.length === nodes.length && nodes.every((n, i) => labelsOf(n).join() === expected[i].labels.join());
    if (!matches) continue;
    within.forEach((r) => used.add(r.id));
    nodes.forEach((node, i) => {
      const role = roleOf(expected[i].name);
      const joined = expected[i].name.includes('cite:alp') && expected[i + 1]?.at === expected[i].at;
      if (role || joined) roles.set(node, { ...role, joined });
    });
  }
  return roles;
}

// `[@a, prose @b]` (a comma where `;` belongs) parses as ONE cite of b whose prefix holds "@a":
// stock LaTeX dropped the note and with it the citation of a; the note now prints the raw key
const KEY_IN_NOTE = /(?:^|[^\w@])@([A-Za-z][\w:.-]*)/;

const formsTransform = {
  name: 'citation-forms',
  doc: 'Writes citation notes, year-only and author-only forms, and lone parenthetical cites as natbib commands',
  stage: 'project',
  plugin: () => (tree, file) => {
    const roles = citationRoles(tree, file.path);
    walk(tree, (node, parent, index) => {
      if (!parent || parent.type === 'raw') return;
      const key = node.type === 'cite' && `${node.prefix ?? ''} ${node.suffix ?? ''}`.match(KEY_IN_NOTE)?.[1];
      if (key) file.message(`econsoc: the note of citation ${node.label} holds "@${key}", printed as a raw key: separate citations with ";" ([@${key}; ... @${node.label}])`);
      const tex = texOf(node, parent, roles.get(node));
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
const ROLE = /\{cite(:[a-z]+)?\}`([^`]*)`/g;
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
    for (const item of m[2].split(/[,;]/)) {
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

// ---------------------------------------------------------------------------------------------
// authored-bib
// The paper's own .bib entries in place of main.bib. Released mystmd (1.12.0) writes main.bib
// from the citation-js CSL of each entry (myst-cli writeBibtexFromCitationRenderers), silently,
// at exit 0, so that
//   1. every capitalized title word after the first comes back braced, `Theory of {Value}`, and
//      the sentence-casing .bst (qe, te, econsoc) print reference titles in Title Case;
//   2. `@incollection` comes back `@inbook`, which the .bst print as a monograph, without the
//      book title and editors;
//   3. a key cited only in raw LaTeX gets no entry, and prints `?`;
//   4. accent macros break (`Rodr\'{\i}guez` prints "Rodri guez", `{\AA}str{\"o}m` "\AAstrom"),
//      and `eprint` and the other fields the CSL round trip drops are lost.
// No plugin can edit main.bib, but it can read the authored files, which MyST loads as the
// project's `bibliography:` list or, without one, every .bib under the project (myst-cli
// getAllBibTexFilesOnPath). At project stage the page's cited keys (its cite nodes, its frontmatter
// parts, and the `\cite` commands of its raw LaTeX) select their entries verbatim, with every
// `@string` and `@preamble` and the `crossref` parents they need. A tex-only raw node at the start
// of the page writes them to `\jobname-econsoc.bib` with `filecontents*`, which the LaTeX kernel
// accepts after `\begin{document}`, and defines `\econsocbibliography`, which template.tex hands
// `\bibliography` in place of main.bib. The .tex carries its entries, so a journal gets one file.
//
// A key MyST cites that no authored file holds (a DOI fetched from doi.org) exists only in
// main.bib, and BibTeX fails on an entry repeated across two files ("Repeated entry"), so then
// the page keeps main.bib whole, with a warning naming the keys. So does a page that shares an
// export with others (`articles:` of two or more), whose entries one file cannot gather, and a
// frontmatter part, whose page writes its keys. The site is unchanged: the node holds no children.

const BIB_MARKER = 'econsocBib';
const BIB_FILE = '\\jobname-econsoc';

// The citation commands of raw LaTeX, as scripts/lib-econsoc.sh cited_keys reads them
const TEX_CITE = /\\cite[a-zA-Z]*\*?(?:\[(?:\{[^{}]*\}|[^\]{])*\])*\{([^}]*)\}/g;
const texCiteKeys = (tex) => [...tex.matchAll(TEX_CITE)].flatMap((m) => m[1].split(',').map((k) => k.trim()).filter(Boolean));


// The .bib files MyST loads for the project, in its order: a later file's entry wins a key
function bibFiles(root) {
  const listed = asList(projectConfig(root).bibliography).filter((b) => typeof b === 'string');
  if (!listed.length) return filesUnder(root, /\.bib$/);
  return listed.filter((b) => !/^https?:\/\//.test(b)).map((b) => path.resolve(root, b)).filter((f) => fs.existsSync(f));
}

// The commands of a .bib as BibTeX reads them, each `@type{...}` or `@type(...)` verbatim: text
// outside a command is a comment, and `@comment` is skipped
function bibCommands(text) {
  const found = [];
  const start = /@\s*([A-Za-z]+)\s*([{(])/g;
  for (let m = start.exec(text); m; m = start.exec(text)) {
    let depth = 0;
    let i = start.lastIndex;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === '{') depth++;
      else if (c === '}' && depth > 0) depth--;
      else if ((c === '}' && m[2] === '{') || (c === ')' && m[2] === '(' && depth === 0)) break;
    }
    const type = m[1].toLowerCase();
    const body = text.slice(start.lastIndex, i);
    if (type !== 'comment') found.push({ type, text: text.slice(m.index, i + 1), key: body.split(',')[0].trim() });
    start.lastIndex = i + 1;
  }
  return found;
}

const CROSSREF = /(?:^|[,\s])crossref\s*=\s*[{"]\s*([^}"]+?)\s*[}"]/i;

// Every authored command: the `@string` and `@preamble` definitions, and the entries by key
function readBibs(root) {
  const defs = [];
  const entries = new Map();
  for (const file of bibFiles(root)) {
    for (const command of bibCommands(fs.readFileSync(file, 'utf8'))) {
      if (command.type === 'string' || command.type === 'preamble') defs.push(command.text);
      else entries.set(command.key.toLowerCase(), command);
    }
  }
  return { defs, entries };
}

// Whether `file` is another page's frontmatter part (`abstract: abstract.md`)
const isPartFile = (file, root) =>
  filesUnder(root, /\.md$/i).some((page) => page !== file && pageParts(page).some((part) => part.file === file));

// Whether an export holds `file` with other articles
function sharesExport(file, root) {
  const fm = readFrontmatter(file);
  const entries = [
    ...asList(projectConfig(root).exports).map((entry) => [entry, root]),
    ...asList(fm.exports ?? fm.export).map((entry) => [entry, path.dirname(file)]),
  ];
  return entries.some(([entry, dir]) => {
    const articles = [...asList(entry?.articles), ...asList(entry?.article)].map((a) => a?.file ?? a).filter((a) => typeof a === 'string');
    return articles.length > 1 && articles.some((a) => path.resolve(dir, a) === file);
  });
}

// The keys a page cites: through MyST (its cite nodes and its parts), and in raw LaTeX alone
function pageKeys(tree, file) {
  const parsed = new Set();
  const raw = new Set();
  walk(tree, (node) => {
    if (node.type === 'cite' && node.label) parsed.add(node.label);
    // A lazy node renders its children, whose cite and raw nodes this walk reaches
    if (node.type !== 'raw' || isLazy(node)) return;
    for (const tex of [node.tex, node.value]) if (typeof tex === 'string') texCiteKeys(tex).forEach((k) => raw.add(k));
  });
  for (const part of pageParts(file)) {
    citationKeys(part.source).forEach((k) => parsed.add(k));
    texCiteKeys(part.source).forEach((k) => raw.add(k));
  }
  return { parsed: [...parsed], raw: [...raw].filter((k) => !parsed.has(k)) };
}

// The entries of `keys`, then the crossref parents BibTeX wants after their children
function selectEntries(keys, entries) {
  const chosen = new Map();
  const queue = [...keys];
  while (queue.length) {
    const entry = entries.get(queue.shift().toLowerCase());
    if (!entry || chosen.has(entry.key.toLowerCase())) continue;
    chosen.set(entry.key.toLowerCase(), entry);
    const parent = entry.text.match(CROSSREF)?.[1];
    if (parent) queue.push(parent);
  }
  return [...chosen.values()].map((entry) => entry.text);
}

const bibTransform = {
  name: 'authored-bib',
  doc: 'Writes the authored .bib entries of the cited keys into the LaTeX, for BibTeX to read in place of main.bib',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const file = vfile.path;
    if (!tree.children || !file || file.includes('#') || !fs.existsSync(file)) return;
    tree.children = tree.children.filter((node) => !node.data?.[BIB_MARKER]);
    const root = projectRoot(file);
    const { parsed, raw } = pageKeys(tree, file);
    if (!parsed.length && !raw.length) return;
    if (isPartFile(file, root)) return;
    const { defs, entries } = readBibs(root);
    const unknown = (keys) => keys.filter((k) => !entries.has(k.toLowerCase()));
    const why = sharesExport(file, root)
      ? 'the page shares an export with other articles'
      : unknown(parsed).length && `no authored .bib holds ${unknown(parsed).join(', ')}`;
    if (why) {
      vfile.message(`econsoc: references keep main.bib, which sets titles in Title Case and @incollection as @inbook: ${why}`);
      return;
    }
    if (unknown(raw).length) vfile.message(`econsoc: no authored .bib holds ${unknown(raw).join(', ')}, cited in raw LaTeX`);
    const bib = [...defs, ...selectEntries([...parsed, ...raw], entries)];
    const tex = [`\\begin{filecontents*}[overwrite]{${BIB_FILE}.bib}`, ...bib, '\\end{filecontents*}', `\\gdef\\econsocbibliography{${BIB_FILE}}`, ''];
    // Not enumerable, so the site JSON leaves the entries out while myst-to-tex still reads them
    const node = { type: 'raw', lang: 'latex', data: { [BIB_MARKER]: true } };
    tree.children.unshift(Object.defineProperty(node, 'tex', { value: tex.join('\n'), writable: true, configurable: true }));
  },
};

export const authoredBib = { repair: 'authored-bib', transforms: [bibTransform] };
