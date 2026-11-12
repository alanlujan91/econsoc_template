// The running-text repairs: math-labels, text-symbols, abbreviation-spaces, footnotes, quotes,
// quotations, smallcaps, text-roles, linked-images, enumerate-labels, list-start and inline-raws.

import fs from 'node:fs';
import {
  alpha,
  collect,
  cutText,
  hasImage,
  isLazy,
  rawLatex,
  renderTex,
  replaceNode,
  roman,
  siteSafe,
  sourceFile,
  splitTexts,
  texEscape,
  texOnly,
  texSymbols,
  texText,
  textOf,
  walk,
} from './util.mjs';

// ---------------------------------------------------------------------------------------------
// math-labels
// A labelled display holding a top-level amsmath environment (`align`, `gather`, `multline`,
// `alignat`, `flalign`, `equation`, `eqnarray`) loses its `\label`: myst-to-tex writes such a
// value verbatim and adds the label only around plain math (math.js, "labels may be stripped
// previously"), so `[](#eq)` prints `(??)`. MyST also lifts the first per-line `\label{}` out of
// the value to label the node, and deletes the rest ("Math node is already labeled"), so a link
// to a second row's label prints nothing (or `??x` under missing-refs).
//
// The environment is re-read from the page source through `node.position`, labels and all, and
// used when it matches the value with its labels taken out; the node's own label goes before
// `\end{...}`, on the last row, as hand-written LaTeX puts it. The node becomes a block raw
// node (the site keeps the math). An inline-stage repair that runs before missing-refs, which
// then resolves a link to a row's label as `(\ref{x})`.

const AMS = /^\\begin\{(equation|multline|gather|align|alignat|flalign|eqnarray)\}/;
const LABEL = /\\label\{([^}]+)\}/g;
const squash = (s) => s.replace(/\s+/g, '');

// The lines of `file` from `position`, or '' for a part's synthetic path or a missing file
function sourceLines(file, position, cache) {
  if (!position?.start || !position?.end) return '';
  if (!cache.has(file)) {
    let lines = [];
    try {
      lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    } catch {
      // a frontmatter part's `<page>#parts.<name>` names no file
    }
    cache.set(file, lines);
  }
  return cache.get(file).slice(position.start.line - 1, position.end.line).join('\n');
}

// The environment with every label it had in the source and the node's own, or undefined when
// there is no label to restore
function labelledEnvironment(node, source) {
  const value = (node.value ?? '').trim();
  const env = value.match(AMS)?.[1];
  const end = `\\end{${env}}`;
  if (!env || !value.endsWith(end)) return undefined;
  const block = new RegExp(`\\\\begin\\{${env}\\}[\\s\\S]*?\\\\end\\{${env}\\}`, 'g');
  const found = [...source.matchAll(block)].find((m) => squash(m[0].replace(LABEL, '')) === squash(value));
  let tex = found ? found[0] : value;
  if (node.label && !tex.includes(`\\label{${node.label}}`)) {
    tex = `${tex.slice(0, -end.length).trimEnd()} \\label{${node.label}}\n${end}`;
  }
  return tex === value ? undefined : tex;
}

const mathLabelsTransform = {
  name: 'math-labels',
  doc: 'Restores the labels of an amsmath environment in a display',
  stage: 'project',
  plugin: () => (tree, file) => {
    const cache = new Map();
    collect(tree, (node) => node.type === 'math' && node.enumerated !== false).forEach(({ node, parent, ancestors }) => {
      if (!parent || ancestors.some((a) => a.type === 'table')) return;
      const tex = labelledEnvironment(node, sourceLines(file.path, node.position, cache));
      if (tex) replaceNode(parent, node, rawLatex(node, `\n${tex}\n\n`));
    });
  },
};

export const mathLabels = { repair: 'math-labels', transforms: [mathLabelsTransform] };

