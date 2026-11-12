// Labels lost to stacking. MyST gives a node one label: of `(a)=` and `(b)=` on consecutive lines
// above a heading only `a` survives, and a `(a)=` line directly above a directive replaces its
// `:label: b`. Links to `b` then print nothing in the PDF and never resolve on the site (MyST
// warns "label replaced", then "No target for internal reference"). Each lost label becomes an
// alias of the one that survived: before resolution, every link and reference to it is pointed at
// the survivor, in every page of the project, so both outputs resolve it (a fix of the site too).
//
// The lost labels are gone from the tree by document stage, so they are read from the sources:
// every .md file under the project directory, scanned once, so a page sees the aliases of a
// sibling page whatever order MyST processes them in. The first label of a stack survives, as
// MyST's transferTargetAttrs decides (measured on 1.12.0, three stacked targets on an equation).

import fs from 'node:fs';
import path from 'node:path';
import { identifierOf, projectRoot, walk } from './util.mjs';

const TARGET = /^\s*\(([^()\s]+)\)=\s*$/;
const FENCE = /^\s*(`{3,}|~{3,}|:{3,})\s*(\{[^}]*\})?/;
const OPTION = /^\s*:([\w-]+):\s*(.*?)\s*$/;

// project directory -> Map(identifier of a lost label -> surviving label)
const aliasesByRoot = new Map();
// identifier -> surviving label, for the other repairs (raw-refs); empty while this one is off
export const aliases = new Map();

function markdownFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_build') || entry.name === 'node_modules') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(file, out);
    else if (/\.md$/i.test(entry.name)) out.push(file);
  }
  return out;
}

// The stacks of one source: arrays of labels, the survivor first
function stacks(source) {
  const lines = source.split(/\r?\n/);
  const found = [];
  // Open fences, innermost last: a code fence hides its lines, a directive fence does not
  const fences = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(FENCE);
    const top = fences.at(-1);
    if (open && !open[2] && top && open[1][0] === top.mark[0] && open[1].length >= top.mark.length) {
      fences.pop();
      continue;
    }
    if (top?.code) continue;
    if (open && (open[2] || open[1][0] !== ':')) {
      fences.push({ mark: open[1], code: !open[2] });
      if (!open[2]) continue;
    }
    if (!TARGET.test(lines[i])) continue;
    const stack = [];
    for (; i < lines.length && TARGET.test(lines[i]); i++) stack.push(lines[i].match(TARGET)[1]);
    if (lines[i]?.match(FENCE)?.[2]) {
      for (let j = i + 1; j < lines.length && OPTION.test(lines[j]); j++) {
        const [, key, value] = lines[j].match(OPTION);
        if (key === 'label' && value) stack.push(value);
      }
    }
    i--;
    if (stack.length > 1) found.push(stack);
  }
  return found;
}

function projectAliases(file) {
  const root = projectRoot(file);
  if (!aliasesByRoot.has(root)) {
    const map = new Map();
    for (const source of markdownFiles(root)) {
      for (const [survivor, ...lost] of stacks(fs.readFileSync(source, 'utf8'))) {
        for (const label of lost) if (identifierOf(label) !== identifierOf(survivor)) map.set(identifierOf(label), survivor);
      }
    }
    aliasesByRoot.set(root, map);
  }
  return aliasesByRoot.get(root);
}

const stackedLabels = {
  name: 'econsoc-stacked-labels',
  doc: 'Points links to a label lost to a stack of targets at the label that survived',
  stage: 'document',
  plugin: () => (tree, vfile) => {
    if (!vfile.path || !fs.existsSync(vfile.path.split('#')[0])) return;
    const map = projectAliases(vfile.path.split('#')[0]);
    for (const [k, v] of map) aliases.set(k, v);
    if (!map.size) return;
    walk(tree, (node) => {
      if (node.type === 'link' && /^#./.test(node.url ?? '')) {
        const survivor = map.get(identifierOf(decodeURIComponent(node.url.slice(1))));
        if (survivor) node.url = `#${survivor}`;
      } else if (node.type === 'crossReference' && map.has(node.identifier)) {
        node.label = map.get(node.identifier);
        node.identifier = identifierOf(node.label);
      }
    });
  },
};

export default { repair: 'stacked-labels', transforms: [stackedLabels] };
