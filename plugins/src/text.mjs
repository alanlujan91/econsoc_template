// The running-text repairs: footnotes, quotes, smallcaps, linked-images and inline-raws.

import { collect, hasImage, rawLatex, renderTex, replaceNode, siteSafe, texOnly } from './util.mjs';

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
// Each such container is rendered as a plain `quote` environment with the attribution set flush
// right on its last line, no float, and swapped for a raw node (util.rawLatex), so the site keeps
// its quote and attribution. A block repair: it renders a subtree, so inline repairs run first.

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
      const tex = () => `\n\\begin{quote}\n${render(quote.children)}\n\\par\\hfill---${render(caption.children)}\n\\end{quote}\n\n`;
      replaceNode(parent, node, rawLatex(node, tex));
    });
  },
};

export const quotes = { repair: 'quotes', transforms: [quotesTransform] };

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
// linked-images
// Images inside links: a badge `[![DOI](badge.svg)](https://doi.org/...)`. Released myst-to-tex
// (1.12.0) ends every `\includegraphics` with a blank line, as for a figure's image, so a linked
// image puts a paragraph break inside `\href{...}{...}`: "Paragraph ended before \href@split was
// complete", and latexmk carries on in force mode, at exit 0, with the link broken.
//
// Each link holding an image becomes a raw node of the link's LaTeX with every image written
// inline. Rendered when myst-to-tex reads it, so the image paths are the exported ones; the site
// keeps the link. An inline repair, after doi-links, which gives a DOI badge its link back.

// The node with each image swapped for its LaTeX, trimmed of the break
const inlineImages = (node, file) => {
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
