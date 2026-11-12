// The case of a label in `\ref`. MyST resolves a reference by its lowercased identifier, while
// myst-to-tex writes `\ref{...}` with the label as the link spells it and `\label{...}` with the
// target's own spelling, lowercased for a proof (proof.js writes its identifier). So `(sec-Model)=`
// with `[](#sec-model)`, or `:label: thm-Main` on a theorem with `[](#thm-Main)`, works on the site
// and prints `??` in the PDF. Every `\ref` and `\hyperref` to a target of the page now takes the
// label the target writes. Runs after the repairs that write references (xref, unnumbered-refs).

import { escapeRegExp as escape, labelOf, walk } from './util.mjs';
import { pageTargets, texLabelOf } from './refs.mjs';

const labelCase = {
  name: 'econsoc-label-case',
  doc: 'Spells every \\ref label the way its target writes \\label',
  stage: 'project',
  plugin: () => (tree) => {
    const targets = pageTargets(tree);
    walk(tree, (node, parent) => {
      const ref = node.type === 'raw' && node.children?.[0]?.type === 'crossReference' ? node.children[0] : node;
      if (ref.type !== 'crossReference' || ref.remote || !parent || ref.kind === 'definitionTerm') return;
      const target = targets.get(ref.identifier);
      const wanted = target && texLabelOf(target.node);
      const written = labelOf(ref);
      if (!wanted || wanted === written) return;
      // myst-to-tex writes a crossReference's \ref from its label, a steered one's too (refs.refNode)
      if (node === ref) ref.label = wanted;
      else {
        const old = escape(written);
        node.tex = node.tex
          .replace(new RegExp(`\\\\ref\\{${old}\\}`, 'g'), `\\ref{${wanted}}`)
          .replace(new RegExp(`\\\\hyperref\\[${old}\\]`, 'g'), `\\hyperref[${wanted}]`);
      }
    });
  },
};

export default { repair: 'label-case', transforms: [labelCase] };
