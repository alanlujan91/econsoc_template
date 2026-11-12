// The float, macro and part repairs: raw-tables, table-columns, subfigures, boxed-floats,
// ignored-images, block-breaks, macros and part-headings.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  collect,
  escapeRegExp as escapeRe,
  labelOf,
  pageParts,
  projectConfig,
  rawLatex,
  readFrontmatter,
  renderTex,
  replaceNode as replace,
  texOnly,
  textOf,
  walk,
} from './util.mjs';

// LaTeX for four float layouts released myst-to-tex (mystmd 1.12.0) gets wrong, each at exit 0:
//   raw-tables     A `{table}` wrapping a raw tabular writes the tabular INSIDE `\caption{}`, flush
//                  left, because MyST files raw content under the caption's legend.
//   table-columns  A pipe table gets equal-width `p{}` columns, so a column of short numbers takes
//                  as much room as one of sentences and the table wraps into pages.
//   subfigures     A multi-image `{figure}` nests a `figure` per image inside the figure, and the
//                  outer label goes to the last panel: "Not in outer par mode", `\ref` prints `??`.
//   boxed-floats   A figure or table inside an admonition (`framed`, a box) or an epigraph (a
//                  `figure` itself) is a float in inner mode: "Not in outer par mode", float lost.
//                  A plain blockquote is no box: a float inside `quote` sets fine.
//
// Each swaps a node for a raw node whose `tex` is a getter: myst-to-tex reads it after the export
// copies the images and rewrites their urls (finalizeMdast runs after the project stage, on the
// same tree), so a rendered image path is the exported one. Children hold the original node, so
// the site is unchanged. Last, ignored-images warns of a figure a clean checkout lacks.

// Each raw node made here -> whether it sets a float, which boxed-floats lifts out
const LAZY = new WeakMap();

// util.rawLatex with a lazy `tex`, recorded
function lazyRawLatex(node, render, float = true) {
  const raw = rawLatex(node, render);
  LAZY.set(raw, float);
  return raw;
}

const isRaw = (node) => node.type === 'raw';
const footnotesOf = (utils, tree) => utils.selectAll('footnoteDefinition', tree);
const fullWidth = (node) => /(^|\s)(full-width|w-full)(\s|$)/.test(node.class ?? '');
const trimTex = (tex) => tex.replace(/^\s+|\s+$/g, '');

// A container's caption content, taken at transform time: before myst-to-tex reads a lazy node,
// its transformLegends merges each legend into the caption, inside raw children too
const captionOf = (container) => [...(container.children.find((child) => child.type === 'caption')?.children ?? [])];

// `\caption[]{...}\label{...}` as myst-to-tex writes a container's caption; '' for none
function captionTex(container, content, footnotes, file) {
  if (!content.length) return '';
  const id = labelOf(container);
  const numbered = container.enumerated ?? !!id;
  const body = trimTex(renderTex(content, footnotes, file));
  return `\\caption${numbered ? '[]' : '*'}{${body}}${numbered && id ? `\\label{${id}}` : ''}\n`;
}

// raw-tables: the caption first, as the class sets tables, then the raw tabular and any notes
const rawTablesTransform = {
  name: 'floats-raw-tables',
  doc: 'Writes a {table} holding a raw tabular as a table float, the tabular outside the caption',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    // A raw block's children hold its tabular parsed for the site, which LaTeX never sees
    const isRawTable = (node) =>
      node.type === 'container' &&
      node.kind === 'table' &&
      collect(node, (n) => n.type === 'table').length === 0 &&
      collect(node, (n) => isRaw(n) && !LAZY.has(n) && n.tex).length > 0;
    const footnotes = footnotesOf(utils, tree);
    collect(tree, isRawTable).forEach(({ node, ancestors }) => {
      const caption = captionOf(node);
      // MyST files the raw block under a legend; its other content is the table's notes
      const body = node.children
        .filter((child) => child.type !== 'caption')
        .flatMap((child) => (child.type === 'legend' ? child.children : [child]));
      const env = fullWidth(node) ? 'table*' : 'table';
      const tex = () => {
        const tabular = trimTex(renderTex(body, footnotes, file));
        return `\n\\begin{${env}}\n\\centering\n${captionTex(node, caption, footnotes, file)}${tabular}\n\\end{${env}}\n\n`;
      };
      replace(ancestors.at(-1), node, lazyRawLatex(node, tex));
    });
  },
};

