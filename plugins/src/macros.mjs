// Definitions for math macros used only in raw LaTeX. myst-to-tex writes a `\newcommand` for a
// `math:` macro (myst.yml `project.math` or page frontmatter) only when its own math nodes use
// it, and a raw node is opaque to that scan: a macro used only in a raw block, or in a block a
// repair here renders itself (proof kinds, floats), gets no definition, and xelatex stops at the
// raw block, far from the cause, with `myst build` still at exit 0.
//
// Runs last at project stage, so the raw nodes the other repairs make are there to scan. Each
// macro the raw LaTeX uses, and each macro their definitions use, gets one `\providecommand` in a
// raw node opening the document: a no-op where MyST defines it too. The site renders nothing.

import path from 'node:path';
import { escapeRegExp as escapeRe, projectConfig, readFrontmatter } from './util.mjs';

const macroBody = (value) => (typeof value === 'string' ? value : value?.macro);

// The macros `text` uses, by whole name: `\HR` is not used by `\HRat`
const usedIn = (text, names) => names.filter((name) => new RegExp(`${escapeRe(name)}(?![A-Za-z])`).test(text));

// Close the set under use inside definitions (myst-to-tex withRecursiveCommands)
function withDependencies(used, macros) {
  const all = new Set(used);
  const names = Object.keys(macros);
  for (const name of all) usedIn(macros[name], names).forEach((dep) => all.add(dep));
  return all;
}

// LaTeX the export writes, split into raw LaTeX and the math myst-to-tex scans itself
function scan(tree) {
  const raw = [];
  const math = [];
  const visit = (node) => {
    if (node.type === 'raw') {
      // Its children are the site's copy; LaTeX sees `tex` alone
      if (node.tex && (node.lang ?? 'latex').match(/^(la)?tex$/)) raw.push(node.tex);
      return;
    }
    if ((node.type === 'math' || node.type === 'inlineMath') && node.value) math.push(node.value);
    node.children?.forEach(visit);
  };
  visit(tree);
  return { raw: raw.join('\n'), math: math.join('\n') };
}

const argCount = (body) => Math.max(0, ...[...body.matchAll(/#([1-9])/g)].map((m) => Number(m[1])));

const rawMacros = {
  name: 'macros-raw',
  doc: 'Defines the math macros that only raw LaTeX uses, which myst-to-tex leaves undefined',
  stage: 'project',
  plugin: () => (tree, vfile) => {
    const file = vfile.path?.replace(/#.*$/, '');
    if (!file) return;
    const entries = { ...projectConfig(path.dirname(file)).math, ...readFrontmatter(file).math };
    const macros = Object.fromEntries(
      Object.entries(entries)
        .map(([name, value]) => [name, macroBody(value)])
        .filter(([name, body]) => name.startsWith('\\') && typeof body === 'string'),
    );
    const names = Object.keys(macros);
    if (!names.length) return;
    const { raw, math } = scan(tree);
    const mystDefines = withDependencies(usedIn(math, names), macros);
    const needed = [...withDependencies(usedIn(raw, names), macros)].filter((name) => !mystDefines.has(name));
    if (!needed.length) return;
    const lines = needed.map((name) => {
      const n = argCount(macros[name]);
      return `\\providecommand{${name}}${n ? `[${n}]` : ''}{${macros[name]}}`;
    });
    tree.children.unshift({ type: 'raw', lang: 'latex', tex: `${lines.join('\n')}\n` });
  },
};

export default { repair: 'macros', transforms: [rawMacros] };
