#!/usr/bin/env bash
# Assert that plugins/econsoc.mjs drops the template's xelatex letter maps only from a paper
# whose LaTeX lacks every character they map (docs/plugin-repairs.md, letter-maps), for the text
# scripts/check-plugins.sh's fixture cannot hold: a file myst.yml's `extends:` names and a cited
# .bib entry. An all-ASCII paper is the control, the one case whose maps must go.

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=scripts/lib-econsoc.sh
. "$repo/scripts/lib-econsoc.sh"
probe_init

# probe NAME AUTHOR BIB_AUTHOR: a paper whose author comes through `extends:` and which cites
# one entry; prints whether its .tex keeps the maps
probe() {
    local dir=$work/$1
    mkdir -p "$dir"
    printf 'version: 1\nproject:\n  authors: [{name: "%s", email: a@e.edu, affiliations: [u]}]\n  affiliations: [{id: u, institution: Test University}]\n' "$2" >"$dir/authors.yml"
    printf '@article{k1,\n  author = {%s},\n  title = {A Title},\n  journal = {J},\n  year = {2020}\n}\n' "$3" >"$dir/references.bib"
    cat >"$dir/myst.yml" <<YML
version: 1
extends: authors.yml
project:
  plugins: [$repo/plugins/econsoc.mjs]
  bibliography: references.bib
  exports:
    - id: t
      format: tex
      template: $repo/template.yml
      output: out/t.tex
      articles: [{file: main.md}]
YML
    printf -- '---\ntitle: Letter Probe\nshort_title: Probe\n---\n\nPlain text citing {cite:t}`k1`.\n' >"$dir/main.md"
    (cd "$dir" && myst build --tex --force >build.log 2>&1) || true
    [ -s "$dir/out/t.tex" ] || { echo "ERROR: probe $1 built no .tex" >&2; tail -20 "$dir/build.log" >&2; exit 1; }
    grep -qF '\fnms{Ada}' "$dir/out/t.tex" ||
        { echo "ERROR: probe $1 lost its extended author" >&2; tail -20 "$dir/build.log" >&2; exit 1; }
    if grep -qF '\es@ch' "$dir/out/t.tex"; then echo kept; else echo dropped; fi
}

fail=0
expect() {
    local got
    got=$(probe "$1" "$2" "$3")
    if [ "$got" = "$4" ]; then echo "OK: $1: maps $got"; else echo "FAIL: $1: maps $got, expected $4"; fail=1; fi
}
expect ascii 'Ada Test' 'Doe, Jane' dropped
expect extends 'Ada K'$'ő''szegi' 'Doe, Jane' kept
expect bib 'Ada Test' 'D'$'ő''e, Jane' kept
exit $fail
