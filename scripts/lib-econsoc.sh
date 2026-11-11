#!/usr/bin/env bash
#
# Shared helpers for the vendoring and build scripts.
#
# journal_bst lives here because both scripts need it, and a second copy would be
# a second place for the journal-to-style mapping to go wrong. Deriving it from
# upstream states the mapping in exactly one place; a duplicated derivation would
# lose that while appearing to keep it.

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

# Keys cited in a .tex, sorted and unique: every \cite form, starred or with [pre][post]
# arguments (`\citep[e.g.][p. 2]{a, b}`), split at commas. Tested by scripts/check-plugins.sh.
cited_keys() {
    { grep -oE '\\cite[a-zA-Z]*\*?(\[[^]]*\])*\{[^}]*\}' "$1" || true; } |
        sed 's/.*{//; s/}//' | tr ',' '\n' | tr -d ' ' | { grep -v '^$' || true; } | sort -u
}

# Entry keys of a .bib, in file order
bib_keys() {
    { grep -oE '^@[a-zA-Z]+\{[^,]+' "$1" || true; } | sed 's/.*{//'
}
