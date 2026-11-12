// The proof and exercise repairs: proof-kinds, proof-titles, claim-fact, unnumbered-proofs,
// exercises and algorithm-lines, all block repairs built on blockRepair, which renders a
// subtree to LaTeX.

import { proofDirective } from 'myst-ext-proof';
import { labelOf, rawLatex, renderTex, setProofWriter } from './util.mjs';

// ---------------------------------------------------------------------------------------------
// proof-kinds
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

// Proof kind -> the environment template.tex or MyST's injected preamble defines for it
const ENVIRONMENTS = new Map(
  [
    'theorem', 'proof', 'proposition', 'definition', 'example', 'remark', 'axiom', 'conjecture',
    'lemma', 'observation', 'corollary', 'assumption', 'algorithm', 'criterion', 'property',
    'claim', 'fact',
  ].map((kind) => [kind, kind]),
);

const DROPPED = new Set(['assumption', 'algorithm', 'criterion', 'property']);

const titleOf = (node) => node.children?.find((child) => child.type === 'admonitionTitle');

// The optional argument, braced when a `]` inside it would end the argument early
const optional = (tex) => (!tex ? '' : tex.includes(']') ? `[{${tex}}]` : `[${tex}]`);

// `\begin{env}<heading>[title]\label{id}`, the body, `\end{env}`, laid out as myst-to-tex lays out
// a proof. The title is rendered from ALL its children. An unnumbered environment steps no
// counter, so its label takes an anchor of its own, for a worded link to reach it.
function theoremTex(env, node, footnotes, file, { heading = '', title = titleOf(node) } = {}) {
  const body = (node.children ?? []).filter((child) => child !== titleOf(node));
  const titleTex = title ? renderTex(title.children ?? [], footnotes, file).trim() : '';
  const anchor = env.endsWith('*') || env === 'solution' ? '\\phantomsection' : '';
  const label = labelOf(node) ? `${anchor}\\label{${labelOf(node)}}` : '';
  const bodyTex = renderTex(body, footnotes, file).trim();
  // A body opening with `[` would be read as the title when nothing stands between
  const guard = !titleTex && !label && bodyTex.startsWith('[') ? '{}' : '';
  return `\\begin{${env}}${heading}${optional(titleTex)}${label}${guard}${bodyTex}\n\\end{${env}}`;
}

// Set while unnumbered-proofs is on: every writer of a proof then stars a `:nonumber:` one,
// except in the environments that are unnumbered already
let starUnnumbered = false;
const UNNUMBERED = new Set(['proof', 'fact']);
const isStarred = (node) => node.enumerated === false && !UNNUMBERED.has(ENVIRONMENTS.get(node.kind ?? 'proof'));

const proofTex = (node, footnotes, file) => {
  const env = ENVIRONMENTS.get(node.kind ?? 'proof');
  return theoremTex(starUnnumbered && isStarred(node) ? `${env}*` : env, node, footnotes, file);
};

// A proof inside a block rendered whole, whichever repair selected the block, so the bundled
// proof handler never sees one
setProofWriter((node, footnotes, file) => (ENVIRONMENTS.has(node.kind ?? 'proof') ? proofTex(node, footnotes, file) : undefined));

