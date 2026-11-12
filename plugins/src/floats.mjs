// The float, macro, preamble and part repairs: raw-tables, table-columns, table-notes,
// subfigures, boxed-floats, ignored-images, block-breaks, macros, letter-maps and part-headings.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { citedBibText } from './citations.mjs';
import {
  asList,
  collect,
  cutText,
  escapeRegExp as escapeRe,
  labelOf,
  MINUS_SIGN,
  pageParts,
  projectConfig,
  projectRoot,
  rawLatex,
  readFrontmatter,
  renderTex,
  sourceFile,
  replaceNode as replace,
  splitTexts,
  texOnly,
  texSymbols,
  textOf,
  walk,
} from './util.mjs';

// LaTeX for five float layouts released myst-to-tex (mystmd 1.12.0) gets wrong, each at exit 0:
//   raw-tables     A `{table}` wrapping a raw tabular writes the tabular INSIDE `\caption{}`, flush
//                  left, because MyST files raw content under the caption's legend.
//   table-columns  A pipe table gets equal-width `p{}` columns, so a column of short numbers takes
//                  as much room as one of sentences and the table wraps into pages; numbers sit
//                  left with hyphens for minus signs; an HTML table's colspan writes `NaN` into
//                  the column spec (100 LaTeX errors, no PDF) and its rowspan shifts the cells.
//   table-notes    The notes under a `{table}` print inside its title, merged into `\caption`.
//   subfigures     A multi-panel `{figure}` nests a `figure` per panel inside the figure, and the
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
// Its legend's content, taken at transform time too, since transformLegends then deletes it
const legendOf = (container) => container.children.filter((child) => child.type === 'legend').flatMap((child) => [...child.children]);

// `\caption[]{...}\label{...}` as myst-to-tex writes a container's caption; '' for none
function captionTex(container, content, footnotes, file) {
  if (!content.length) return '';
  const id = labelOf(container);
  const numbered = container.enumerated ?? !!id;
  const body = trimTex(renderTex(content, footnotes, file));
  return `\\caption${numbered ? '[]' : '*'}{${body}}${numbered && id ? `\\label{${id}}` : ''}\n`;
}

