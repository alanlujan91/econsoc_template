// Links to labels that do not exist. MyST leaves `[](#x)` a plain link when no target has the
// label x, and myst-to-tex writes `\href{\#x}{}`: the PDF prints nothing at all, so "the class
// member [](#x) describes" reads "the class member describes" and no `??` gate sees it
// (myst-references.md). Such a link now prints `??x` and the build warns. A label defined by
// `\label{x}` in a raw LaTeX block of the page is no miss: the link becomes a `\ref` to it, with
// the word of the environment around that label ("Table~\ref{x}", or `(\ref{x})` for an equation).

import { plainText, rawLatex, texEscape, walk } from './util.mjs';
import { fill, missingTex, splitAt } from './refs.mjs';

const EQUATIONS = new Set(['equation', 'align', 'gather', 'multline', 'eqnarray', 'flalign', 'alignat']);

// The innermost environment open at `at` in `tex`, starred form folded in
function environmentAt(tex, at) {
  const open = [];
  for (const m of tex.slice(0, at).matchAll(/\\(begin|end)\s*\{([A-Za-z]+)\*?\}/g)) {
    if (m[1] === 'begin') open.push(m[2]);
    else open.pop();
  }
  return open.at(-1);
}

// label -> environment name (or '') of every `\label` in a raw LaTeX node of the tree
function rawLabels(tree) {
  const labels = new Map();
  walk(tree, (node) => {
    if (node.type !== 'raw' || typeof node.tex !== 'string') return;
    for (const m of node.tex.matchAll(/\\label\{([^}]+)\}/g)) labels.set(m[1], environmentAt(node.tex, m.index) ?? '');
  });
  return labels;
}

// LaTeX for a link to a label of a raw block
function rawTargetTex(label, env, text) {
  const ref = `\\ref{${label}}`;
  if (text.includes('%s')) return fill(splitAt(text, '%s'), ref);
  if (text) return `\\hyperref[${label}]{${texEscape(text)}}`;
  if (EQUATIONS.has(env)) return `(${ref})`;
  return env && env !== 'center' ? `${env[0].toUpperCase()}${env.slice(1)}~${ref}` : ref;
}

const missingRefs = {
  name: 'econsoc-missing-refs',
  doc: 'Prints ?? and warns for a link to a label nothing defines',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const raw = rawLabels(tree);
    walk(tree, (node, parent, index) => {
      if (node.type !== 'link' || !parent || !/^#./.test(node.url ?? '')) return;
      const label = decodeURIComponent(node.url.slice(1));
      const text = plainText(node) ?? '';
      if (raw.has(label)) {
        parent.children[index] = rawLatex(node, rawTargetTex(label, raw.get(label), text));
        return;
      }
      vfile.message(`econsoc: no target has the label "${label}", so the PDF prints ??${label}`, node);
      const tex = text.includes('%s') ? fill(splitAt(text, '%s'), missingTex(label)) : missingTex(label);
      parent.children[index] = rawLatex(node, text && !text.includes('%s') ? `${texEscape(text)}~${tex}` : tex);
    });
  },
};

export default { repair: 'missing-refs', transforms: [missingRefs] };
