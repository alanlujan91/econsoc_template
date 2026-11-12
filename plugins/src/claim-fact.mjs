// {prf:claim} and {prf:fact}, which MyST 1.12.0 does not know: the site shows an "Unknown
// Directive" box and the export writes nothing for it, while the build still exits 0.
//
// Both are registered here as proof directives, MyST's own (myst-ext-proof) under new names, so
// the site renders a "Claim 1" or "Fact" box as for any proof kind and references resolve.
// Released myst-to-tex drops a proof kind it does not know, so the LaTeX is written by proofTex
// (proof-kinds.mjs) into template.tex's `claim` (numbered) and `fact` (starred) environments.

import { proofDirective } from 'myst-ext-proof';
import { blockRepair } from './proof-kinds.mjs';

// `fact` is starred in template.tex, so the site leaves it unnumbered too
const directive = (kind, numbered) => ({
  ...proofDirective,
  name: `prf:${kind}`,
  alias: [`proof:${kind}`],
  doc: `A ${kind}, written in LaTeX as template.tex's \`${kind}\` environment`,
  run: (data) =>
    proofDirective.run({ ...data, name: `prf:${kind}` }).map((node) => (numbered ? node : { ...node, enumerated: false })),
});

const claimFact = blockRepair({
  name: 'claim-fact',
  doc: 'LaTeX for {prf:claim} and {prf:fact}',
  select: (node) => node.type === 'proof' && (node.kind === 'claim' || node.kind === 'fact'),
});

export default { repair: 'claim-fact', directives: [directive('claim', true), directive('fact', false)], transforms: [claimFact] };
