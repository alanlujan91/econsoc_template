// {exercise} and {solution}, which released myst-to-tex (1.12.0) drops whole: it logs `Unhandled
// LaTeX conversion for node of "exercise"` and writes nothing, so every `\label` inside goes too
// and each reference to the exercise, or to an equation in it, prints `??`.
//
// Each block is swapped for a raw node of template.tex's environments: `exercise` (numbered, or
// `exercise*` under `:nonumber:`) with its title as the optional argument, and `solution`, whose
// heading is MyST's own title, "Solution to Exercise~\ref{...}". A `:hidden:` block, which the
// site hides, writes nothing. A block, so it runs after the inline repairs.

import { blockRepair, theoremTex, titleOf } from './proof-kinds.mjs';
import { renderTex } from './util.mjs';

function write(node, footnotes, file) {
  if (node.hidden) return ' ';
  if (node.type === 'exercise') return theoremTex(node.enumerated === false ? 'exercise*' : 'exercise', node, footnotes, file);
  const heading = renderTex(titleOf(node)?.children ?? [], footnotes, file).trim();
  return theoremTex('solution', node, footnotes, file, { heading: `{${heading || 'Solution'}}`, title: null });
}

const exercises = blockRepair({
  name: 'exercises',
  doc: 'LaTeX for {exercise} and {solution}',
  select: (node) => node.type === 'exercise' || node.type === 'solution',
  write,
});

export default { repair: 'exercises', transforms: [exercises] };