// Table notes as one econsocart `\legend{}`, which prints "Note:" under the table. Its argument
// takes no `\par` token, so paragraphs are joined by `\endgraf`; any other block follows as it is.
function legendTex(nodes, footnotes, file) {
  const paragraphs = nodes.filter((node) => node.type === 'paragraph');
  const blocks = nodes.filter((node) => node.type !== 'paragraph');
  const text = paragraphs.map((node) => trimTex(renderTex(node.children, footnotes, file)).replace(/\s*\n\s*/g, ' '));
  const legend = text.length ? `\\legend{${text.join('\\endgraf ')}}\n` : '';
  return `${legend}${blocks.map((node) => `${trimTex(renderTex([node], footnotes, file))}\n`).join('')}`;
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
      const content = node.children
        .filter((child) => child.type !== 'caption')
        .flatMap((child) => (child.type === 'legend' ? child.children : [child]));
      // The paragraphs after the last raw block are the notes
      const last = content.findLastIndex(isRaw);
      const body = content.slice(0, last + 1);
      const notes = content.slice(last + 1);
      const env = fullWidth(node) ? 'table*' : 'table';
      const tex = () => {
        const tabular = trimTex(renderTex(body, footnotes, file));
        return `\n\\begin{${env}}\n\\centering\n${captionTex(node, caption, footnotes, file)}${tabular}\n${legendTex(notes, footnotes, file)}\\end{${env}}\n\n`;
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

// A number as the samples' tables print one: signed, grouped, a decimal part, a percent sign,
// parentheses (a standard error) or significance stars (MINUS_SIGN, U+2212, from util).
const NUMBER = new RegExp(`^[([]?[-+${MINUS_SIGN}]?(\\d{1,3}(,\\d{3})+|\\d*)(\\.\\d+)?[)\\]]?%?\\**$`);
const isNumber = (text) => /\d/.test(text) && NUMBER.test(text.replace(/\s+/g, ''));

// Spans: each row's cells placed on the column grid, past the columns a rowspan above still
// covers. A cell is {cell, col, span, down}; `covered` holds the columns a rowspan fills.
function grid(table) {
  const carry = [];
  const rows = (table.children ?? []).map((row) => {
    const covered = new Set(carry.flatMap((left, col) => (left > 0 ? [col] : [])));
    const cells = [];
    let col = 0;
    for (const cell of row.children ?? []) {
      while (covered.has(col)) col += 1;
      const span = Math.max(1, cell.colspan ?? 1);
      const down = Math.max(1, cell.rowspan ?? 1);
      cells.push({ cell, col, span, down });
      for (let k = 0; k < span; k += 1) carry[col + k] = down;
      col += span;
    }
    covered.forEach((c) => (carry[c] -= 1));
    cells.forEach(({ col: c, span }) => {
      for (let k = 0; k < span; k += 1) carry[c + k] -= 1;
    });
    const header = cells.length > 0 && cells.every(({ cell }) => cell.header);
    return { cells, covered, header };
  });
  const width = Math.max(0, ...rows.flatMap(({ cells, covered }) => [...cells.map((c) => c.col + c.span), ...[...covered].map((c) => c + 1)]));
  return { rows, width };
}

// Column spec for a table, from its cells that span one column; null to leave myst-to-tex's own
function columnSpec(table) {
  const { rows, width: cols } = grid(table);
  if (!cols) return null;
  const columns = [...Array(cols).keys()].map((j) => {
    const cells = rows.flatMap(({ cells: row }) => row.filter((c) => c.col === j && c.span === 1).map((c) => c.cell));
    const body = cells.filter((cell) => !cell.header);
    const longest = Math.max(0, ...cells.map((cell) => cellText(cell).trim().length));
    const explicit = ALIGN[body.find((cell) => cell.align)?.align ?? cells.find((cell) => cell.align)?.align];
    // A column of numbers right-aligns, as in the samples, unless the author aligned it
    const filled = body.map((cell) => cellText(cell).trim()).filter(Boolean);
    const numeric = filled.length > 0 && filled.every(isNumber);
    const align = explicit ?? (numeric ? 'r' : 'l');
    return { longest, align, numeric: numeric && align === 'r', text: longest > SHORT || cells.some(isBlocky) };
  });
  const fixed = columns.filter((c) => !c.text).reduce((sum, c) => sum + c.longest * PT_PER_CHAR + PAD_PT, 0);
  const text = columns.filter((c) => c.text);
  const total = text.reduce((sum, c) => sum + c.longest, 0);
  // Short columns alone wider than the page: myst-to-tex's equal wrapping columns
  const equal = `p{\\dimexpr ${(1 / cols).toFixed(3)}\\linewidth-2\\tabcolsep}`;
  const spec = columns.map((c) => {
    if (fixed > TEXT_WIDTH_PT) return equal;
    if (!c.text) return c.align;
    // tabularx shares the free width by \hsize; the factors must sum to the number of X columns
    const share = text.length === 1 ? '' : `\\hsize=${((c.longest / total) * text.length).toFixed(3)}\\hsize`;
    return `>{${RAGGED}${share}}X`;
  });
  return { spec: spec.join(''), x: fixed <= TEXT_WIDTH_PT && text.length > 0, rows, columns };
}

// A hyphen or U+2212 opening a number in a cell prints as a hyphen; the samples write `$-$2.48`.
// util.texSymbols, which text-symbols applies to running text, rewrites a copy of the cell's
// nodes, so the site keeps the author's text.
function texCells(nodes) {
  const cell = { type: 'tableCell', children: structuredClone(nodes) };
  splitTexts(cell, (value, { start }) => cutText(value, texSymbols(value, start)));
  return cell.children;
}

// A spanning header gets a rule under it when another header row follows, as `\cline{5-7}` in
// the samples; the last header row gets `\midrule`. A header over a number column is centred.
function tabularTex(table, spec, inContainer, footnotes, file) {
  const env = spec.x ? 'tabularx' : 'tabular';
  const width = spec.x ? '{\\linewidth}' : '';
  const lines = [`\\begin{${env}}${width}{${spec.spec}}`, '\\toprule'];
  const cellTex = ({ cell, col, span, down }) => {
    const children = cell.children ?? [];
    const inner = children.length === 1 && children[0].type === 'paragraph' ? children[0].children : children;
    let tex = trimTex(renderTex(texCells(inner), footnotes, file));
    if (down > 1) tex = `\\multirow{${down}}{*}{${tex}}`;
    if (span > 1) return `\\multicolumn{${span}}{c}{${tex}}`;
    return cell.header && spec.columns[col].numeric ? `\\multicolumn{1}{c}{${tex}}` : tex;
  };
  spec.rows.forEach(({ cells, header }, i) => {
    const row = [];
    for (let col = 0; col < spec.columns.length; ) {
      const cell = cells.find((c) => c.col === col);
      row.push(cell ? cellTex(cell) : '');
      col += cell ? cell.span : 1;
    }
    lines.push(`${row.join(' & ')} \\\\`);
    if (!header) return;
    if (!spec.rows[i + 1]?.header) lines.push('\\midrule');
    else cells.filter((c) => c.span > 1).forEach((c) => lines.push(`\\cmidrule(lr){${c.col + 1}-${c.col + c.span}}`));
  });
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

// table-notes: the paragraphs under a `{table}`'s markdown table (its legend) are the table's
// notes, but myst-to-tex's transformLegends merges them into `\caption`, so the note prints in
// the title. The table renders without its legend and the notes follow the tabular as
// `\legend{}`, as the samples set them. A longtable (`multipage`) keeps the merged caption.
const tableNotesTransform = {
  name: 'floats-table-notes',
  doc: 'Writes the notes under a {table} as econsocart \\legend{} after the tabular, not in the caption',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const footnotes = footnotesOf(utils, tree);
    const isNoted = (node) =>
      node.type === 'container' &&
      node.kind === 'table' &&
      !node.subcontainer &&
      !node.multipage &&
      // A table of panels is subfigures' to write; a raw tabular sits in the legend, raw-tables'
      !node.children?.some((child) => child.subcontainer) &&
      node.children?.some((child) => child.type !== 'caption' && child.type !== 'legend') &&
      node.children?.some((child) => child.type === 'legend' && child.children?.length);
    collect(tree, isNoted).forEach(({ node, ancestors }) => {
      // Snapshots: transformLegends empties the legend into the caption before `tex` is read
      const caption = node.children.find((child) => child.type === 'caption');
      const notes = legendOf(node);
      const bare = {
        ...node,
        children: node.children
          .filter((child) => child.type !== 'legend')
          .map((child) => (child === caption ? { ...caption, children: captionOf(node) } : child)),
      };
      const tex = () => {
        const float = trimTex(renderTex([bare], footnotes, file));
        const end = float.lastIndexOf('\\end{table');
        return `\n${float.slice(0, end)}${legendTex(notes, footnotes, file)}${float.slice(end)}\n\n`;
      };
      replace(ancestors.at(-1), node, lazyRawLatex(node, tex));
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

// subfigures: one float, each panel a subfigure (subcaption, which template.tex loads) under its
// own caption and label, its notes below, then the float's caption and label. A panel holds an
// image drawn at the panel's width, other content (a table, code) at its own size, or panels
// of its own (a nested multi-image figure), set as subfigures inside it. A `{table}` of panels
// is a table of subtables, captions above and its notes as `\legend{}`.
const DEFAULT_PAGE_WIDTH_PIXELS = 800; // myst-to-tex utils
const PANELS_WIDTH = 0.96;

// An image's width as a fraction of the line, or null when it has none
function widthFraction(width) {
  if (typeof width === 'string' && width.endsWith('%')) return Number(width.slice(0, -1)) / 100;
  if (typeof width === 'string' && width.endsWith('px')) return Number(width.slice(0, -2)) / DEFAULT_PAGE_WIDTH_PIXELS;
  if (typeof width === 'number' && !Number.isNaN(width)) return width < 1 ? width : width / 100;
  return null;
}

// A panel as it is at transform time: transformLegends later merges its legend into its caption
function panelOf(sub) {
  const content = sub.children.filter((child) => child.type !== 'caption' && child.type !== 'legend');
  const image = content.length === 1 && content[0].type === 'image' ? content[0] : null;
  const nested = content.length > 0 && content.every((child) => child.subcontainer);
  return { sub, image, content, caption: captionOf(sub), notes: legendOf(sub), panels: nested ? content.map(panelOf) : null };
}

// An image panel takes its image's width; the other panels share what is left of the line
function panelWidths(panels) {
  const own = panels.map((panel) => (panel.image ? widthFraction(panel.image.width) : null));
  const unset = own.filter((width) => width == null).length;
  const free = PANELS_WIDTH - own.reduce((sum, width) => sum + (width ?? 0), 0);
  const share = free > 0.1 * unset ? free / unset : PANELS_WIDTH / panels.length;
  return own.map((width) => width ?? share);
}

function panelsTex(panels, table, footnotes, file) {
  const env = table ? 'subtable' : 'subfigure';
  const widths = panelWidths(panels);
  return panels
    .map((panel, i) => {
      const id = labelOf(panel.sub);
      const text = trimTex(renderTex(panel.caption, footnotes, file));
      // A panel of panels takes its letter before theirs, as the site does: a phantom caption
      // steps the counter, and the caption it prints after them recalls that letter
      const lettered = panel.panels && id;
      const caption = lettered ? `\\subcaption*{(\\subref*{${id}}) ${text}}` : `\\caption{${text}}${id ? `\\label{${id}}` : ''}`;
      // Read here, when myst-to-tex renders: an image url is then the exported file's
      const body = panel.image
        ? `\\includegraphics[width=\\linewidth]{${panel.image.url}}`
        : panel.panels
          ? `${lettered ? `\\phantomcaption\\label{${id}}\n` : ''}${panelsTex(panel.panels, table, footnotes, file)}`
          : trimTex(renderTex(panel.content, footnotes, file));
      const notes = panel.notes.length ? [`{\\footnotesize ${trimTex(renderTex(panel.notes, footnotes, file))}\\par}`] : [];
      return [
        `\\begin{${env}}[t]{${widths[i].toFixed(3)}\\linewidth}`,
        '\\centering',
        ...(table ? [caption, body] : [body, caption]),
        ...notes,
        `\\end{${env}}`,
      ].join('\n');
    })
    .join('\\hfill\n');
}

const subfiguresTransform = {
  name: 'floats-subfigures',
  doc: 'Writes a figure or table of panels as one float of subfigures, its label on the float',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => {
    const footnotes = footnotesOf(utils, tree);
    // The outermost container of panels: a nested one is a panel of it
    const isMulti = (node) => node.type === 'container' && !node.subcontainer && node.children?.some((child) => child.subcontainer);
    collect(tree, isMulti).forEach(({ node, ancestors }) => {
      const others = node.children.filter((child) => !child.subcontainer && child.type !== 'caption');
      // Anything beside panels, caption and legend keeps myst-to-tex's layout
      if (others.some((child) => child.type !== 'legend')) return;
      const table = node.kind === 'table';
      const panels = node.children.filter((child) => child.subcontainer).map(panelOf);
      // A figure's legend joins its caption, as myst-to-tex sets it; a table's is its notes
      const caption = table ? captionOf(node) : [...captionOf(node), ...legendOf(node)];
      const notes = table ? legendOf(node) : [];
      const env = `${table ? 'table' : 'figure'}${fullWidth(node) ? '*' : ''}`;
      const tex = () => {
        const head = captionTex(node, caption, footnotes, file);
        const body = `${panelsTex(panels, table, footnotes, file)}\n`;
        const inner = table ? `${head}${body}${legendTex(notes, footnotes, file)}` : `${body}${head}`;
        return `\n\\begin{${env}}[!htbp]\n\\centering\n${inner}\\end{${env}}\n\n`;
      };
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
    const file = sourceFile(vfile);
    if (!file) return;
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

// raw-legends: MyST parses each `{raw} latex` block for the site with tex-to-myst, which does not
// know econsocart's `\legend` and logs an "Unhandled TEX conversion" error for it. It keeps the
// macro's text all the same, and MyST files that paragraph as the table's legend, so the site
// shows the note and the LaTeX keeps the macro: the error is false, and `--strict` fails on it.
// Document-stage plugins run after that parse and before MyST prints the file's messages, so this
// drops one such error per `\legend` whose table holds a legend on the site; any other stays.
const LEGEND_UNHANDLED = 'Unhandled TEX conversion for node of "macro_legend"';
const legendMacros = (tex) => (tex.replace(/(^|[^\\])%.*$/gm, '$1').match(/\\legend\s*\{/g) ?? []).length;
const legendTables = (node) =>
  (node.type === 'container' && node.children?.some((child) => child.type === 'legend' && child.children?.length) ? 1 : 0) +
  (node.children ?? []).reduce((n, child) => n + legendTables(child), 0);

const rawLegendsTransform = {
  name: 'floats-raw-legends',
  doc: "Drops tex-to-myst's false error for a \\legend in raw LaTeX whose table shows the note on the site",
  stage: 'document',
  plugin: () => (tree, file) => {
    let recovered = 0;
    walk(tree, (node) => {
      if (node.type !== 'raw' || !/^(la)?tex$/.test(node.lang ?? '') || typeof node.value !== 'string') return;
      recovered += Math.min(legendMacros(node.value), legendTables(node));
    });
    if (!recovered) return;
    file.messages = file.messages.filter((m) => !(String(m.message).includes(LEGEND_UNHANDLED) && recovered-- > 0));
  },
};

// index.mjs runs boxed-floats after the other three, since it lifts the floats they make
export const rawTables = { repair: 'raw-tables', transforms: [rawTablesTransform] };
export const tableColumns = { repair: 'table-columns', transforms: [tableColumnsTransform] };
export const tableNotes = { repair: 'table-notes', transforms: [tableNotesTransform] };
export const rawLegends = { repair: 'raw-legends', transforms: [rawLegendsTransform] };
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
// letter-maps
// template.tex maps, under xelatex, every character the T1 font would drop or misprint (U+00A0
// to U+00BF, U+00D7, U+00DF, U+00F7, U+00FF and everything past U+00FF) to its LICR: 22 lines
// of preamble a page without such a character never uses. This repair writes the part
// econsoc_letters_off when the export can write none: not the body as myst-to-tex renders it
// (which writes U+00A0 as `~` and a curly quote as `'`), nor what reaches the LaTeX unrendered,
// the frontmatter the template copies, its parts, every myst.yml the page can inherit from and
// its references' .bib entries. The template then leaves the maps out. Without the plugin,
// without this repair or with a reference it cannot read (a DOI citation), the part is absent
// and the maps stay.

export const LETTERS_OFF = 'econsoc_letters_off';

const MAPPED_POINTS = new Set([0xd7, 0xdf, 0xf7, 0xff]);
const isMapped = (point) => (point >= 0xa0 && point <= 0xbf) || point > 0xff || MAPPED_POINTS.has(point);
const hasMapped = (text) => {
  for (const c of text) if (isMapped(c.codePointAt(0))) return true;
  return false;
};
const XML_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

// Whether source text needs the maps: a mapped character typed or written as an HTML entity,
// which MyST decodes; a named entity past the five XML ones may be any character, so it counts
function sourceNeedsMaps(text) {
  if (hasMapped(text)) return true;
  for (const [, named, dec, hex] of text.matchAll(/&(?:([A-Za-z][A-Za-z0-9]*)|#([0-9]+)|#[xX]([0-9A-Fa-f]+));/g)) {
    if (named ? !XML_ENTITIES.has(named) : isMapped(Number.parseInt(dec ?? hex, dec ? 10 : 16))) return true;
  }
  return false;
}

// The text of every config the page may inherit from: the myst.yml files at and above the
// project root and the files their `extends:` names, followed; undefined when one is a URL or
// cannot be read or parsed, whose text is then unknown
function inheritedConfigs(root) {
  const texts = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return true;
    seen.add(file);
    try {
      const text = fs.readFileSync(file, 'utf8');
      texts.push(text);
      const extended = asList(yaml.load(text)?.extends);
      return extended.every((entry) => {
        const target = typeof entry === 'string' ? entry : entry?.url;
        return typeof target === 'string' && !/^[a-z]+:\/\//i.test(target) && visit(path.resolve(path.dirname(file), target));
      });
    } catch {
      return false;
    }
  };
  for (let d = path.resolve(root); ; d = path.dirname(d)) {
    const file = path.join(d, 'myst.yml');
    if (fs.existsSync(file) && !visit(file)) return undefined;
    if (path.dirname(d) === d) return texts;
  }
}

// What a page's LaTeX is made of: the body as myst-to-tex renders it (into a file of its own, so
// the render's warnings do not repeat the export's), the text the template copies unrendered
// (frontmatter and its parts), and every config the page inherits, undefined when one is unknown
function paperText(tree, file, utils) {
  return {
    body: renderTex(tree.children, footnotesOf(utils, tree), { path: file, messages: [] }),
    unrendered: [JSON.stringify(readFrontmatter(file)), ...pageParts(file).map((part) => part.source ?? '')],
    configs: inheritedConfigs(projectRoot(file)),
  };
}

// A part the template reads (template.yml declares it), set nowhere on the page
const partBlock = (part, tex) => ({ type: 'block', data: { part }, children: [texOnly(tex)] });

// A project-stage transform of a page (never a part), which appends the part blocks `parts`
// returns for the page's paperText
const paperTransform = (name, doc, parts) => ({
  name,
  doc,
  stage: 'project',
  plugin: (_opts, utils) => (tree, vfile) => {
    const file = sourceFile(vfile);
    if (tree.children && file) tree.children = [...tree.children, ...parts(paperText(tree, file, utils), tree, file)];
  },
});

const lettersTransform = paperTransform(
  'letter-maps',
  'Marks a page whose typeset text needs no xelatex letter map, so the template leaves the maps out',
  ({ body, unrendered, configs }, tree, file) => {
    const bib = citedBibText(tree, file);
    if (hasMapped(body) || bib === undefined || configs === undefined) return [];
    return [...unrendered, ...configs, bib].some(sourceNeedsMaps) ? [] : [partBlock(LETTERS_OFF, '%% No letter maps')];
  },
);

export const letterMaps = { repair: 'letter-maps', transforms: [lettersTransform] };

// ---------------------------------------------------------------------------------------------
// used-packages
// template.tex loads 16 packages econsocart lacks and MyST does not inject (template.yml declares
// them, so MyST never adds its own copy), plus cleveref, for any raw LaTeX that needs them, where
// the samples load none. This repair writes the part econsoc_packages
// with the `\usepackage` lines of those the page's LaTeX uses, found by their commands in the same
// text letter-maps reads, and econsoc_cleveref when it uses cleveref. The template then loads only
// those. Without the plugin, without this repair, with a config it cannot read, or with an
// `\input` whose file it cannot see, the parts are absent and every package loads.

export const PACKAGES_PART = 'econsoc_packages';
export const CLEVEREF_PART = 'econsoc_cleveref';

// Each package, in template.tex's order and with its options there, and the commands and
// environments that need it; array's need is read off column specifications (usesArray)
const envs = (...names) => String.raw`\\begin\{(?:${names.join('|')})\}`;
const commands = (...names) => String.raw`\\(?:${names.join('|')})\b`;
const PACKAGES = [
  { name: 'booktabs', needs: commands('toprule', 'midrule', 'bottomrule', 'cmidrule', 'addlinespace', 'specialrule', 'morecmidrules') },
  { name: 'array' },
  { name: 'algpseudocode', needs: envs('algorithmic') },
  { name: 'subcaption', needs: `${envs('subfigure', 'subtable')}|${commands('subcaption', 'subcaptionbox', 'subref')}` },
  { name: 'multirow', needs: commands('multirow') },
  { name: 'tabularx', needs: envs('tabularx') },
  { name: 'wrapfig', needs: envs('wrapfigure', 'wraptable') },
  { name: 'threeparttable', needs: envs('threeparttable', 'threeparttablex', 'tablenotes') },
  { name: 'adjustbox', needs: `${envs('adjustbox')}|${commands('adjustbox', 'adjustimage')}` },
  { name: 'changepage', needs: `${envs('adjustwidth\\*?')}|${commands('checkoddpage', 'changepage')}` },
  { name: 'mhchem', needs: commands('ce', 'pu') },
  { name: 'cancel', needs: commands('cancel', 'bcancel', 'xcancel', 'cancelto') },
  { name: 'supertabular', needs: `${envs('supertabular\\*?', 'mpsupertabular')}|${commands('tablehead', 'tabletail', 'tablefirsthead')}` },
  { name: 'epigraph', needs: `${envs('epigraphs')}|${commands('epigraph', 'epigraphhead')}` },
  { name: 'framed', needs: envs('framed', 'shaded\\*?', 'snugshade\\*?', 'leftbar', 'oframed', 'titled-frame') },
  { name: 'ulem', options: 'normalem', needs: commands('uline', 'uuline', 'uwave', 'sout', 'xout', 'dashuline', 'dotuline') },
].map((p) => ({ ...p, needs: p.needs && new RegExp(p.needs) }));
const CLEVEREF = /\\(?:[cC]ref|[cC]refrange|labelcref|[nN]amecref|lcnamecref|[cC]pageref|[cC]refname|crefformat)\b/;
// A file LaTeX reads that this repair cannot see into
const UNSEEN = /\\(?:input|include|InputIfFileExists|import|subimport)\b/;

// Whether a column specification needs array's `>{}`, `<{}`, `!{}`, `m{}`, `b{}` or `w{}`: read off
// every tabular-like environment and \multicolumn, a braced group at a time
const TABULARS = /\\begin\{(?:tabular\*?|array|longtable|tabularx|tabulary|xltabular|supertabular\*?|mpsupertabular)\}|\\multicolumn\{[^{}]*\}|\\newcolumntype/g;
function braced(text, start) {
  let i = start;
  while (/\s/.test(text[i] ?? '')) i++;
  if (text[i] === '[') i = text.indexOf(']', i) + 1;
  while (/\s/.test(text[i] ?? '')) i++;
  if (text[i] !== '{') return undefined;
  for (let depth = 0, j = i; j < text.length; j++) {
    depth += text[j] === '{' ? 1 : text[j] === '}' ? -1 : 0;
    if (depth === 0) return { group: text.slice(i + 1, j), end: j + 1 };
  }
  return undefined;
}
function usesArray(text) {
  for (const m of text.matchAll(TABULARS)) {
    if (m[0] === '\\newcolumntype') return true;
    let at = m.index + m[0].length;
    // tabular*, tabularx and the like take a width before the specification
    if (/\\begin\{(?:tabular\*|tabularx|tabulary|xltabular)\}/.test(m[0])) at = braced(text, at)?.end ?? at;
    const spec = braced(text, at)?.group;
    if (spec === undefined || /[><!mbwW]\s*\{/.test(spec)) return true;
  }
  return false;
}

function packagesUsed(texts) {
  const used = PACKAGES.filter((p) => texts.some((t) => (p.needs ? p.needs.test(t) : usesArray(t))));
  const lines = used.map((p) => `\\usepackage${p.options ? `[${p.options}]` : ''}{${p.name}}`);
  return { lines, cleveref: texts.some((t) => CLEVEREF.test(t)) };
}

const packagesTransform = paperTransform(
  'used-packages',
  'Lists the packages the page uses, so the template loads only those',
  ({ body, unrendered, configs }) => {
    if (configs === undefined) return [];
    const texts = [body, ...unrendered, ...configs];
    if (texts.some((t) => UNSEEN.test(t))) return [];
    const { lines, cleveref } = packagesUsed(texts);
    const listed = partBlock(PACKAGES_PART, lines.length ? lines.join('\n') : '%% No packages beyond econsocart');
    return cleveref ? [listed, partBlock(CLEVEREF_PART, '\\usepackage{cleveref}')] : [listed];
  },
);

export const usedPackages = { repair: 'used-packages', transforms: [packagesTransform] };

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
