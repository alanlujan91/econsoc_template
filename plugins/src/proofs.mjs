// The proof and exercise repairs: proofs, claim-fact, unnumbered-proofs, exercises and
// algorithm-lines, all block repairs built on blockRepair, which renders a subtree to LaTeX.

import { proofDirective } from 'myst-ext-proof';
import { isLazy, labelOf, rawLatex, renderTex, setProofWriter, texOnly } from './util.mjs';

// theoremTex, proofTex and blockRepair are shared by the block repairs, and util.renderTex sends
// every proof inside a subtree it renders to proofTex as well. Each block is swapped for a raw
// node (util.rawLatex) whose LaTeX its writer renders; the site labels a box from its `kind`,
// so a kind cannot be changed to one myst-to-tex knows.

// Proof kind -> its environment
const ENVIRONMENTS = new Map(
  [
    'theorem', 'proof', 'proposition', 'definition', 'example', 'remark', 'axiom', 'conjecture',
    'lemma', 'observation', 'corollary', 'assumption', 'algorithm', 'criterion', 'property',
    'claim', 'fact',
  ].map((kind) => [kind, kind]),
);

const titleOf = (node) => node.children?.find((child) => child.type === 'admonitionTitle');

// The optional argument, braced when a `]` inside it would end the argument early
const optional = (tex) => (!tex ? '' : tex.includes(']') ? `[{${tex}}]` : `[${tex}]`);

