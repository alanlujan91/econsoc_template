// References to targets that have no number. MyST prints the kind's bare word for them ("Paragraph",
// "Equation"), and for `[Equation %s](#x)` the LaTeX gets `Equation~\ref{x}`; LaTeX then prints the
// last number before the target (a labelled `:enumerated: false` equation still writes `\label`
// inside `equation*`) or `??`. The first is a wrong number at exit 0; neither is caught by a gate
// that greps the PDF for `??`. Such a reference now prints `??label` and the build warns, whatever
// the target: a paragraph that is no list item (target-labels numbers those), a code block, an
// unnumbered equation or figure, or a heading on a page with `numbering: {headings: false}`
// (section-numbering). A bare link to a heading still prints its title, as MyST writes it, and a
// worded link keeps its words. Runs before xref, which would turn the `??` back into `\ref`.

import { labelOf, plainText, rawLatex, walk } from './util.mjs';
import { fill, isProjectRef, missingTex, pageTargets, splitAt, texLabelOf } from './refs.mjs';
import { unnumberedHeadings } from './section-numbering.mjs';

// Whether LaTeX numbers a target of the page: MyST also numbers a code block ("Program 2.1"),
// which myst-to-tex writes with neither number nor label
function texNumbers(target) {
  switch (target.type) {
    // A `fact` or a `:nonumber:` block is a starred environment, and an exercise is numbered
    // by exercises.mjs; a solution's environment is starred
    case 'proof':
    case 'exercise':
      return target.enumerated !== false;
    // A heading's label from target-labels, an implicit one's included, sits after it, so \ref
    // prints its number; one before an uncaptioned figure would print the section's
    case 'heading':
      return target.enumerated !== false;
    case 'container':
      return Boolean(texLabelOf(target)) && !target.texPhantom;
    case 'math':
      return target.enumerated !== false && Boolean(target.label);
    case 'paragraph':
      return Boolean(target.texItem);
    default:
      return false;
  }
}

function hasNoNumber(node, targets) {
  if (node.kind === 'heading' && unnumberedHeadings.has(node.identifier)) return true;
  const target = node.remote ? undefined : targets.get(node.identifier)?.node;
  if (target) return !texNumbers(target);
  // In a sibling document, MyST's number is all there is
  return node.enumerator == null ? node.kind !== 'heading' : node.kind === 'code';
}

// LaTeX with `??label` in the number's place, or undefined when the reference prints words
function unnumberedTex(node) {
  const label = labelOf(node);
  const text = plainText(node) ?? '';
  const authored = node.authoredText ?? (text === node.template ? '' : text.replace('??', '%s'));
  if (authored.includes('%s')) return fill(splitAt(authored, '%s'), missingTex(label));
  if (authored || node.kind === 'heading') return undefined;
  return missingTex(label);
}

const unnumberedRefs = {
  name: 'econsoc-unnumbered-refs',
  doc: 'Prints ?? and warns for a reference to a target the PDF does not number',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const targets = pageTargets(tree);
    walk(tree, (node, parent, index) => {
      if (!isProjectRef(node, parent) || !hasNoNumber(node, targets)) return;
      const tex = unnumberedTex(node);
      if (tex === undefined) return;
      vfile.message(`econsoc: the reference to "${labelOf(node)}" prints ??, its ${node.kind} target has no number`, node);
      parent.children[index] = rawLatex(node, tex);
    });
  },
};

export default { repair: 'unnumbered-refs', transforms: [unnumberedRefs] };
