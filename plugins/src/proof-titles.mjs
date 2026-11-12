// Proof titles holding anything but plain words. Released myst-to-tex (1.12.0) writes a proof's
// optional argument from `select('admonitionTitle > text')`, the FIRST text node of the title,
// verbatim, and renders the rest of the title into the body: inline math, an `abbreviations:`
// token, a role or a {prf:ref} spill out as a bold fragment ("Theorem 1 ( Regularity). EGM",
// "Proof of . Proposition 1"). The same unescaped write lets a `%`, `&` or `]` break the build.
//
// The select searches the whole block, so an UNTITLED proof steals the title of a proof nested in
// it ("Theorem 1 (Inner words)", and the inner one loses its title); and an untitled, unlabelled
// proof whose body opens with `[` has that bracket read as its title.
//
// Every proof whose title is not one such safe text node is swapped for a raw node whose LaTeX
// proofTex writes (proof-kinds.mjs), the title rendered from all its children. A block, so it
// runs after the inline repairs (xref) have fixed the references inside the title.

import { blockRepair, ENVIRONMENTS, titleOf } from './proof-kinds.mjs';
import { labelOf } from './util.mjs';

// The first text at the start of a block, '' when it opens with anything else
const firstText = (node) => (node.type === 'text' ? node.value ?? '' : node.children?.[0] ? firstText(node.children[0]) : '');

// What released myst-to-tex writes right: one text node with no LaTeX special and no `]`
function plainTitle(title) {
  const [only, ...rest] = title.children ?? [];
  return !rest.length && only?.type === 'text' && !/[\\{}#$%&_^~\]]/.test(only.value ?? '');
}

// True when a title with a text child lies anywhere below `node`, raw nodes' children included
const titleBelow = (node) =>
  (node.children ?? []).some((child) =>
    (child.type === 'admonitionTitle' && child.children?.some((c) => c.type === 'text')) || titleBelow(child));

const proofTitles = blockRepair({
  name: 'proof-titles',
  doc: 'LaTeX for proof titles holding math, abbreviations, roles or references',
  select: (node) => {
    if (node.type !== 'proof' || !ENVIRONMENTS.has(node.kind ?? 'proof')) return false;
    const title = titleOf(node);
    if (title) return !plainTitle(title);
    // With no title and no label, a body opening with `[` is read as the title ("Remark 1 (1).")
    return titleBelow(node) || (!labelOf(node) && /^\s*\[/.test(firstText(node)));
  },
});

export default { repair: 'proof-titles', transforms: [proofTitles] };