// ---------------------------------------------------------------------------------------------
// text-symbols
// Characters released myst-to-tex writes wrongly in running text (utils.js `textReplacements`):
// - the minus sign U+2212 becomes a hyphen (`symbols`), as does an ASCII hyphen opening a
//   number, so "-0.30" prints a hyphen where the samples write `$-$0.30`;
// - the arrows U+2190, U+2192, U+2194, U+21D0, U+21D2, U+21D4 (`arrows`) become `\rightarrow`
//   and so on in text mode: "Missing $ inserted", forced through at exit 0. They are the only
//   text replacements that are math commands; the math-only symbols get `$...$` already;
// - three periods stay three periods, where the samples use `\ldots`.
// Each becomes a texText node of `$-$`, `$\rightarrow$` or `\ldots{}`, the site keeping the
// character (util.texSymbols, which table-columns shares for table cells). An inline repair.

const textSymbolsTransform = {
  name: 'text-symbols',
  doc: 'LaTeX for minus signs, arrows and ellipses in running text',
  stage: 'project',
  plugin: () => (tree) => splitTexts(tree, (value, { start }) => cutText(value, texSymbols(value, start))),
};

export const textSymbols = { repair: 'text-symbols', transforms: [textSymbolsTransform] };

// ---------------------------------------------------------------------------------------------
// abbreviation-spaces
// econsocart keeps `\nonfrenchspacing` under the `te` option alone (econsocart.cls, "\ifte@layout"),
// so in Theoretical Economics a period after a lowercase letter ends a sentence: "e.g. this"
// gets a sentence space. The TE sample asks for `e.g.\ this`, which Markdown cannot write.
// The space after a closed list of abbreviations becomes a texText `\ `, an interword space,
// which under `\frenchspacing` (ecta, qe) is the space LaTeX sets anyway, so it applies to all
// three journals. The second list often ends a sentence, so it is kept before a capital.

const ABBREVIATIONS = [
  ...['e.g.', 'i.e.', 'cf.', 'vs.', 'viz.', 'resp.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.'],
  ...['Fig.', 'Figs.', 'Eq.', 'Eqs.', 'Sec.', 'Ch.', 'Thm.', 'Prop.', 'Def.', 'Vol.', 'pp.'],
];
const SENTENCE_ENDS = ['etc.', 'et al.', 'approx.', 'p.', 'no.'];
const abbreviationPattern = (list) => list.map((a) => a.replace(/\./g, '\\.').replace(/ /g, '\\s+')).join('|');
const ABBREVIATION = new RegExp(
  `(?<![\\p{L}\\p{N}.])(?:(${abbreviationPattern(ABBREVIATIONS)})|(${abbreviationPattern(SENTENCE_ENDS)}))(\\s+)`,
  'giu',
);

export function abbreviationCuts(value, next = '') {
  const cuts = [];
  for (const m of value.matchAll(ABBREVIATION)) {
    const space = m.index + m[0].length - m[3].length;
    const after = value.charAt(m.index + m[0].length) || next;
    if (!after || (m[2] && after !== after.toLowerCase())) continue;
    cuts.push({ index: space, length: m[3].length, tex: '\\ ' });
  }
  return cuts;
}

const abbreviationSpacesTransform = {
  name: 'abbreviation-spaces',
  doc: 'An interword space after an abbreviation, for the nonfrenchspacing of TE',
  stage: 'project',
  plugin: () => (tree) => splitTexts(tree, (value, { next }) => cutText(value, abbreviationCuts(value, next))),
};

export const abbreviationSpaces = { repair: 'abbreviation-spaces', transforms: [abbreviationSpacesTransform] };

// ---------------------------------------------------------------------------------------------
// footnotes
// LaTeX for the two footnote cases released myst-to-tex gets wrong. It writes the whole
// `\footnote{...}` at every reference, so:
// - a footnote inside a float or a table (a figure or table caption, a table cell) prints its
//   mark and loses its text, since LaTeX drops a `\footnote` inside a float or a `tabular`;
// - a footnote referenced twice prints its body twice, under two numbers.
// Both pass silently at exit 0 and are invisible on the site.
//
// Such a footnote becomes `\footnotemark[N]`, N counted from the footnote counter, and its text
// a `\footnotetext` right after the float or table in the body flow. A fixed N, since econsocart
// typesets a caption twice and a stepping `\footnotemark` would skip a number. A repeated footnote
// gets a `\label` at its first reference and `\footref` at the later ones. Every changed reference is
// swapped for a raw node (util.rawLatex), so the site keeps it. An inline repair that renders
// footnote bodies: it runs after the other inline repairs and before the block ones.

