// LaTeX for the four proof kinds that released myst-to-tex drops. mystmd 1.12.0 (myst-to-tex
// 1.0.48) has no environment for {prf:assumption}, {prf:algorithm}, {prf:criterion} or
// {prf:property}: it logs `Unhandled LaTeX proof environment` and writes neither the body nor
// the `\label`, so every `\ref` to one prints `??` (jupyter-book/mystmd#3030, fix in #3031).
//
// Each such block is swapped for a raw node (util.rawLatex) whose LaTeX proofTex writes. The
// site labels a box from its `kind`, so the kind cannot be changed to one myst-to-tex knows.
// template.tex defines the four environments. theoremTex, proofTex and blockRepair are shared
// with the other block repairs (proof-titles, claim-fact, exercises), and util.renderTex sends
// every proof inside a subtree it renders to proofTex as well.

import { labelOf, rawLatex, renderTex, setProofWriter } from './util.mjs';

// Proof kind -> the environment template.tex or MyST's injected preamble defines for it
export const ENVIRONMENTS = new Map(
  [
    'theorem', 'proof', 'proposition', 'definition', 'example', 'remark', 'axiom', 'conjecture',
    'lemma', 'observation', 'corollary', 'assumption', 'algorithm', 'criterion', 'property',
    'claim', 'fact',
  ].map((kind) => [kind, kind]),
);

const DROPPED = new Set(['assumption', 'algorithm', 'criterion', 'property']);

export const titleOf = (node) => node.children?.find((child) => child.type === 'admonitionTitle');

// The optional argument, braced when a `]` inside it would end the argument early
const optional = (tex) => (!tex ? '' : tex.includes(']') ? `[{${tex}}]` : `[${tex}]`);

// `\begin{env}<heading>[title]\label{id}`, the body, `\end{env}`, laid out as myst-to-tex lays out
// a proof. The title is rendered from ALL its children.
export function theoremTex(env, node, footnotes, file, { heading = '', title = titleOf(node) } = {}) {
  const body = (node.children ?? []).filter((child) => child !== titleOf(node));
  const titleTex = title ? renderTex(title.children ?? [], footnotes, file).trim() : '';
  const label = labelOf(node) ? `\\label{${labelOf(node)}}` : '';
  const bodyTex = renderTex(body, footnotes, file).trim();
  // A body opening with `[` would be read as the title when nothing stands between
  const guard = !titleTex && !label && bodyTex.startsWith('[') ? '{}' : '';
  return `\\begin{${env}}${heading}${optional(titleTex)}${label}${guard}${bodyTex}\n\\end{${env}}`;
}

export const proofTex = (node, footnotes, file) =>
  theoremTex(ENVIRONMENTS.get(node.kind ?? 'proof'), node, footnotes, file);

// A proof inside a block rendered whole, whichever repair selected the block, so the bundled
// proof handler never sees one
setProofWriter((node, footnotes, file) => (ENVIRONMENTS.has(node.kind ?? 'proof') ? proofTex(node, footnotes, file) : undefined));

// A project-stage transform swapping every node `select` accepts for a raw node of its LaTeX,
// written by `write`. A replaced node is not searched further: its writer renders its insides.
export function blockRepair({ name, doc, select, write = proofTex }) {
  const replace = (node, footnotes, file) => {
    node.children?.forEach((child, i) => {
      // Rendered when myst-to-tex reads it, so an image inside gets its exported path
      if (select(child)) node.children[i] = rawLatex(child, () => `\n${write(child, footnotes, file)}\n`);
      else if (child.type !== 'raw') replace(child, footnotes, file);
    });
  };
  return {
    name,
    doc,
    stage: 'project',
    plugin: (_opts, utils) => (tree, file) => replace(tree, utils.selectAll('footnoteDefinition', tree), file),
  };
}

const proofKinds = blockRepair({
  name: 'proof-kinds',
  doc: 'LaTeX for the proof kinds released myst-to-tex drops',
  select: (node) => node.type === 'proof' && DROPPED.has(node.kind),
});

export default { repair: 'proof-kinds', transforms: [proofKinds] };
