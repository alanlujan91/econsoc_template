// Unnumbered sections for a page whose frontmatter sets `numbering: {headings: false}`. The site
// honors the key, but the LaTeX export never sees it: the headings carry no `enumerated: false`,
// so myst-to-tex writes a numbered `\section` (myst-references.md). The page's tree now opens
// with `\setcounter{secnumdepth}{0}` and closes by restoring the value it found, so a book export
// that holds other pages keeps their numbers. Its headings are recorded for unnumbered-refs,
// since a `\ref` to an unnumbered section prints the number of whatever came before it.
// Page-level `heading_N: false` is left alone, though the site honors it: which LaTeX level heading_N
// names shifts with `numbering.title`, and secnumdepth cannot unnumber a level above a numbered one.

import { readFrontmatter, texOnly, walk } from './util.mjs';

// Pages whose headings are unnumbered, and the identifiers of those headings, project-wide
const offPages = new Set();
export const unnumberedHeadings = new Set();

// `numbering: {headings: false}`, or its object form `headings: {enabled: false}`
function headingsOff(file) {
  const headings = readFrontmatter(file).numbering?.headings;
  return headings === false || headings?.enabled === false;
}

const record = {
  name: 'econsoc-section-numbering-record',
  doc: 'Finds the pages whose frontmatter turns heading numbers off',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    if (!headingsOff(vfile.path)) return;
    offPages.add(vfile.path);
    walk(tree, (node) => {
      if (node.type === 'heading' && node.identifier) unnumberedHeadings.add(node.identifier);
    });
  },
};

const unnumber = {
  name: 'econsoc-section-numbering',
  doc: 'Turns LaTeX section numbers off for a page whose frontmatter turns heading numbers off',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    if (!offPages.has(vfile.path)) return;
    tree.children = [
      texOnly('\\edef\\econsocsecnumdepth{\\the\\value{secnumdepth}}\\setcounter{secnumdepth}{0}'),
      ...(tree.children ?? []),
      texOnly('\\setcounter{secnumdepth}{\\econsocsecnumdepth}'),
    ];
  },
};

export default { repair: 'section-numbering', transforms: [record, unnumber] };