const fnLabel = (id) => `fn:${id}`;

// The nodes whose LaTeX loses a `\footnote`: a container is a float, a table a `tabular`
const BOXES = new Set(['container', 'table']);

// Every footnote reference in reading order, with its parent and the outermost box holding it,
// with that box's parent. References inside a footnote's own text are left alone.
function footnoteRefs(node, parent, box, found) {
  if (node.type === 'footnoteDefinition') return found;
  if (node.type === 'footnoteReference') found.push({ node, parent, box });
  const outer = box ?? (BOXES.has(node.type) ? { node, parent } : undefined);
  node.children?.forEach((child) => footnoteRefs(child, node, outer, found));
  return found;
}

const footnotesTransform = {
  name: 'footnotes',
  doc: 'LaTeX for footnotes in floats and tables and footnotes referenced twice',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const refs = footnoteRefs(tree, null, undefined, []);
    if (!refs.length) return;
    const defs = utils.selectAll('footnoteDefinition', tree);
    const byId = new Map(defs.map((def) => [def.identifier, def]));
    const uses = new Map();
    refs.forEach(({ node }) => uses.set(node.identifier, (uses.get(node.identifier) ?? 0) + 1));
    // The text of a footnote, labelled when another reference points back to it
    const text = (id) => {
      const label = uses.get(id) > 1 ? `\\label{${fnLabel(id)}}` : '';
      return renderTex(byId.get(id).children, defs, file).trim() + label;
    };
    const seen = new Set();
    const pending = new Map();
    refs.forEach(({ node, parent, box }) => {
      const id = node.identifier;
      if (!byId.has(id)) return;
      let tex;
      if (seen.has(id)) tex = `\\footref{${fnLabel(id)}}`;
      else if (box) {
        const notes = pending.get(box.node) ?? { parent: box.parent, texts: [] };
        pending.set(box.node, notes);
        notes.texts.push(text(id));
        tex = `\\footnotemark[\\numexpr\\value{footnote}+${notes.texts.length}\\relax]`;
      } else if (uses.get(id) > 1) tex = `\\footnote{${text(id)}}`;
      seen.add(id);
      if (tex) replaceNode(parent, node, rawLatex(node, tex));
    });
    // The texts follow their box, a raw node with nothing for the site to render. The optional
    // argument keeps hyperref from anchoring each text at the previous footnote's anchor.
    pending.forEach(({ parent, texts }, box) => {
      const tex = texts.map((t) => `\\stepcounter{footnote}\\footnotetext[\\value{footnote}]{${t}}`).join('\n');
      parent.children.splice(parent.children.indexOf(box) + 1, 0, texOnly(`\n${tex}\n\n`));
    });
  },
};

export const footnotes = { repair: 'footnotes', transforms: [footnotesTransform] };

// ---------------------------------------------------------------------------------------------
// quotes
// LaTeX for a blockquote with an attribution. MyST reads a final `> -- Name` line after a blank
// `>` line as an attribution and wraps the quote in a container of kind `quote`, which myst-to-tex
// writes as a `figure` float holding `quote` and `\caption*{Name}`. econsocart ignores the star:
// the quote floats away from its paragraph and prints a phantom "FIGURE 0." under it, at exit 0.
//
// Each such container is rendered as a plain `quote` environment (`quotation` for one of several
// paragraphs, see quotations) with the attribution set flush right on its last line, no float,
// and swapped for a raw node (util.rawLatex), so the site keeps its quote and attribution. A
// block repair: it renders a subtree, so inline repairs run first.

// The samples' environment for a quote: `quotation` for several paragraphs, else `quote`
const quoteEnvironment = (quote) => (quote.children.filter((child) => child.type === 'paragraph').length > 1 ? 'quotation' : 'quote');

