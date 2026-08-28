#!/usr/bin/env bash
#
# Assert that frontmatter reaching jtex as a raw string is escaped, that math in
# a title is not, and that absent optional fields emit no empty macros.
#
# Three failures motivated this, all of which produced a PDF and exited 0:
#
#   1. An unescaped `&` was DELETED from the output. A keyword "K&W risk"
#      rendered "KW risk" and a JEL code "D&14" rendered "D14". Nothing in the
#      LaTeX log said so, because `&` outside a tabular is an alignment error
#      that latexmk's force mode pushes through.
#   2. An unescaped `%` opened a comment that swallowed the rest of the line, so
#      a title containing "50%" produced a PDF whose title was absent entirely.
#   3. Guarding those fields with a filter chain then introduced the opposite
#      bug: `string` calls .toString() and THROWS on an absent key, which aborts
#      the export before LaTeX runs while myst still exits 0 and leaves the
#      previous PDF in place. A stale artifact is the only symptom.
#
# --self-test seeds four defects, one per assertion class, and requires each to
# be caught. Every one of these was verified by hand in a scratch directory
# during the session that found it; this records them so a future edit that
# quietly disables one is caught. Assertions are checked in BOTH directions:
# a presence assertion must not be satisfiable by a comment, and an absence
# assertion must not fire on a comment that merely mentions the sentinel.
#
#   scripts/check-escaping.sh [--self-test]

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

command -v myst >/dev/null 2>&1 || myst() { "$repo/.venv/bin/myst" "$@"; }

die() { echo "FAIL: $*" >&2; exit 1; }

# Comment lines must be stripped before any assertion. The template emits
# upstream's example line `% [add1]{\fnms{}~\snm{}\ead[label=e?]{}}`, which
# matches every empty-macro pattern below and would fail every healthy build.
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
title: "R&D at 50% of Cost #1 with $x_1$"
short_title: "R&D 50%"
keywords: ["K&W risk"]
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
)
EMPTY=( '\\ead\[[^]]*\]{}' '\\orgdiv{}' '\\kwd{}' '\\snm{}' )

# Returns 0 when every assertion holds. Never exits, so --self-test can call it.
run_checks() {
    local tpl="$1" quiet="${2:-}" tex minimal rc=0 pat
    tex=$(build_specials "$tpl" "$work/specials.$RANDOM")
    [ -s "$tex" ] || { [ -n "$quiet" ] || echo "  no .tex produced"; return 1; }

    for pat in "${PRESENCE[@]}"; do
        body "$tex" | grep -q "$pat" || { [ -n "$quiet" ] || echo "  unescaped: $pat"; rc=1; }
    done
    # Math must survive: escaping `_` here would turn $x_1$ into $x\_1$.
    body "$tex" | grep -q '\$x_1\$' || { [ -n "$quiet" ] || echo "  math over-escaped"; rc=1; }
    # Content myst renders itself arrives escaped; escaping again emits 50\\%.
    if body "$tex" | grep -q '50\\\\%'; then
        [ -n "$quiet" ] || echo "  double-escaped"; rc=1
    fi

    minimal=$(build_minimal "$tpl" "$work/minimal.$RANDOM")
    if grep -qE 'Template render error|TypeError' "$(dirname "$(dirname "$minimal")")/render.log" 2>/dev/null; then
        [ -n "$quiet" ] || echo "  render aborted on inherited frontmatter"; rc=1
    fi
    [ -s "$minimal" ] || { [ -n "$quiet" ] || echo "  minimal fixture produced no .tex"; return 1; }
    for pat in "${EMPTY[@]}"; do
        if body "$minimal" | grep -q "$pat"; then
            [ -n "$quiet" ] || echo "  empty macro emitted: $pat"; rc=1
        fi
    done
    # An empty running head is a blank head on every odd page, shipped silently.
    body "$minimal" | grep -q '^\\runtitle{Page Heading}' \
        || { [ -n "$quiet" ] || echo "  running head did not fall back to the title"; rc=1; }
    return $rc
}

# Copy the template, apply a sed mutation, return the new dir.
mutate() {
    # Separate statements: bash expands every word of a multi-assignment `local`
    # before applying any of them, so `dir` could not reference `name` inline.
    local name="$1"
    local expr="$2"
    local dir="$work/tpl-$name"
    mkdir -p "$dir"
    local f
    for f in template.tex template.yml econsocart.cls econsocart.cfg qe.bst te.bst econsoc.bst; do
        cp "$repo/$f" "$dir/$f"
    done
    sed -i "$expr" "$dir/template.tex"
    echo "$dir"
}

if [ "${1:-}" = "--self-test" ]; then
    echo "Self-test: each seeded defect must be CAUGHT."
    fails=0

    # 1. The escaping chain stripped from both macros: every presence assertion
    #    must fail. Each macro body sits on one line, so this is line-local.
    d=$(mutate unescaped 's/|replace.*-\]/-]/')
    if run_checks "$d" quiet; then echo "  NOT CAUGHT: unescaped template"; fails=1
    else echo "  caught: unescaped template"; fi

    # 2. The undefined-key guard reverted. The running-head fallback has to go
    #    too, or `or doc.title` supplies a string and `string` never sees the
    #    undefined key: the two fixes overlap, so one alone is not a defect.
    d=$(mutate noguard "s/|default('')|string|/|string|/g; s/doc.short_title or doc.title/doc.short_title/")
    if run_checks "$d" quiet; then echo "  NOT CAUGHT: missing default('') guard"; fails=1
    else echo "  caught: missing default('') guard"; fi

    # 3. The email guard removed: an author with no email emits \ead{}, which
    #    econsocart prints as a dangling "Name:" in the PDF.
    d=$(mutate emptyead '/\\ead/ { s/\[# if author.email #\]//; s/\[# endif #\]//; }')
    if run_checks "$d" quiet; then echo "  NOT CAUGHT: empty \\ead emitted"; fails=1
    else echo "  caught: empty \\ead emitted"; fi

    # 4. The running-head fallback removed: an inherited page gets a blank head.
    d=$(mutate blankhead 's/doc.short_title or doc.title/doc.short_title/')
    if run_checks "$d" quiet; then echo "  NOT CAUGHT: blank running head"; fails=1
    else echo "  caught: blank running head"; fi

    # The healthy template must still PASS, or the checks are simply broken.
    if run_checks "$repo"; then echo "  healthy template passes"
    else echo "  NOT CAUGHT: healthy template FAILS its own checks"; fails=1; fi

    [ "$fails" -eq 0 ] || die "self-test incomplete: a seeded defect went undetected"
    echo "OK: 4 seeded defects caught, healthy template passes"
    exit 0
fi

run_checks "$repo" || die "escaping/empty-field assertions failed"
echo "OK: specials escaped, math preserved, no empty macros, running head populated"