// table-columns: a column of short cells takes its natural width (l, c or r, after the pipe
// table's own alignment); columns of text share what is left as tabularx X columns, weighted by
// their text. A cell of up to 30 characters still fits on a line.
const SHORT = 30;
const TEXT_WIDTH_PT = 396; // econsocart \textwidth, 33pc
const PT_PER_CHAR = 4;
const PAD_PT = 12;
const ALIGN = { left: 'l', center: 'c', right: 'r' };
const RAGGED = '\\raggedright\\arraybackslash';

// The characters a cell prints, math source included
const cellText = (cell) => (cell.children ?? []).map(textOf).join(' ');
// A cell an `l` column cannot hold: more than one paragraph, or a block (a list, a display)
const BLOCKS = new Set(['list', 'code', 'math', 'blockquote', 'table', 'container', 'heading', 'admonition', 'div', 'block']);
const isBlocky = (cell) => {
  const children = cell.children ?? [];
  return children.filter((n) => n.type === 'paragraph').length > 1 || children.some((n) => BLOCKS.has(n.type));
};

// Column spec for a table of uniform rows, or null to leave myst-to-tex's own
function columnSpec(table) {
  const rows = table.children ?? [];
  const cols = rows[0]?.children?.length ?? 0;
  const spans = (c) => (c.colspan ?? 1) > 1 || (c.rowspan ?? 1) > 1;
  if (!cols || rows.some((row) => row.children.length !== cols || row.children.some(spans))) return null;
  const columns = [...Array(cols).keys()].map((j) => {
    const cells = rows.map((row) => row.children[j]);
    const longest = Math.max(...cells.map((cell) => cellText(cell).trim().length));
    const align = ALIGN[cells.find((cell) => !cell.header)?.align ?? cells[0].align] ?? 'l';
    return { longest, align, text: longest > SHORT || cells.some(isBlocky) };
  });
  const fixed = columns.filter((c) => !c.text).reduce((sum, c) => sum + c.longest * PT_PER_CHAR + PAD_PT, 0);
  // Short columns alone wider than the page: myst-to-tex's wrapping columns are the lesser harm
  if (fixed > TEXT_WIDTH_PT) return null;
  const text = columns.filter((c) => c.text);
  const total = text.reduce((sum, c) => sum + c.longest, 0);
  const spec = columns.map((c) => {
    if (!c.text) return c.align;
    // tabularx shares the free width by \hsize; the factors must sum to the number of X columns
    const share = text.length === 1 ? '' : `\\hsize=${((c.longest / total) * text.length).toFixed(3)}\\hsize`;
    return `>{${RAGGED}${share}}X`;
  });
  return { spec: spec.join(''), x: text.length > 0 };
}

function tabularTex(table, spec, inContainer, footnotes, file) {
  const env = spec.x ? 'tabularx' : 'tabular';
  const width = spec.x ? '{\\linewidth}' : '';
  const lines = [`\\begin{${env}}${width}{${spec.spec}}`, '\\toprule'];
  for (const row of table.children) {
    const cells = row.children.map(({ children = [] }) => {
      const inner = children.length === 1 && children[0].type === 'paragraph' ? children[0].children : children;
      return trimTex(renderTex(inner, footnotes, file));
    });
    lines.push(`${cells.join(' & ')} \\\\`);
    if (row.children[0]?.header) lines.push('\\midrule');
  }
  lines.push('\\bottomrule', `\\end{${env}}`);
  const tex = lines.join('\n');
  // myst-to-tex sets a table outside a float off with \bigskip
  return inContainer ? `\n${tex}\n` : `\n\\bigskip\\noindent\n${tex}\n\\bigskip\n\n`;
}

const tableColumnsTransform = {
  name: 'floats-table-columns',
  doc: 'Sizes the columns of a markdown table by their content, in place of equal-width p{} columns',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const footnotes = footnotesOf(utils, tree);
    collect(tree, (node) => node.type === 'table').forEach(({ node, ancestors }) => {
      const container = ancestors.findLast((a) => a.type === 'container');
      // A longtable takes its spec in \begin, written by the container's handler
      if (container?.multipage) return;
      const spec = columnSpec(node);
      if (!spec) return;
      replace(ancestors.at(-1), node, lazyRawLatex(node, () => tabularTex(node, spec, !!container, footnotes, file), false));
    });
  },
};

// boxed-floats: the outermost box is set without its floats, and the floats follow it, which is
// where LaTeX would place them anyway. Inside a table myst-to-tex sets a container as no float.
const isFloat = (node) => (node.type === 'container' && !node.subcontainer) || LAZY.get(node) === true;
const isBox = (node) => node.type === 'admonition' || node.type === 'container';