const quotesTransform = {
  name: 'quotes',
  doc: 'LaTeX for attributed blockquotes, which released myst-to-tex writes as a figure',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const found = collect(tree, (node) => node.type === 'container' && node.kind === 'quote');
    if (!found.length) return;
    const footnotes = utils.selectAll('footnoteDefinition', tree);
    const render = (nodes) => renderTex(nodes, footnotes, file).trim();
    found.forEach(({ node, parent }) => {
      const quote = node.children.find((child) => child.type === 'blockquote');
      const caption = node.children.find((child) => child.type === 'caption');
      if (!quote || !caption) return;
      const env = quoteEnvironment(quote);
      const tex = () => `\n\\begin{${env}}\n${render(quote.children)}\n\\par\\hfill---${render(caption.children)}\n\\end{${env}}\n\n`;
      replaceNode(parent, node, rawLatex(node, tex));
    });
  },
};

export const quotes = { repair: 'quotes', transforms: [quotesTransform] };

// ---------------------------------------------------------------------------------------------
// quotations
// A blockquote of several paragraphs becomes myst-to-tex's `quote`, which econsocart sets with
// no paragraph indent and no space between paragraphs (econsocart.cfg, `\parsep=\z@`), so the
// break between them vanishes. The samples write such a quote as `quotation`, which indents
// each paragraph. Each becomes a block raw node of `quotation`, rendered when read; the site
// keeps the blockquote. An attributed one is the quotes repair's. A block repair.

const quotationsTransform = {
  name: 'quotations',
  doc: 'LaTeX quotation for a blockquote of several paragraphs',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const found = collect(tree, (node) => node.type === 'blockquote' && quoteEnvironment(node) === 'quotation');
    const footnotes = utils.selectAll('footnoteDefinition', tree);
    found.forEach(({ node, parent }) => {
      if (!parent || (parent.type === 'container' && parent.kind === 'quote')) return;
      const tex = () => `\n\\begin{quotation}\n${renderTex(node.children, footnotes, file).trim()}\n\\end{quotation}\n\n`;
      replaceNode(parent, node, rawLatex(node, tex));
    });
  },
};

export const quotations = { repair: 'quotations', transforms: [quotationsTransform] };

// ---------------------------------------------------------------------------------------------
// smallcaps
// LaTeX for the inline nodes released myst-to-tex has no handler for. mystmd 1.12.0 logs
// `Unhandled LaTeX conversion for node of "smallcaps"` (the {sc} role) or `"keyboard"` (the {kbd}
// role), writes nothing in its place, and exits 0, so the words vanish from the PDF.
//
// {sc} becomes a span styled as the site styles small caps, its children bracketed by
// `\textsc{` and `}`, so both outputs render the children natively. {kbd} keeps its node for the
// site's <kbd> box behind a raw node of `\texttt{...}`; inline-raws (below) keeps that raw node
// inline on the site, and its `\iffalse` copy of the node still logs the line above.
// An inline repair: it runs before footnotes and the block repairs.

const smallcapsTransform = {
  name: 'smallcaps',
  doc: 'LaTeX for {sc} and {kbd}, which released myst-to-tex drops',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const found = collect(tree, (node) => node.type === 'smallcaps' || node.type === 'keyboard');
    if (!found.length) return;
    const footnotes = utils.selectAll('footnoteDefinition', tree);
    found.forEach(({ node, parent }) => {
      const children = node.children ?? [];
      if (node.type === 'smallcaps') {
        const style = { fontVariant: 'small-caps' };
        replaceNode(parent, node, { type: 'span', style, children: [texOnly('\\textsc{'), ...children, texOnly('}')] });
      } else {
        replaceNode(parent, node, rawLatex(node, `\\texttt{${renderTex(children, footnotes, file).trim()}}`));
      }
    });
  },
};

export const smallcaps = { repair: 'smallcaps', transforms: [smallcapsTransform] };

// ---------------------------------------------------------------------------------------------
// text-roles
// Markdown has no syntax for sans serif, roman or the TeX logos, which the samples use (`\textsf`,
// `\textrm`, `\LaTeX`, `\LaTeXe`, `\TeX`); a `{raw:latex}` role is invisible on the site. Roles:
// - {sf}`words` ({rm}`words`) is a span styled sans serif (serif) for the site, its children
//   bracketed by `\textsf{` (`\textrm{`) and `}` as smallcaps does, so both outputs render them;
// - {logo}`LaTeX` (or `TeX`, `LaTeX2e`) becomes a texText node: `\LaTeX` for LaTeX, the name
//   as plain text on the site. An unknown name stays text, with a warning. The role returns a
//   span holding the LaTeX, swapped at project stage: MyST parses the `value` of a raw node a
//   role returns into a paragraph. As in the samples, a space after the logo is `\ ` (the
//   command eats a plain one), a letter after it takes `{}`, and punctuation takes nothing.

