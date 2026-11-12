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

import { rawLatex, texEscape, walk } from './util.mjs';

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

export default { repair: 'citation-forms', transforms: [formsTransform] };
