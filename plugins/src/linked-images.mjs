// Images inside links: a badge `[![DOI](badge.svg)](https://doi.org/...)`. Released myst-to-tex
// (1.12.0) ends every `\includegraphics` with a blank line, as for a figure's image, so a linked
// image puts a paragraph break inside `\href{...}{...}`: "Paragraph ended before \href@split was
// complete", and latexmk carries on in force mode, at exit 0, with the link broken.
//
// Each link holding an image becomes a raw node of the link's LaTeX with every image written
// inline. Rendered when myst-to-tex reads it, so the image paths are the exported ones; the site
// keeps the link. An inline repair, after doi-links, which gives a DOI badge its link back.

import { collect, hasImage, rawLatex, renderTex, replaceNode, texOnly } from './util.mjs';

// The node with each image swapped for its LaTeX, trimmed of the break
const inlineImages = (node, file) => {
  if (node.type === 'image') return texOnly(renderTex([node], [], file).trim());
  return node.children ? { ...node, children: node.children.map((child) => inlineImages(child, file)) } : node;
};

const linkedImages = {
  name: 'linked-images',
  doc: 'Writes an image inside a link inline, with no paragraph break inside \\href',
  stage: 'project',
  plugin: () => (tree, file) => {
    collect(tree, (node) => node.type === 'link' && hasImage(node)).forEach(({ node, parent }) => {
      replaceNode(parent, node, rawLatex(node, () => renderTex([inlineImages(node, file)], [], file).trim()));
    });
  },
};

export default { repair: 'linked-images', transforms: [linkedImages] };