// The site's LaTeX2e reads "LaTeX 2" and a Greek epsilon, built from its code point (ASCII file)
const LOGOS = {
  TeX: ['\\TeX', 'TeX'],
  LaTeX: ['\\LaTeX', 'LaTeX'],
  LaTeX2e: ['\\LaTeXe', `LaTeX 2${String.fromCharCode(0x3b5)}`],
};

// The logo command, ended for what follows it: `\TeX\` before the text's own space makes `\TeX\ `
function logoTex(command, next) {
  const text = next?.type === 'text' ? (next.value ?? '') : undefined;
  if (text === undefined) return next ? `${command}{}` : command;
  if (/^\s/.test(text)) return `${command}\\`;
  return /^[A-Za-z@]/.test(text) ? `${command}{}` : command;
}

const sfRole = {
  name: 'sf',
  alias: ['textsf'],
  doc: 'Sans serif text, `\\textsf` in LaTeX',
  body: { type: 'myst', required: true },
  run: (data) => [{ type: 'span', style: { fontFamily: 'sans-serif' }, children: [texOnly('\\textsf{'), ...data.body, texOnly('}')] }],
};

// {rm}`words`, the samples' `\textrm{Roman}`: a serif span on the site, as {sf} is a sans one
const rmRole = {
  name: 'rm',
  alias: ['textrm'],
  doc: 'Roman (serif) text, `\\textrm` in LaTeX',
  body: { type: 'myst', required: true },
  run: (data) => [{ type: 'span', style: { fontFamily: 'serif' }, children: [texOnly('\\textrm{'), ...data.body, texOnly('}')] }],
};

const logoRole = {
  name: 'logo',
  doc: 'The TeX, LaTeX or LaTeX2e logo',
  body: { type: String, required: true },
  run: (data, vfile) => {
    const name = String(data.body ?? '').trim();
    const logo = LOGOS[name] ?? LOGOS[name.replace(/e$/, '2e')];
    if (logo) return [{ type: 'span', econsocTex: logo[0], children: [{ type: 'text', value: logo[1] }] }];
    vfile?.message(`econsoc: {logo} knows ${Object.keys(LOGOS).join(', ')}, not "${name}"`, data.node);
    return [{ type: 'text', value: name }];
  },
};

const logosTransform = {
  name: 'text-roles',
  doc: 'Swaps each {logo} span for LaTeX that the site shows as text',
  stage: 'project',
  plugin: () => (tree) => {
    collect(tree, (node) => node.type === 'span' && node.econsocTex).forEach(({ node, parent }) => {
      if (!parent) return;
      const next = parent.children[parent.children.indexOf(node) + 1];
      replaceNode(parent, node, texText(logoTex(node.econsocTex, next), textOf(node)));
    });
  },
};

export const textRoles = { repair: 'text-roles', roles: [sfRole, rmRole, logoRole], transforms: [logosTransform] };

// ---------------------------------------------------------------------------------------------
// inline-code
// myst-to-tex writes inline code as `\texttt{}` with each special escaped, so `\textheight`
// becomes `\texttt{{\textbackslash}textheight}` where the samples write `\verb|\textheight|`. In
// running text, where `\verb` is legal, the code becomes a texText node of `\verb`: LaTeX reads it
// verbatim, Typst gets `#raw`, and the site shows the code as plain text, with no `\iffalse` copy
// to break the paragraph. `\verb` is illegal inside a command's argument, so code anywhere else (a
// heading, caption, footnote, link, emphasis, table cell, quote, title or frontmatter part) keeps
// `\texttt`, as does code that holds a line break or every delimiter. As in the samples, which
// write `\texttt{Typewriter}` but `\verb|[theorem]|`, code of plain characters stays `\texttt`.