// A project-stage transform swapping every node `select` accepts for a raw node of its LaTeX,
// written by `write`. A replaced node is not searched further: its writer renders its insides.
function blockRepair({ name, doc, select, write = proofTex }) {
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

const proofKindsTransform = blockRepair({
  name: 'proof-kinds',
  doc: 'LaTeX for the proof kinds released myst-to-tex drops',
  select: (node) => node.type === 'proof' && DROPPED.has(node.kind),
});

export const proofKinds = { repair: 'proof-kinds', transforms: [proofKindsTransform] };

// ---------------------------------------------------------------------------------------------
// proof-titles
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
// proofTex writes (proof-kinds above), the title rendered from all its children. A block, so it
// runs after the inline repairs (xref) have fixed the references inside the title.

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

const proofTitlesTransform = blockRepair({
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

export const proofTitles = { repair: 'proof-titles', transforms: [proofTitlesTransform] };

// ---------------------------------------------------------------------------------------------
// claim-fact
// {prf:claim} and {prf:fact}, which MyST 1.12.0 does not know: the site shows an "Unknown
// Directive" box and the export writes nothing for it, while the build still exits 0.
//
// Both are registered here as proof directives, MyST's own (myst-ext-proof) under new names, so
// the site renders a "Claim 1" or "Fact" box as for any proof kind and references resolve.
// Released myst-to-tex drops a proof kind it does not know, so the LaTeX is written by proofTex
// (proof-kinds above) into template.tex's `claim` (numbered) and `fact` (starred) environments.

// `fact` is starred in template.tex, so the site leaves it unnumbered too
const claimFactDirective = (kind, numbered) => ({
  ...proofDirective,
  name: `prf:${kind}`,
  alias: [`proof:${kind}`],
  doc: `A ${kind}, written in LaTeX as template.tex's \`${kind}\` environment`,
  run: (data) =>
    proofDirective.run({ ...data, name: `prf:${kind}` }).map((node) => (numbered ? node : { ...node, enumerated: false })),
});

const claimFactTransform = blockRepair({
  name: 'claim-fact',
  doc: 'LaTeX for {prf:claim} and {prf:fact}',
  select: (node) => node.type === 'proof' && (node.kind === 'claim' || node.kind === 'fact'),
});

export const claimFact = {
  repair: 'claim-fact',
  directives: [claimFactDirective('claim', true), claimFactDirective('fact', false)],
  transforms: [claimFactTransform],
};

// ---------------------------------------------------------------------------------------------
// unnumbered-proofs
// `:nonumber:` on a proof is lost in LaTeX: the site prints "Claim", the PDF "Claim 2". Every
// such proof is written by proofTex as its kind's starred environment, which template.tex defines.

const unnumberedProofsBlock = blockRepair({
  name: 'unnumbered-proofs',
  doc: 'LaTeX for a :nonumber: proof, in its starred environment',
  select: (node) => node.type === 'proof' && ENVIRONMENTS.has(node.kind ?? 'proof') && isStarred(node),
});

const unnumberedProofsTransform = {
  ...unnumberedProofsBlock,
  plugin: (...args) => {
    starUnnumbered = true;
    return unnumberedProofsBlock.plugin(...args);
  },
};

export const unnumberedProofs = { repair: 'unnumbered-proofs', transforms: [unnumberedProofsTransform] };

// ---------------------------------------------------------------------------------------------
// exercises
// {exercise} and {solution}, which released myst-to-tex (1.12.0) drops whole: it logs `Unhandled
// LaTeX conversion for node of "exercise"` and writes nothing, so every `\label` inside goes too
// and each reference to the exercise, or to an equation in it, prints `??`.
//
// Each block is swapped for a raw node of template.tex's environments: `exercise` (numbered, or
// `exercise*` under `:nonumber:`) with its title as the optional argument, and `solution`, whose
// heading is MyST's own title, "Solution to Exercise~\ref{...}". A `:hidden:` block, which the
// site hides, writes nothing. A block, so it runs after the inline repairs.

function exerciseTex(node, footnotes, file) {
  if (node.hidden) return ' ';
  if (node.type === 'exercise') return theoremTex(node.enumerated === false ? 'exercise*' : 'exercise', node, footnotes, file);
  const heading = renderTex(titleOf(node)?.children ?? [], footnotes, file).trim();
  return theoremTex('solution', node, footnotes, file, { heading: `{${heading || 'Solution'}}`, title: null });
}

const exercisesTransform = blockRepair({
  name: 'exercises',
  doc: 'LaTeX for {exercise} and {solution}',
  select: (node) => node.type === 'exercise' || node.type === 'solution',
  write: exerciseTex,
});

export const exercises = { repair: 'exercises', transforms: [exercisesTransform] };

// ---------------------------------------------------------------------------------------------
// algorithm-lines
// Pseudocode lines. MyST parses a `.tex` page's `algorithmic` environment into `algorithmLine`
// nodes (tex-to-myst), which released myst-to-tex (1.12.0) does not handle: it logs `Unhandled
// LaTeX conversion for node of "algorithmLine"` per line and the algorithm prints with no body.
// No Markdown syntax makes these nodes, so only `.tex` source pages meet the bug.
//
// The parser has already flattened `\While{c}` into a line "while c do" with its keywords bold,
// so the lines cannot be turned back into algpseudocode's macros. Each run of lines is written
// as `\begin{algorithmic}` of `\State` lines, indented by the parser's depth. A block that must
// run before the proof repairs, which render an algorithm's body without these lines.

const indent = (depth) => (depth > 0 ? `\\hspace*{${depth}\\algorithmicindent}` : '');

function algorithmicTex(lines, footnotes, file) {
  const numbered = lines.some((line) => line.enumerator != null);
  const states = lines.map((line) => `\\State ${indent(line.indent ?? 0)}${renderTex(line.children ?? [], footnotes, file).trim()}`);
  return `\\begin{algorithmic}${numbered ? '[1]' : ''}\n${states.join('\n')}\n\\end{algorithmic}`;
}

// Each maximal run of sibling lines becomes one raw node holding the run, so the site still
// renders every line
function replaceRuns(node, footnotes, file) {
  if (!node.children || node.type === 'raw') return;
  const out = [];
  for (const child of node.children) {
    if (child.type !== 'algorithmLine') {
      replaceRuns(child, footnotes, file);
      out.push(child);
    } else if (out.at(-1)?.algorithmLines) out.at(-1).algorithmLines.push(child);
    else out.push({ algorithmLines: [child] });
  }
  node.children = out.map((entry) => {
    if (!entry.algorithmLines) return entry;
    const lines = entry.algorithmLines;
    return rawLatex(lines, () => `\n${algorithmicTex(lines, footnotes, file)}\n`);
  });
}

const algorithmLinesTransform = {
  name: 'algorithm-lines',
  doc: 'LaTeX for pseudocode lines parsed from a .tex page',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => replaceRuns(tree, utils.selectAll('footnoteDefinition', tree), file),
};

export const algorithmLines = { repair: 'algorithm-lines', transforms: [algorithmLinesTransform] };