// A copy of `node` without the nodes in `drop`, at any depth
const without = (node, drop) =>
  node.children ? { ...node, children: node.children.filter((c) => !drop.has(c)).map((c) => without(c, drop)) } : node;

const boxedFloatsTransform = {
  name: 'floats-boxed-floats',
  doc: 'Moves a figure or table out of an admonition or another float, so it sets in outer par mode',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const footnotes = footnotesOf(utils, tree);
    const byBox = new Map();
    collect(tree, isFloat).forEach(({ node, ancestors }) => {
      if (ancestors.some((a) => a.type === 'table')) return;
      const at = ancestors.findIndex(isBox);
      if (at < 0) return;
      const box = ancestors[at];
      if (!byBox.has(box)) byBox.set(box, { parent: ancestors[at - 1], floats: [] });
      byBox.get(box).floats.push(node);
    });
    byBox.forEach(({ parent, floats }, box) => {
      const drop = new Set(floats);
      replace(
        parent,
        box,
        // Rendered late like the others, so an image in the box gets its exported path too
        lazyRawLatex(box, () => `\n${renderTex([box, ...floats].map((n) => without(n, drop)), footnotes, file)}\n`, isFloat(box)),
      );
    });
  },
};

// subfigures: one figure, each image a subfigure (subcaption, which template.tex loads) under its
// own caption and label, then the figure's caption and label
const DEFAULT_PAGE_WIDTH_PIXELS = 800; // myst-to-tex utils
function widthFraction(width, panels) {
  if (typeof width === 'string' && width.endsWith('%')) return Number(width.slice(0, -1)) / 100;
  if (typeof width === 'string' && width.endsWith('px')) return Number(width.slice(0, -2)) / DEFAULT_PAGE_WIDTH_PIXELS;
  if (typeof width === 'number' && !Number.isNaN(width)) return width < 1 ? width : width / 100;
  return 0.96 / panels;
}

const panelImage = (sub) => {
  const content = sub.children.filter((child) => child.type !== 'caption' && child.type !== 'legend');
  return content.length === 1 && content[0].type === 'image' ? content[0] : null;
};

const subfiguresTransform = {
  name: 'floats-subfigures',
  doc: 'Writes a multi-image figure as one figure of subfigures, its label on the figure',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const footnotes = footnotesOf(utils, tree);
    const isMulti = (node) => node.type === 'container' && node.children?.some((child) => child.subcontainer);
    collect(tree, isMulti).forEach(({ node, ancestors }) => {
      const subs = node.children.filter((child) => child.subcontainer);
      const others = node.children.filter((child) => !child.subcontainer && child.type !== 'caption');
      // Only panels of one image each; any other content keeps myst-to-tex's layout
      if (!subs.every(panelImage) || others.some((child) => child.type !== 'legend')) return;
      // The legend joins the caption, as myst-to-tex sets it
      const caption = [...captionOf(node), ...others.flatMap((child) => child.children ?? [])];
      const panels = subs.map((sub) => ({ sub, image: panelImage(sub), caption: captionOf(sub) }));
      const env = fullWidth(node) ? 'figure*' : 'figure';
      const panelTex = ({ sub, image, caption: text }) =>
        [
          `\\begin{subfigure}[t]{${widthFraction(image.width, subs.length).toFixed(3)}\\linewidth}`,
          '\\centering',
          // Read here, when myst-to-tex renders: the url is then the exported file's
          `\\includegraphics[width=\\linewidth]{${image.url}}`,
          `\\caption{${trimTex(renderTex(text, footnotes, file))}}${labelOf(sub) ? `\\label{${labelOf(sub)}}` : ''}`,
          '\\end{subfigure}',
        ].join('\n');
      const tex = () =>
        `\n\\begin{${env}}[!htbp]\n\\centering\n${panels.map(panelTex).join('\\hfill\n')}\n${captionTex(node, caption, footnotes, file)}\\end{${env}}\n\n`;
      replace(ancestors.at(-1), node, lazyRawLatex(node, tex));
    });
  },
};

// ignored-images, a check rather than a repair: MyST reports an image missing from disk itself
// ("Cannot find image", exit 0), but not one that is on disk and gitignored, which a clean
// checkout (CI, a co-author) lacks, so that site publishes a hole and that PDF loses the figure.
const IMAGE_EXTENSIONS = ['', '.pdf', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];