// Parents whose LaTeX is running text or an environment body, never a command's argument
const VERB_PARENTS = new Set(['root', 'block', 'div', 'paragraph', 'list', 'listItem', 'proof']);
const VERB_DELIMITERS = '|!+=@/;:"\'~^-';
const VERB_SPECIALS = /[\\{}#%&_^~$[\]]/;
const verbParent = (node) => VERB_PARENTS.has(node.type) && !node.data?.part;

function verbTex(code) {
  const delimiter = [...VERB_DELIMITERS].find((c) => !code.includes(c));
  if (!delimiter || /[\r\n]/.test(code) || !VERB_SPECIALS.test(code)) return undefined;
  return `\\verb${delimiter}${code}${delimiter}`;
}

// Typst string escapes are JSON's but for code points, which Typst writes \u{...}
const typstRaw = (code) => `#raw(${JSON.stringify(code).replace(/\\u([0-9a-fA-F]{4})/g, '\\u{$1}')})`;

function verbInlineCode(node) {
  node.children?.forEach((child, i) => {
    if (child.type === 'inlineCode' && typeof child.value === 'string') {
      const tex = verbTex(child.value);
      if (tex) node.children[i] = { ...texText(tex, child.value), typst: typstRaw(child.value) };
    } else if (verbParent(child)) {
      verbInlineCode(child);
    }
  });
}

const inlineCodeTransform = {
  name: 'inline-code',
  doc: 'Writes inline code in running text as \\verb, as the samples do',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    // A frontmatter part (`<page>#parts.<name>`) may land in a command's argument
    if (sourceFile(vfile)) verbInlineCode(tree);
  },
};

export const inlineCode = { repair: 'inline-code', transforms: [inlineCodeTransform] };

// ---------------------------------------------------------------------------------------------
// linked-images
// Images inside links: a badge `[![DOI](badge.svg)](https://doi.org/...)`. Released myst-to-tex
// (1.12.0) ends every `\includegraphics` with a blank line, as for a figure's image, so a linked
// image puts a paragraph break inside `\href{...}{...}`: "Paragraph ended before \href@split was
// complete", and latexmk carries on in force mode, at exit 0, with the link broken.
//
// Each link holding an image becomes a raw node of the link's LaTeX with every image written
// inline. Rendered when myst-to-tex reads it, so the image paths are the exported ones; the site
// keeps the link. An inline repair, after doi-links, which gives a DOI badge its link back.
// An image with no width of its own is set at text height: myst-to-tex's 0.7\linewidth default
// made a badge a figure-sized box in the line (106pt overfull in the fixture).

// The node with each image swapped for its LaTeX, trimmed of the break
const inlineImages = (node, file) => {
  if (node.type === 'image' && !node.width) return texOnly(`\\includegraphics[height=1em]{${node.url}}`);
  if (node.type === 'image') return texOnly(renderTex([node], [], file).trim());
  return node.children ? { ...node, children: node.children.map((child) => inlineImages(child, file)) } : node;
};

const linkedImagesTransform = {
  name: 'linked-images',
  doc: 'Writes an image inside a link inline, with no paragraph break inside \\href',
  stage: 'project',
  plugin: () => (tree, file) => {
    collect(tree, (node) => node.type === 'link' && hasImage(node)).forEach(({ node, parent }) => {
      replaceNode(parent, node, rawLatex(node, () => renderTex([inlineImages(node, file)], [], file).trim()));
    });
  },
};

export const linkedImages = { repair: 'linked-images', transforms: [linkedImagesTransform] };

// ---------------------------------------------------------------------------------------------
// enumerate-labels
// The samples label lists `(i)`, `(ii)` (`\begin{enumerate}[(ii)]` with `\item[(i)]`, "do not
// use (1), (2)"), or leave them unlabelled (`\item[]`); a Markdown ordered list carries only a
// start, so every list prints "1.". A directive wraps one list and names its labels:
//
//   :::{enumerate} (i)        any of i, I, a, A, 1 with text around it, or `none`
//   1. The first condition.
//   :::
//
// On the site the list loses its own numbers (SITE_LIST) and each item opens with a span of its
// label. At project stage the list becomes a block raw node,
// rendered when read: `\begin{enumerate}[{widest}]`, the label width econsocart takes, then
// `\item[{(i)}]` per item, with `\@currentlabel` set to the label for an item a link targets,
// so `\ref` prints "(i)". Each item keeps its label as `econsocLabel`. A block repair.

