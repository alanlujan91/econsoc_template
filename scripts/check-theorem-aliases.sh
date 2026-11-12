#!/usr/bin/env bash
# Assert the axiom_as_assumption and observation_as_algorithm export options, with and without
# plugins/econsoc.mjs: an {prf:axiom} prints as "Assumption 1" and an {prf:observation} as
# "Algorithm 1". The plugin defines only the kinds a paper uses (its `proofs` repair); the
# template defines the alias targets itself. A run without the options must print the plain names.

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=scripts/lib-econsoc.sh
. "$repo/scripts/lib-econsoc.sh"
probe_init

# $1 = with or without the plugin, $2 = true or false for both options; prints the PDF text
probe() {
    local dir="$work/$1-$2" plugins=''
    mkdir -p "$dir"
    [ "$1" = plugin ] && plugins="  plugins: [$repo/plugins/econsoc.mjs]"
    cat > "$dir/myst.yml" <<YML
version: 1
project:
  authors: [{name: Ada Test, email: a@e.edu, affiliations: [u]}]
  affiliations: [{id: u, institution: Test University}]
$plugins
  exports:
    - id: t
      format: tex+pdf
      template: $repo/template.yml
      axiom_as_assumption: $2
      observation_as_algorithm: $2
      output: out/t.pdf
      articles: [{file: main.md}]
YML
    printf -- '---\ntitle: Alias Probe\nshort_title: Probe\n---\n\n:::{prf:axiom}\nAXIOMBODY.\n:::\n\n:::{prf:observation}\nOBSBODY.\n:::\n' > "$dir/main.md"
    (cd "$dir" && myst build --pdf --force > build.log 2>&1) || true
    pdftotext "$dir/out/t.pdf" - 2>/dev/null | tr -s '[:space:]' ' '
}

rc=0
for plugin in plugin stock; do
    on=$(probe "$plugin" true) off=$(probe "$plugin" false)
    [ -n "$on" ] && [ -n "$off" ] || { echo "FAIL ($plugin): no PDF text"; rc=1; continue; }
    # econsocart sets theorem heads in small caps, which pdftotext spaces out
    if grep -qE 'A ?SSUMPTION 1\. AXIOMBODY' <<<"$on" && grep -qE 'A ?LGORITHM 1\. OBSBODY' <<<"$on" &&
        grep -qE 'A ?XIOM 1\. AXIOMBODY' <<<"$off" && grep -qE 'O ?BSERVATION 1\. OBSBODY' <<<"$off"; then
        echo "OK ($plugin): the options print Assumption and Algorithm, and only when set"
    else
        echo "FAIL ($plugin): with the options: $on"
        echo "               without them:     $off"
        rc=1
    fi
done
exit "$rc"
