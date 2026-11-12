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

import { hasImage, textOf, walk } from './util.mjs';

const MARKER = 'econsocDoiLink';
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
      node.data = { ...node.data, [MARKER]: node.url };
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
      if (node.type !== 'link' || !node.data?.[MARKER]) return;
      // What myst-transforms DOITransformer makes of a DOI link it is allowed to see
      const source = node.data[MARKER];
      const id = doiOf(source);
      delete node.data[MARKER];
      Object.assign(node, { url: `https://doi.org/${id}`, urlSource: source, internal: false });
      node.data.doi = id;
    });
  },
};

export default { repair: 'doi-links', transforms: [hideTransform, restoreTransform] };
