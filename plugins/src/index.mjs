// The Econometric Society template's MyST plugin: every repair of a LaTeX export that released
// mystmd gets wrong, one repair each (docs/plugin-repairs.md lists them). ECONSOC_DISABLE=name,...
// switches repairs off; scripts/check-plugins.sh uses it to require each repair's own assertions
// to fail without it.
//
// Order is the order of the transforms within each stage. At project stage the inline repairs
// come first and the block repairs, which render a subtree to LaTeX, after them, so a block
// renders the inline repairs already made inside it.

import fs from 'node:fs';
import path from 'node:path';
import pkg from '../package.json' with { type: 'json' };
import { authoredBib, citationForms, doiLinks, partCitations } from './citations.mjs';
import {
  blockBreaks,
  boxedFloats,
  ignoredImages,
  letterMaps,
  macros,
  partHeadings,
  rawTables,
  subfigures,
  tableColumns,
  tableNotes,
} from './floats.mjs';
import {
  algorithmLines,
  claimFact,
  exercises,
  proofs,
  theoremDefinitions,
  unnumberedProofs,
} from './proofs.mjs';
import {
  labelCase,
  missingRefs,
  pageLinks,
  rawRefs,
  sectionNumbering,
  stackedLabels,
  targetLabels,
  unnumberedHeadings,
  unnumberedRefs,
  xref,
} from './refs.mjs';
import {
  abbreviationSpaces,
  enumerateLabels,
  footnotes,
  inlineRaws,
  linkedImages,
  listStart,
  mathLabels,
  quotations,
  quotes,
  smallcaps,
  textRoles,
  textSymbols,
} from './text.mjs';

const REPAIRS = [
  // Inline. doi-links restores its links before anything renders them, linked-images first;
  // target-labels numbers items before unnumbered-refs reads them, which writes `??` before xref
  // would write `\ref`; label-case follows every repair that writes `\ref`; raw-refs renders the
  // links the others wrote.
  doiLinks,
  linkedImages,
  stackedLabels,
  // unnumbered-headings strips `{-}` at document stage, before section-numbering and xref read
  unnumberedHeadings,
  sectionNumbering,
  targetLabels,
  unnumberedRefs,
  xref,
  labelCase,
  // math-labels writes `\label`s that missing-refs then resolves
  mathLabels,
  missingRefs,
  pageLinks,
  citationForms,
  partCitations,
  authoredBib,
  rawRefs,
  textSymbols,
  abbreviationSpaces,
  textRoles,
  // smallcaps before footnotes, which renders footnote bodies
  smallcaps,
  footnotes,
  partHeadings,
  // Block. The floats first, so a float inside a proof or a quote gets their LaTeX; boxed-floats
  // after the others and quotes, since it lifts the floats they make; algorithm-lines and
  // exercises before the proof repairs, which render what those hold.
  rawTables,
  tableColumns,
  // table-notes after table-columns, whose tabular it follows, and before boxed-floats
  tableNotes,
  subfigures,
  quotes,
  quotations,
  enumerateLabels,
  boxedFloats,
  ignoredImages,
  algorithmLines,
  exercises,
  // unnumbered-proofs first of the proof repairs, so it writes every `:nonumber:` proof
  unnumberedProofs,
  claimFact,
  // proofs last of the proof repairs, writing every proof they left; theorem-definitions after
  // it defines the environments they all wrote
  proofs,
  theoremDefinitions,
  // list-start after every block repair, so it reaches the lists inside their raw nodes
  listStart,
  // block-breaks follows every block repair, so it sees the raw blocks they wrote; macros reads
  // their raw LaTeX; inline-raws reaches all of it (ignored-images, a document-stage check,
  // could sit anywhere); letter-maps, last, reads the text every other repair wrote
  blockBreaks,
  macros,
  inlineRaws,
  letterMaps,
];

const disabled = new Set((process.env.ECONSOC_DISABLE ?? '').split(',').filter(Boolean));
const unknown = [...disabled].filter((name) => !REPAIRS.some((r) => r.repair === name));
if (unknown.length) throw new Error(`ECONSOC_DISABLE names no repair: ${unknown.join(', ')}`);
const active = REPAIRS.filter((r) => !disabled.has(r.repair));

// The repair names, which scripts/check-plugins.sh reads to run one rejection build per repair
export const repairs = REPAIRS.map((r) => r.repair);

// The bundle renders blocks with its own myst-to-tex, the one the mystmd release in package.json
// ships. The running mystmd is read off its install: pip puts mystmd_py/myst.cjs next to a
// mystmd-<version>.dist-info, npm puts dist/myst.cjs under mystmd's package.json.
export function hostMystmd(cli = process.argv[1]) {
  try {
    const dir = path.dirname(fs.realpathSync(cli));
    const site = path.dirname(dir);
    const info = fs.readdirSync(site).map((name) => name.match(/^mystmd-([\w.]+)\.dist-info$/)?.[1]).find(Boolean);
    if (info) return info;
    const npm = JSON.parse(fs.readFileSync(path.join(site, 'package.json'), 'utf8'));
    return npm.name === 'mystmd' ? npm.version : undefined;
  } catch {
    return undefined;
  }
}

const target = pkg.econsoc.mystmd;
const running = hostMystmd();
if (running && running !== target) {
  console.warn(
    `econsoc: plugins/econsoc.mjs was built for mystmd ${target} (myst-to-tex ${pkg.dependencies['myst-to-tex']}); ` +
      `this build runs mystmd ${running}: rebuild it (plugins/README.md)`,
  );
}

export default {
  name: 'Econsoc',
  directives: active.flatMap((r) => r.directives ?? []),
  roles: active.flatMap((r) => r.roles ?? []),
  transforms: active.flatMap((r) => r.transforms ?? []),
};
