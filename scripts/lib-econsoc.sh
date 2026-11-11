#!/usr/bin/env bash
# Shared helpers for the vendoring, build and check scripts. A helper two scripts need is defined
# here once, so a mapping such as journal-to-style has one place to go wrong.

die() {
    echo "ERROR: $*" >&2
    exit 1
}

# Echo the BibTeX style name a journal's own upstream template prescribes, read
# from its `\bibliographystyle{...}` line. The pattern allows a leading `%*`:
# upstream comments that line out for authors to uncomment.
journal_bst() {
    local journal=$1
    local template="original/$journal/${journal}_template.tex"
    local style

    [ -f "$template" ] || die "missing $template (run: git submodule update --init --recursive)"

    style=$(sed -n '/^%*\\bibliographystyle{/{
        s/^%*\\bibliographystyle{\([A-Za-z0-9._-]*\)}.*/\1/p
        q
    }' "$template")

    [ -n "$style" ] || die "cannot determine the bibliography style from $template"
    printf '%s' "$style"
}

# Files a template.yml's files: list names, one per line (jtex copies exactly these)
template_files() {
    sed -n '/^files:/,/^[a-z]/{s/^  *- *\([^ ]*\) *$/\1/p;}' "$1"
}

# Keys cited in a .tex, sorted and unique: every \cite form, starred or with [pre][post]
# arguments (`\citep[e.g.][p. 2]{a, b}`), split at commas. Tested by scripts/check-plugins.sh.
cited_keys() {
    { grep -oE '\\cite[a-zA-Z]*\*?(\[[^]]*\])*\{[^}]*\}' "$1" || true; } |
        sed 's/.*{//; s/}//' | tr ',' '\n' | tr -d ' ' | { grep -v '^$' || true; } | sort -u
}

# Succeed when a myst build log shows the jtex render aborted (myst still exits 0)
render_aborted() {
    grep -qE 'Template render error|TypeError' "$1"
}

# Entry keys of a .bib, in file order
bib_keys() {
    { grep -oE '^@[a-zA-Z]+\{[^,]+' "$1" || true; } | sed 's/.*{//'
}