const ignoredImagesTransform = {
  name: 'floats-ignored-images',
  doc: 'Warns of each image that is on disk but gitignored, so a clean checkout lacks it',
  stage: 'document',
  plugin: (_opts, utils) => (tree, vfile) => {
    const file = vfile.path;
    if (!file || file.includes('#') || !fs.existsSync(file)) return;
    const dir = path.dirname(file);
    // A url without an extension names whichever such file MyST picks; check each that exists
    const local = utils.selectAll('image', tree).filter((image) => image.url && !/^[a-z]+:/i.test(image.url));
    const paths = local.flatMap((image) =>
      IMAGE_EXTENSIONS.map((ext) => path.resolve(dir, image.url + ext)).filter((p) => fs.existsSync(p) && fs.statSync(p).isFile()),
    );
    if (!paths.length) return;
    let ignored;
    try {
      ignored = execFileSync('git', ['check-ignore', '--', ...paths], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    } catch {
      // Status 1: none ignored; 128: no git repository here
      return;
    }
    for (const p of ignored.split('\n').filter(Boolean)) {
      const message = vfile.message(`Image ${path.relative(dir, path.resolve(dir, p))} is gitignored: a clean checkout builds without it`);
      // An error, as MyST's own missing image is, so `myst build --site --strict` stops on it
      message.fatal = true;
    }
  },
};

// index.mjs runs boxed-floats after the other three, since it lifts the floats they make
export const rawTables = { repair: 'raw-tables', transforms: [rawTablesTransform] };
export const tableColumns = { repair: 'table-columns', transforms: [tableColumnsTransform] };
export const subfigures = { repair: 'subfigures', transforms: [subfiguresTransform] };
export const boxedFloats = { repair: 'boxed-floats', transforms: [boxedFloatsTransform] };
export const ignoredImages = { repair: 'ignored-images', transforms: [ignoredImagesTransform] };

// ---------------------------------------------------------------------------------------------
// block-breaks
// Stock myst-to-tex closes no block after a proof (proof.js writes `\end{theorem}` and stops), and
// a raw block ends where its LaTeX ends, so the paragraph after a theorem, a quote or any block a
// repair wrote ran on from `\end{...}` and LaTeX set it unindented, as the same paragraph. A
// LaTeX-only blank line after each one ends the paragraph there; the site draws it as an empty span.

// Parents whose children are blocks: a break anywhere else would land inside running text
const FLOW = new Set(['root', 'block', 'proof', 'admonition', 'exercise', 'solution', 'div', 'listItem', 'footnoteDefinition']);
const BREAK = '\n\n';
// Childless first, so the check never reads the lazy `tex` of a repair's raw node
const isBreak = (node) => node?.type === 'raw' && !node.children && node.tex === BREAK;

const blockBreaksTransform = {
  name: 'block-breaks',
  doc: 'Ends the paragraph after each proof and raw block in the LaTeX export',
  stage: 'project',
  plugin: () => (tree) => {
    const after = [];
    walk(tree, (node, parent) => {
      // A raw node with children stands for a block a repair rewrote; a childless one is a command
      if (FLOW.has(parent?.type) && (node.type === 'proof' || (node.type === 'raw' && node.children?.length))) after.push([parent, node]);
    });
    for (const [parent, node] of after) {
      const i = parent.children.indexOf(node);
      if (!isBreak(parent.children[i + 1])) parent.children.splice(i + 1, 0, texOnly(BREAK));
    }
  },
};

export const blockBreaks = { repair: 'block-breaks', transforms: [blockBreaksTransform] };

// ---------------------------------------------------------------------------------------------
// macros
// Definitions for math macros used only in raw LaTeX. myst-to-tex writes a `\newcommand` for a
// `math:` macro (myst.yml `project.math` or page frontmatter) only when its own math nodes use
// it, and a raw node is opaque to that scan: a macro used only in a raw block, or in a block a
// repair here renders itself (proof kinds, floats), gets no definition, and xelatex stops at the
// raw block, far from the cause, with `myst build` still at exit 0.
//
// Runs last at project stage, so the raw nodes the other repairs make are there to scan. Each
// macro the raw LaTeX uses, and each macro their definitions use, gets one `\providecommand` in a
// raw node opening the document: a no-op where MyST defines it too. The site renders nothing.

const macroBody = (value) => (typeof value === 'string' ? value : value?.macro);

// The macros `text` uses, by whole name: `\HR` is not used by `\HRat`
const usedIn = (text, names) => names.filter((name) => new RegExp(`${escapeRe(name)}(?![A-Za-z])`).test(text));

// Close the set under use inside definitions (myst-to-tex withRecursiveCommands)
function withDependencies(used, macros) {
  const all = new Set(used);
  const names = Object.keys(macros);
  for (const name of all) usedIn(macros[name], names).forEach((dep) => all.add(dep));
  return all;
}

// LaTeX the export writes, split into raw LaTeX and the math myst-to-tex scans itself
function scan(tree) {
  const raw = [];
  const math = [];
  const visit = (node) => {
    if (node.type === 'raw') {
      // Its children are the site's copy; LaTeX sees `tex` alone
      if (node.tex && (node.lang ?? 'latex').match(/^(la)?tex$/)) raw.push(node.tex);
      return;
    }
    if ((node.type === 'math' || node.type === 'inlineMath') && node.value) math.push(node.value);
    node.children?.forEach(visit);
  };
  visit(tree);
  return { raw: raw.join('\n'), math: math.join('\n') };
}

const argCount = (body) => Math.max(0, ...[...body.matchAll(/#([1-9])/g)].map((m) => Number(m[1])));

const rawMacros = {
  name: 'macros-raw',
  doc: 'Defines the math macros that only raw LaTeX uses, which myst-to-tex leaves undefined',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const file = vfile.path?.replace(/#.*$/, '');
    if (!file) return;
    const entries = { ...projectConfig(path.dirname(file)).math, ...readFrontmatter(file).math };
    const macros = Object.fromEntries(
      Object.entries(entries)
        .map(([name, value]) => [name, macroBody(value)])
        .filter(([name, body]) => name.startsWith('\\') && typeof body === 'string'),
    );
    const names = Object.keys(macros);
    if (!names.length) return;
    const { raw, math } = scan(tree);
    const mystDefines = withDependencies(usedIn(math, names), macros);
    const needed = [...withDependencies(usedIn(raw, names), macros)].filter((name) => !mystDefines.has(name));
    if (!needed.length) return;
    const lines = needed.map((name) => {
      const n = argCount(macros[name]);
      return `\\providecommand{${name}}${n ? `[${n}]` : ''}{${macros[name]}}`;
    });
    tree.children.unshift({ type: 'raw', lang: 'latex', tex: `${lines.join('\n')}\n` });
  },
};

export const macros = { repair: 'macros', transforms: [rawMacros] };

// ---------------------------------------------------------------------------------------------
// part-headings
// Heading depth in frontmatter parts (jupyter-book/mystmd#2351, fix in #2352, unmerged). MyST
// numbers a page's headings from the export's article level (0 in a single-article export, so
// `#` is \section), but transforms each part with no level, as on the site, so a part's `#`
// becomes \subsection: an appendix part `parts: {appendix: appendix.md}` loses its letters.
//
// A plugin cannot tell an export from the site, but the page's depth shows which: MyST runs the
// document stage of every file once per export (its article at depth 1, the rest at 2, the
// site's way) and once for the site, each page before its parts, and only then any project
// stage. So when a part's document stage runs, its page's top heading depth is the one of the
// same run, and a part whose top heading sits deeper is shifted up to match it there. On the
// site, and where the page is only another export's dependency, both sit at 2 and nothing moves.

// Page -> its top heading depth in the run under way; part file -> its page
const pageDepth = new Map();
const pageOfPart = new Map();

function shallowest(tree) {
  let depth = Infinity;
  walk(tree, (node) => {
    if (node.type === 'heading' && node.depth < depth) depth = node.depth;
  });
  return depth;
}

const alignDepths = {
  name: 'parts-align-depths',
  doc: 'Lifts the headings of a frontmatter part to the depth of its page headings',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    const file = vfile.path;
    if (!file) return;
    // An inline part is `<page>#parts.<name>`; a page names its file parts in its frontmatter
    const page = file.includes('#') ? file.slice(0, file.indexOf('#')) : pageOfPart.get(file);
    if (!page) {
      pageDepth.set(file, shallowest(tree));
      if (fs.existsSync(file)) for (const part of pageParts(file)) if (part.file) pageOfPart.set(part.file, file);
      return;
    }
    const shift = shallowest(tree) - (pageDepth.get(page) ?? Infinity);
    // NaN or Infinity when either has no heading: nothing to align with
    if (!(shift > 0 && Number.isFinite(shift))) return;
    walk(tree, (node) => {
      if (node.type === 'heading') node.depth -= shift;
    });
  },
};

export const partHeadings = { repair: 'part-headings', transforms: [alignDepths] };