const COUNTER_STYLES = {
  1: String,
  i: roman,
  I: (n) => roman(n).toUpperCase(),
  a: alpha,
  A: (n) => alpha(n).toUpperCase(),
};
const LABEL_PATTERN = /^([^iIaA1]*)([iIaA1])([^iIaA1]*)$/;

// The label of each of `count` items from `start`, or undefined for a pattern with no counter
function itemLabels(pattern, count, start) {
  if (pattern === 'none') return Array(count).fill('');
  const m = pattern.match(LABEL_PATTERN);
  if (!m) return undefined;
  return Array.from({ length: count }, (_, i) => `${m[1]}${COUNTER_STYLES[m[2]](start + i)}${m[3]}`);
}

const ITEM_LABEL = 'econsocItemLabel';
// The theme draws <ol> with no class of the node's, so the list sits in a div of the theme's
// Tailwind classes: `not-prose` drops the prose numbers (preflight lists have none), the rest
// restore an indent and the space around it
const SITE_LIST = 'not-prose pl-4 my-5';

const enumerateDirective = {
  name: 'enumerate',
  doc: 'An ordered list labelled (i), (a), ... as the argument says, or unlabelled with `none`',
  arg: { type: String, doc: 'The first label, such as (i), (a), i., A), or none' },
  body: { type: 'myst', required: true },
  run: (data, vfile) => {
    const pattern = String(data.arg ?? '(i)').trim();
    const [list] = data.body ?? [];
    const labels = list?.type === 'list' && data.body.length === 1 && itemLabels(pattern, list.children.length, list.start ?? 1);
    if (!labels) {
      vfile?.message(`econsoc: {enumerate} takes one list and a label such as (i), not "${pattern}"`, data.node);
      return data.body ?? [];
    }
    list.ordered = true;
    list.econsocLabels = true;
    list.children.forEach((item, i) => {
      item.econsocLabel = labels[i];
      if (!labels[i]) return;
      // A span, which LaTeX never renders: the list is written whole at project stage
      const mark = { type: 'span', [ITEM_LABEL]: true, children: [{ type: 'text', value: `${labels[i]} ` }] };
      // The first paragraph, after a `(label)=` target, which MyST later attaches to it
      const first = item.children?.find((child) => child.type !== 'mystTarget');
      if (first?.type === 'paragraph') first.children.unshift(mark);
      else item.children = [{ type: 'paragraph', children: [mark] }, ...(item.children ?? [])];
    });
    return [{ type: 'div', class: SITE_LIST, children: [list] }];
  },
};

// An optional argument as the samples write it, braced only when a `]` would end it early
const optionalArg = (tex) => (tex.includes(']') ? `{${tex}}` : tex);

// The LaTeX of a labelled list: each item's children without the site's label. An unlabelled
// (`none`) list is the samples' `itemize` of `\item[]`.
function labelledListTex(list, footnotes, file) {
  const labels = list.children.map((item) => item.econsocLabel ?? '');
  const widest = labels.reduce((a, b) => (b.length > a.length ? b : a), '');
  const items = list.children.map((item) => {
    const children = (item.children ?? []).map((child) =>
      child.type === 'paragraph' ? { ...child, children: child.children.filter((c) => !c[ITEM_LABEL]) } : child,
    );
    const label = texEscape(item.econsocLabel ?? '');
    const target = children[0]?.identifier ? `\\phantomsection\\expandafter\\def\\csname @currentlabel\\endcsname{${label}}` : '';
    return `\\item[${optionalArg(label)}]${target} ${renderTex(children, footnotes, file).trim()}`;
  });
  if (!widest) return `\n\\begin{itemize}\n${items.join('\n')}\n\\end{itemize}\n\n`;
  return `\n\\begin{enumerate}[${optionalArg(texEscape(widest))}]\n${items.join('\n')}\n\\end{enumerate}\n\n`;
}

