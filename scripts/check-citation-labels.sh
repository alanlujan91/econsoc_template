#!/usr/bin/env bash
# Assert Econometrica's citation label for a paper with five or more authors: the initials of
# the first four and a plus sign, "HNPS+ (2023)" in the text and "[HNPS+]" in the references.
# econsoc.bst builds it through econsocart.cfg's \xcitelabel (docs/template-options.md).
# JOURNAL=qe runs the rejection case, where the label must not appear.

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
journal=${JOURNAL:-ecta}
# shellcheck source=scripts/lib-econsoc.sh
. "$repo/scripts/lib-econsoc.sh"
probe_init

sed -n '/^@article{b6,/,/^}/p' "$repo/sample/references.bib" > "$work/references.bib"
[ -s "$work/references.bib" ] || { echo "ERROR: entry b6 not found in sample/references.bib"; exit 1; }

cat > "$work/myst.yml" <<YML
version: 1
project:
  authors: [{name: Ada Test, email: a@e.edu, affiliations: [u]}]
  affiliations: [{id: u, institution: Test University}]
  bibliography: references.bib
  exports:
    - id: t
      format: tex+pdf
      template: $repo/template.yml
      journal: $journal
      output: out/t.pdf
      articles: [{file: main.md}]
YML
printf -- '---\ntitle: Label Probe\nshort_title: Probe\n---\n\nFive authors: {cite:t}`b6`.\n' > "$work/main.md"

(cd "$work" && myst build --pdf --force > build.log 2>&1) || true
grep -q 'This is BibTeX' "$work/build.log" ||
    { echo "ERROR: bibtex never ran; the label check would be vacuous"; tail -20 "$work/build.log"; exit 1; }
text=$(pdftotext "$work/out/t.pdf" - 2>/dev/null || true)
[ -n "$text" ] || { echo "ERROR: no PDF text"; exit 1; }

if grep -q 'HNPS+ (2023)' <<<"$text" && grep -qF '[HNPS+]' <<<"$text"; then
    echo "OK ($journal): five-author citation prints HNPS+ (2023), reference list [HNPS+]"
else
    echo "FAIL ($journal): five-author citation label missing; the PDF cites it as:"
    grep -n 'Hortac\|HNPS\|Horta' <<<"$text" | head -3
    exit 1
fi
