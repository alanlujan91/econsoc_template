#!/usr/bin/env bash
# Assert the template escapes raw frontmatter but leaves title math alone, and that an absent
# optional field drops its macro. --self-test seeds one defect per assertion class and requires each caught.
# Rationale per assertion: docs/template-internals.md, "Escaping LaTeX specials".

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# shellcheck source=scripts/lib-econsoc.sh
. "$repo/scripts/lib-econsoc.sh"

command -v myst >/dev/null 2>&1 || myst() { "$repo/.venv/bin/myst" "$@"; }

# Strip comment lines first: upstream's example `% [add1]{\fnms{}~\snm{}\ead[label=e?]{}}` matches
# every empty-macro pattern, and a presence assertion must not be satisfiable by a comment.
body() { grep -v '^[[:space:]]*%' "$1"; }

# $1 = template dir, $2 = output dir
build_specials() {
    local tpl="$1" out="$2"
    mkdir -p "$out"
    cat > "$out/myst.yml" <<YML
version: 1
project:
  authors:
    - name: Ada Test
      email: ab@example.org
      affiliations: [u]
  affiliations:
    - id: u
      institution: "Smith & Co_Ltd"
      department: "R&D 50%"
  exports:
    - id: t
      format: tex
      template: $tpl/template.yml
      output: out/t.tex
      articles:
        - file: main.md
YML
    cat > "$out/main.md" <<'MD'
---
title: 'R&D at 50% of Cost #1 with $x_1$ in "Quoted Work"'
short_title: "R&D 50%"
keywords: ["K&W risk", 'the "quoted" kw', 'a 12" lone quote']
tags: ["D&14"]
---

Body.
MD
    (cd "$out" && myst build --tex >/dev/null 2>&1) || true
    echo "$out/out/t.tex"
}

# A page with every optional field omitted, and no short_title of its own.
build_minimal() {
    local tpl="$1" out="$2"
    mkdir -p "$out"
    cat > "$out/myst.yml" <<YML
version: 1
project:
  title: Project Level Title
  short_title: Project Short
  authors:
    - name: Ada NoEmail
      affiliations: [u]
  affiliations:
    - id: u
      name: Econ-ARK
  exports:
    - id: t
      format: tex
      template: $tpl/template.yml
      output: out/t.tex
      articles:
        - file: main.md
YML
    printf -- '# Page Heading\n\nNo page-level short_title here.\n' > "$out/main.md"
    (cd "$out" && myst build --tex >"$out/render.log" 2>&1) || true
    echo "$out/out/t.tex"
}

PRESENCE=(
    'R\\&D at 50\\% of Cost \\#1'
    '\\runtitle{R\\&D 50\\%}'
    '\\kwd{K\\&W risk}'
    '\\kwd{D\\&14}'
    '\\orgname{Smith \\& Co\\_Ltd}'
    '\\orgdiv{R\\&D 50\\%}'
    "in \`\`Quoted Work''}"
    "\\\\kwd{the \`\`quoted'' kw}"
    '\\kwd{a 12" lone quote}'
)
EMPTY=( '\\ead\[[^]]*\]{}' '\\orgdiv{}' '\\kwd{}' '\\snm{}' )

# Returns 0 when every assertion holds. Never exits, so --self-test can call it.
run_checks() {
    local tpl="$1" quiet="${2:-}" tex minimal rc=0 pat
    say() { [ -n "$quiet" ] || echo "  $*"; }

    tex=$(build_specials "$tpl" "$work/specials.$RANDOM")
    [ -s "$tex" ] || { say "no .tex produced"; return 1; }

    for pat in "${PRESENCE[@]}"; do
        body "$tex" | grep -q "$pat" || { say "unescaped: $pat"; rc=1; }
    done
    # Math must survive: escaping `_` here would turn $x_1$ into $x\_1$.
    body "$tex" | grep -qF "\$x_1\$" || { say "math over-escaped"; rc=1; }
    # Content myst renders itself arrives escaped; escaping again emits 50\\%.
    if body "$tex" | grep -q '50\\\\%'; then say "double-escaped"; rc=1; fi

    minimal=$(build_minimal "$tpl" "$work/minimal.$RANDOM")
    if render_aborted "$(dirname "$(dirname "$minimal")")/render.log"; then
        say "render aborted on inherited frontmatter"; rc=1
    fi
    [ -s "$minimal" ] || { say "minimal fixture produced no .tex"; return 1; }
    for pat in "${EMPTY[@]}"; do
        if body "$minimal" | grep -q "$pat"; then say "empty macro emitted: $pat"; rc=1; fi
    done
    # An empty running head is a blank head on every odd page, at exit 0.
    body "$minimal" | grep -q '^\\runtitle{Page Heading}' \
        || { say "running head did not fall back to the title"; rc=1; }
    return $rc
}

# Copy template.yml and every file its files: list names, sed-mutate template.tex, echo the new dir.
mutate() {
    local dir="$work/tpl-$1" f
    mkdir -p "$dir"
    cp "$repo/template.yml" "$dir/" || return 1
    for f in "${SHIPPED[@]}"; do cp "$repo/$f" "$dir/$f" || return 1; done
    sed -i "$2" "$dir/template.tex" || return 1
    echo "$dir"
}

if [ "${1:-}" = "--self-test" ]; then
    echo "Self-test: each seeded defect must be CAUGHT."
    fails=0 seeded=0
    mapfile -t SHIPPED < <(template_files "$repo/template.yml")
    [[ " ${SHIPPED[*]} " == *" template.tex "* ]] || die "template.yml files: does not list template.tex"

    # seed NAME SED-EXPR: the template mutated by SED-EXPR must fail run_checks
    seed() {
        local dir
        seeded=$((seeded + 1))
        dir=$(mutate "$seeded" "$2") || die "could not build the mutated template for: $1"
        if run_checks "$dir" quiet; then echo "  NOT CAUGHT: $1"; fails=1
        else echo "  caught: $1"; fi
    }

    # Each macro body is on one line, so stripping the escaping chain is line-local.
    seed "unescaped template" 's/|replace.*-\]/-]/'
    # The fallback goes too: `or doc.title` would supply a string and hide the undefined key.
    seed "missing default('') guard" "s/|default('')|string|/|string|/g; s/doc.short_title or doc.title/doc.short_title/"
    # An author with no email emits \ead{}, which econsocart prints as a dangling "Name:".
    seed "empty \\ead emitted" '/\\ead/ { s/\[# if author.email #\]//; s/\[# endif #\]//; }'
    seed "blank running head" 's/doc.short_title or doc.title/doc.short_title/'
    # A dead quote regex leaves "Title" straight, breaking the official supplement title.
    seed "straight frontmatter quotes" 's#r/"#r/QQ#g'

    # The unmutated template must still PASS, or the checks are simply broken.
    if run_checks "$repo"; then echo "  unmutated template passes"
    else echo "  NOT CAUGHT: unmutated template FAILS its own checks"; fails=1; fi

    [ "$fails" -eq 0 ] || die "self-test incomplete: a seeded defect went undetected"
    echo "OK: $seeded seeded defects caught, unmutated template passes"
    exit 0
fi

run_checks "$repo" || die "escaping/empty-field assertions failed"
echo "OK: specials escaped, math preserved, no empty macros, running head populated"
