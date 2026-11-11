#!/usr/bin/env bash
# Self-test for scripts/sync-vendored.sh: each mutation of a scratch copy must make `--check`
# FAIL with the diagnostic naming its reason, since a script that always exits 1 would pass an
# exit-code test. The unmutated copy must pass.
#
#   scripts/selftest-sync-vendored.sh

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
REPO=$PWD

# No `set -e`: each case must run on after a failed --check. Setup failures call die() instead.
# shellcheck source=scripts/lib-econsoc.sh
. "$REPO/scripts/lib-econsoc.sh"

pass=0
fail=0

# Build a disposable copy of everything sync-vendored.sh reads, from the real submodule
# files: a fixture could drift from upstream.
make_scratch() {
    local dir
    dir=$(mktemp -d)

    mkdir -p "$dir/scripts" "$dir/original"
    cp "$REPO/scripts/sync-vendored.sh" "$dir/scripts/"
    cp "$REPO/scripts/lib-econsoc.sh" "$dir/scripts/"
    cp "$REPO/template.yml" "$dir/"
    cp "$REPO"/*.bst "$REPO"/econsocart.cls "$REPO"/econsocart.cfg "$dir/"

    # A seeding failure must stop the harness: otherwise every case fails for a reason
    # unrelated to its mutation.
    local journal
    for journal in ecta qe te; do
        mkdir -p "$dir/original/$journal"
        cp "$REPO/original/$journal"/*.bst \
           "$REPO/original/$journal"/econsocart.cls \
           "$REPO/original/$journal"/econsocart.cfg \
           "$REPO/original/$journal/${journal}_template.tex" \
           "$dir/original/$journal/" \
           || die "could not seed the scratch tree from original/$journal (run: git submodule update --init --recursive)"
    done

    printf '%s' "$dir"
}

# <name> <expected message substring> <mutation function>
check() {
    local name=$1 expect=$2 mutate=$3
    local dir out rc

    # make_scratch runs in a command substitution, whose die() exits only that subshell.
    if ! dir=$(make_scratch); then
        die "scratch setup failed for '$name' (diagnostic above); the harness cannot trust any result"
    fi
    ( cd "$dir" && "$mutate" )

    out=$(cd "$dir" && ./scripts/sync-vendored.sh --check 2>&1)
    rc=$?
    rm -rf "$dir"

    if [ "$rc" -eq 0 ]; then
        printf 'FAIL  %-34s exited 0; the guard did not fire\n' "$name"
        fail=$((fail + 1))
        return
    fi

    if ! printf '%s' "$out" | grep -qF "$expect"; then
        printf 'FAIL  %-34s exited %d but never said "%s"\n' "$name" "$rc" "$expect"
        printf '%s\n' "$out" | sed 's/^/        /' | head -4
        fail=$((fail + 1))
        return
    fi

    printf 'ok    %-34s exit %d, reported: %s\n' "$name" "$rc" "$expect"
    pass=$((pass + 1))
}

mutate_root_drift()      { echo '% drift' >> econsocart.cls; }
mutate_unparseable()     { sed -i 's/^\\ProvidesClass{econsocart}.*/\\ProvidesClass{econsocart}/' original/ecta/econsocart.cls; }
mutate_missing_file()    { rm -f original/te/econsocart.cls; }
mutate_tie_differs()     {
    # Make ecta and qe tie on the newest date with differing content.
    sed -i 's#\[2025/03/07#[2026/02/12#' original/qe/econsocart.cls
    echo '% divergent' >> original/qe/econsocart.cls
}
mutate_cfg_superseded()  { sed -i 's#\[2025/10/14#[2099/01/01#' original/qe/econsocart.cfg; }
mutate_style_collision() { sed -i 's/%\\bibliographystyle{te}/%\\bibliographystyle{qe}/' original/te/te_template.tex; cp original/qe/qe.bst original/te/qe.bst; }
mutate_yml_mismatch()    { sed -i '/^  - te\.bst$/d' template.yml; }

echo "Self-testing scripts/sync-vendored.sh --check"
echo

check "root file drifted"          "DRIFT"                            mutate_root_drift
check "version date unparseable"   "cannot parse a version date"      mutate_unparseable
check "submodule file missing"     "missing original/te"              mutate_missing_file
check "newest date tie, differing" "resolve by hand"                  mutate_tie_differs
check "config superseded upstream" "release trains have diverged"     mutate_cfg_superseded
check "two journals, one style"    "silently overwrite"               mutate_style_collision
check "template.yml out of step"   "does not match the styles"        mutate_yml_mismatch

echo
printf '%d passed, %d failed\n' "$pass" "$fail"

# The unmutated repository must pass, or a guard that always fails would pass every case above.
if ! ./scripts/sync-vendored.sh --check >/dev/null 2>&1; then
    echo "FAIL  the unmutated repository does not pass --check" >&2
    fail=$((fail + 1))
else
    echo "ok    the unmutated repository still passes"
fi

[ "$fail" -eq 0 ]
