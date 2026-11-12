// Pseudocode lines. MyST parses a `.tex` page's `algorithmic` environment into `algorithmLine`
// nodes (tex-to-myst), which released myst-to-tex (1.12.0) does not handle: it logs `Unhandled
// LaTeX conversion for node of "algorithmLine"` per line and the algorithm prints with no body.
// No Markdown syntax makes these nodes, so only `.tex` source pages meet the bug.
//
// The parser has already flattened `\While{c}` into a line "while c do" with its keywords bold,
// so the lines cannot be turned back into algpseudocode's macros. Each run of lines is written
// as `\begin{algorithmic}` of `\State` lines, indented by the parser's depth. A block that must
// run before the proof repairs, which render an algorithm's body without these lines.

import { rawLatex, renderTex } from './util.mjs';

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

const algorithmLines = {
  name: 'algorithm-lines',
  doc: 'LaTeX for pseudocode lines parsed from a .tex page',
  stage: 'project',
  plugin: (_opts, utils) => (tree, file) => replaceRuns(tree, utils.selectAll('footnoteDefinition', tree), file),
};

export default { repair: 'algorithm-lines', transforms: [algorithmLines] };