// `\begin{env}<heading>[title]\label{id}`, the body, `\end{env}`, laid out as myst-to-tex lays out
// a proof. The title is rendered from ALL its children. An unnumbered environment steps no
// counter, so its label takes an anchor of its own, for a worded link to reach it.
function theoremTex(env, node, footnotes, file, { heading = '', title = titleOf(node) } = {}) {
  const body = (node.children ?? []).filter((child) => child !== titleOf(node));
  const titleTex = title ? renderTex(title.children ?? [], footnotes, file).trim() : '';
  const unnumbered = env.endsWith('*') || env === 'solution' || Boolean(node.data?.econsocUnnumbered);
  const anchor = unnumbered ? '\\phantomsection' : '';
  // A proof's label is its lowercased identifier, as myst-to-tex writes it and label-case spells
  // the references to it (refs.mjs texLabelOf); an exercise keeps its label as written
  const id = node.type === 'proof' ? node.identifier : labelOf(node);
  const label = id ? `${anchor}\\label{${id}}` : '';
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

// The environment proofTex writes a proof into; the proofs repair may name it for the page
const envOf = (node) => {
  if (node.data?.econsocEnv) return node.data.econsocEnv;
  const env = ENVIRONMENTS.get(node.kind ?? 'proof');
  return starUnnumbered && isStarred(node) ? `${env}*` : env;
};

const proofTex = (node, footnotes, file) => theoremTex(envOf(node), node, footnotes, file);

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

// ---------------------------------------------------------------------------------------------
// proofs
// Every proof, written by proofTex, and the definitions of the kinds a page uses. Released
// myst-to-tex (mystmd 1.13.0, myst-to-tex 1.0.48) gets three things wrong:
//
// - Four kinds it drops. It has no environment for {prf:assumption}, {prf:algorithm},
//   {prf:criterion} or {prf:property}: it logs `Unhandled LaTeX proof environment` and writes
//   neither the body nor the `\label`, so every `\ref` to one prints `??`
//   (jupyter-book/mystmd#3030, fix in #3031).
// - Titles holding anything but plain words. It writes a proof's optional argument from
//   `select('admonitionTitle > text')`, the FIRST text node of the title, verbatim, and renders
//   the rest of the title into the body: inline math, an `abbreviations:` token, a role or a
//   {prf:ref} spill out as a bold fragment ("Theorem 1 ( Regularity). EGM", "Proof of .
//   Proposition 1"), and a `%`, `&` or `]` breaks the build. The select searches the whole block,
//   so an UNTITLED proof steals the title of a proof nested in it, and an untitled, unlabelled
//   proof whose body opens with `[` has that bracket read as its title. proofTex renders a title
//   from all its children, after the inline repairs (xref) have fixed the references inside it.
// - The theorem preamble. Whenever a page holds a proof it defines ten kinds, each numbered
//   within its section (`\newtheorem{theorem}{Theorem}[section]`): template.tex has to renumber
//   them through the paper, and the .tex defines every kind, used or not. The upstream samples
//   define only the kinds they use, in \startlocaldefs, numbered through the paper. With every
//   proof written here, myst-to-tex writes none and injects no definition (it does so only on
//   `hasProofs`; econsocart loads amsthm itself).
//
// The environments the page uses, read from its proof and exercise nodes (raw nodes keep theirs
// as children) and from `\begin{...}` in its own raw LaTeX, are defined as the samples define
// them, in the template part `econsoc_localdefs`. template.tex sets that part in \startlocaldefs
// in place of its definitions of every kind, which a page without the plugin still gets; the two
// must agree, and scripts/check-plugins.sh --pdf requires the same PDF text from both.

// The kinds in the samples' order, each with its heading, its style, and the counter it shares
const THEOREMS = [
  { env: 'axiom', name: 'Axiom' },
  { env: 'theorem', name: 'Theorem' },
  { env: 'claim', name: 'Claim' },
  { env: 'lemma', name: 'Lemma', counter: 'theorem' },
  { env: 'fact', name: 'Fact', unnumbered: true },
  { env: 'corollary', name: 'Corollary' },
  { env: 'proposition', name: 'Proposition' },
  { env: 'conjecture', name: 'Conjecture' },
  { env: 'observation', name: 'Observation' },
  { env: 'assumption', name: 'Assumption' },
  { env: 'algorithm', name: 'Algorithm' },
  { env: 'criterion', name: 'Criterion' },
  { env: 'property', name: 'Property' },
  { env: 'exercise', name: 'Exercise' },
  { env: 'definition', name: 'Definition', style: 'definition' },
  { env: 'example', name: 'Example', style: 'definition' },
  { env: 'remark', name: 'Remark', style: 'definition' },
];

// `solution` takes its heading as its argument, "Solution to Exercise~\ref{...}" (exercises)
const SOLUTION = [
  '\\makeatletter',
  '\\newtheorem*{es@solution}{\\es@solutionhead}',
  '\\newenvironment{solution}[1]{\\def\\es@solutionhead{#1}\\begin{es@solution}}{\\end{es@solution}}',
  '\\makeatother',
];

const KNOWN = new Set([...THEOREMS.flatMap(({ env }) => [env, `${env}*`]), 'solution']);
const BEGIN = /\\begin\{([A-Za-z]+\*?)\}/g;
const PLAIN = new Set(THEOREMS.filter((kind) => !kind.style).map(({ env }) => env));

// myst-to-tex writes emphasis as \textit, invisible in an italic (plain) theorem body: the page
// needs \textit to switch to upright there, as a hand-written \emph does
const emphasisIn = (node) => node.type === 'emphasis' || (node.children ?? []).some(emphasisIn);

// The page's theorem environments: `nodes`, those the plugin writes from proof and exercise nodes
// (raw nodes keep theirs as children), and `authored`, those its own raw LaTeX opens
function environmentsUsed(tree) {
  const nodes = new Map();
  const authored = new Set();
  let plainEmphasis = false;
  const visit = (node) => {
    const add = (env) => nodes.set(env, [...(nodes.get(env) ?? []), node]);
    if (node.type === 'proof' && ENVIRONMENTS.has(node.kind ?? 'proof')) {
      add(envOf(node));
      if (PLAIN.has(ENVIRONMENTS.get(node.kind ?? 'proof')) && emphasisIn(node)) plainEmphasis = true;
    }
    if (node.type === 'exercise' && !node.hidden) add(node.enumerated === false ? 'exercise*' : 'exercise');
    if (node.type === 'solution' && !node.hidden) add('solution');
    // A repair's raw node renders lazily and holds its original instead
    const text = node.type === 'raw' && !isLazy(node) ? (node.value ?? node.tex) : undefined;
    if (typeof text === 'string') for (const [, env] of text.matchAll(BEGIN)) if (KNOWN.has(env)) authored.add(env);
    node.children?.forEach(visit);
  };
  visit(tree);
  return { nodes, authored, plainEmphasis };
}

// A kind the plugin writes only unnumbered is defined unnumbered under its own name, as the
// samples define Example and Fact: its proofs are named for the page (envOf) and keep the anchor
// an unnumbered environment needs. Returns every environment to define and the unnumbered ones.
function nameEnvironments({ nodes, authored }) {
  const used = new Set([...nodes.keys(), ...authored]);
  const unnumbered = new Set(THEOREMS.filter((kind) => kind.unnumbered).map(({ env }) => env));
  for (const { env } of THEOREMS) {
    const starred = `${env}*`;
    if (!nodes.has(starred) || used.has(env) || authored.has(starred)) continue;
    for (const node of nodes.get(starred)) node.data = { ...node.data, econsocEnv: env, econsocUnnumbered: true };
    used.delete(starred);
    used.add(env);
    unnumbered.add(env);
  }
  if (used.has('lemma')) used.add('theorem');
  if (used.has('solution') || used.has('exercise*')) used.add('exercise');
  return { used, unnumbered };
}

// The definitions, plain kinds first and then the definition style, as the samples lay them out
function definitionsTex({ used, unnumbered }, plainEmphasis) {
  const lines = [];
  for (const style of ['plain', 'definition']) {
    const kinds = THEOREMS.filter((kind) => (kind.style ?? 'plain') === style);
    const defs = kinds.flatMap(({ env, name, counter }) => [
      ...(!used.has(env) ? [] : unnumbered.has(env) ? [`\\newtheorem*{${env}}{${name}}`] : [`\\newtheorem{${env}}${counter ? `[${counter}]` : ''}{${name}}`]),
      ...(used.has(`${env}*`) ? [`\\newtheorem*{${env}*}{${name}}`] : []),
    ]);
    if (style === 'plain' && used.has('solution')) defs.push(...SOLUTION);
    if (defs.length) lines.push(`\\theoremstyle{${style}}`, ...defs);
  }
  if (plainEmphasis) lines.push('\\makeatletter', '\\appto\\th@plain{\\let\\textit\\emph}', '\\makeatother');
  return lines.length ? lines.join('\n') : '%% No theorem environments';
}

export const LOCALDEFS = 'econsoc_localdefs';

const proofsTransform = blockRepair({
  name: 'proofs',
  doc: 'LaTeX for every proof',
  select: (node) => node.type === 'proof' && ENVIRONMENTS.has(node.kind ?? 'proof'),
});

export const proofs = { repair: 'proofs', transforms: [proofsTransform] };

// theorem-definitions, the third bug above: the definitions of the kinds the page uses, as the
// part template.tex sets in \startlocaldefs. Without it the template defines every kind itself,
// and scripts/check-plugins.sh --pdf requires the two to print the same. After proofs, whose raw
// nodes render lazily, so the names it gives a page's environments (envOf) still reach them.
const theoremDefinitionsTransform = {
  name: 'theorem-definitions',
  doc: 'The definitions of the theorem environments a page uses',
  stage: 'project',
  plugin: () => (tree) => {
    const found = environmentsUsed(tree);
    const defs = definitionsTex(nameEnvironments(found), found.plainEmphasis);
    tree.children = [...(tree.children ?? []), { type: 'block', data: { part: LOCALDEFS }, children: [texOnly(defs)] }];
  },
};

export const theoremDefinitions = { repair: 'theorem-definitions', transforms: [theoremDefinitionsTransform] };

// ---------------------------------------------------------------------------------------------
// claim-fact
// {prf:claim} and {prf:fact}, which MyST 1.12.0 does not know: the site shows an "Unknown
// Directive" box and the export writes nothing for it, while the build still exits 0.
//
// Both are registered here as proof directives, MyST's own (myst-ext-proof) under new names, so
// the site renders a "Claim 1" or "Fact" box as for any proof kind and references resolve.
// Released myst-to-tex drops a proof kind it does not know, so the LaTeX is written by proofTex
// (the proofs repair above) into template.tex's `claim` (numbered) and `fact` (starred) environments.

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