const enumerateLabelsTransform = {
  name: 'enumerate-labels',
  doc: 'LaTeX for a list the {enumerate} directive labels',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const footnotes = utils.selectAll('footnoteDefinition', tree);
    const labels = new Map();
    collect(tree, (node) => node.type === 'list' && node.econsocLabels).forEach(({ node, parent }) => {
      node.children.forEach((item) => {
        const first = item.children?.[0];
        if (first?.identifier && item.econsocLabel) labels.set(first.identifier, item.econsocLabel);
      });
      if (parent) replaceNode(parent, node, rawLatex(node, () => labelledListTex(node, footnotes, file)));
    });
    // The site's link to such an item reads its label, as `\ref` does, where target-labels
    // wrote the item's position (inside the raw nodes of the reference repairs too)
    walk(tree, (node) => {
      const label = node.type === 'crossReference' && !node.remote ? labels.get(node.identifier) : undefined;
      if (label === undefined) return;
      node.enumerator = label;
      const authored = node.authoredText ?? '';
      if (authored.includes('%s')) node.children = [{ type: 'text', value: authored.replaceAll('%s', label) }];
      else if (!authored) node.children = [{ type: 'text', value: `Item ${label}` }];
    });
  },
};

export const enumerateLabels = {
  repair: 'enumerate-labels',
  directives: [enumerateDirective],
  transforms: [enumerateLabelsTransform],
};

// ---------------------------------------------------------------------------------------------
// list-start
// An ordered list from 3 gets `\begin{enumerate}[resume]`, a label width to econsocart, so it
// prints from 1; in a table cell myst-to-tex numbers from 0. Each becomes a lazy raw node, set
// after `\begin` (which resets the counter) or numbered by hand, run after the block repairs.

const ENUM_COUNTERS = ['enumi', 'enumii', 'enumiii', 'enumiv'];

function listTex(list, depth, inTable, footnotes, file) {
  const start = list.start ?? 1;
  if (inTable) {
    const items = list.children.map((item, i) => `${start + i}.~~${renderTex(item.children ?? [], footnotes, file).trim()}\\newline`);
    return items.join('\n');
  }
  const items = renderTex(list.children, footnotes, file).trim();
  return `\n\\begin{enumerate}\\setcounter{${ENUM_COUNTERS[depth]}}{${start - 1}}\n${items}\n\\end{enumerate}\n`;
}

// Innermost first, inside the lazy raw nodes of the block repairs too, whose LaTeX renders later
function startLists(node, depth, inTable, footnotes, file) {
  node.children?.forEach((child, i) => {
    if (child.type === 'raw' && !isLazy(child)) return;
    const ordered = child.type === 'list' && child.ordered;
    startLists(child, depth + (ordered ? 1 : 0), inTable || child.type === 'table', footnotes, file);
    if (!ordered || depth >= ENUM_COUNTERS.length || (!inTable && (child.start ?? 1) === 1)) return;
    node.children[i] = rawLatex(child, () => listTex(child, depth, inTable, footnotes, file));
  });
}

const listStartTransform = {
  name: 'list-start',
  doc: 'Numbers an ordered list from its start, in a table cell too',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => startLists(tree, 0, false, utils.selectAll('footnoteDefinition', tree), file),
};

export const listStart = { repair: 'list-start', transforms: [listStartTransform] };

// ---------------------------------------------------------------------------------------------
// inline-raws
// Inline repairs on the site. Every repair swaps a node for a raw node holding the original as
// its child (util.rawLatex), and the site theme, which has no `raw` renderer, draws a raw node
// with children as a <div>: inside a paragraph, a caption, a title or a table cell the browser
// closes the paragraph there, and the rest of the sentence can set one letter per line. The site
// JSON looks right, so only a structural check or a rendered page shows it.
//
// Each such raw node becomes util.siteSafe's span: LaTeX unchanged, the original node in place
// for the site. Runs last, so it reaches every repair's inline raw nodes, including those in a
// block raw node's children, which the site renders and the block's LaTeX does not use.

const inlineRawsTransform = {
  name: 'inline-raws',
  doc: 'Keeps inline raw nodes inline on the site',
  stage: 'project',
  plugin: () => (tree) => siteSafe(tree),
};

export const inlineRaws = { repair: 'inline-raws', transforms: [inlineRawsTransform] };
