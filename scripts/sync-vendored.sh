#!/usr/bin/env bash
# Sync the vendored Econometric Society files from the pinned original/* submodules. The shared
# econsocart.cls/.cfg pair comes from whichever submodule has the newest \ProvidesClass date;
# each .bst comes from its own journal, under the style name that journal's template prescribes.
#
#   scripts/sync-vendored.sh           copy the correct sources to the repo root
#   scripts/sync-vendored.sh --check   verify the root copies match (CI drift guard)

set -euo pipefail

cd "$(dirname "$0")/.."

# Submodules to consider when choosing the newest shared class/cfg.
JOURNALS=(ecta qe te)

mode=${1:-sync}
if [ "$mode" != "sync" ] && [ "$mode" != "--check" ]; then
    echo "usage: $0 [--check]" >&2
    exit 2
fi

status=0

# shellcheck source=scripts/lib-econsoc.sh
. "$(dirname "$0")/lib-econsoc.sh"

# Extract the LaTeX file date (YYYY/MM/DD) from a \Provides... declaration; zero-padded, so string
# comparison orders releases. Quit at the first match: `| head -1` under pipefail can SIGPIPE sed
# and fail the assignment with no message.
provides_date() {
    sed -n '/^\\Provides[A-Za-z]*{econsocart/{
        s/^[^[]*\[\([0-9]\{4\}\/[0-9]\{2\}\/[0-9]\{2\}\).*/\1/p
        q
    }' "$1"
}

# Echo "<submodule> <date>" for whichever journal has the newest copy of a shared file.
# Die if two submodules claim that date with different content: upstream released divergent files.
newest_source() {
    local relname=$1
    local best="" best_date="" journal file date

    # Pass 1: find the newest date only. Comparing content here would abort on a tie
    # that a later journal beats, purely because of iteration order.
    for journal in "${JOURNALS[@]}"; do
        file="original/$journal/$relname"
        [ -f "$file" ] || die "missing $file (run: git submodule update --init --recursive)"

        date=$(provides_date "$file")
        [ -n "$date" ] || die "cannot parse a version date from $file"

        if [ -z "$best_date" ] || [[ "$date" > "$best_date" ]]; then
            best=$journal
            best_date=$date
        fi
    done

    # Pass 2: everything tied at the WINNING date must agree byte for byte.
    # A real tie there means upstream released divergent files under one version,
    # and there is no defensible way to choose between them.
    for journal in "${JOURNALS[@]}"; do
        if [ "$journal" = "$best" ]; then
            continue
        fi

        file="original/$journal/$relname"
        date=$(provides_date "$file")

        if [ "$date" = "$best_date" ] && ! diff -q "original/$best/$relname" "$file" >/dev/null; then
            die "$relname: $best and $journal are both dated $best_date but differ; resolve by hand"
        fi
    done

    printf '%s %s' "$best" "$best_date"
}

# Copy (or, in --check mode, verify) one vendored file against its source.
sync_one() {
    local root=$1 submodule=$2 label=$3
    local src="original/$submodule/$root"

    [ -f "$src" ] || die "missing $src (run: git submodule update --init --recursive)"

    if [ "$mode" = "--check" ]; then
        if diff -q "$src" "$root" >/dev/null 2>&1; then
            printf 'OK     %-16s <- original/%-4s  (%s)\n' "$root" "$submodule" "$label"
        else
            printf 'DRIFT  %-16s != original/%-4s  (%s)\n' "$root" "$submodule" "$label"
            diff "$src" "$root" || true
            status=1
        fi
    else
        cp "$src" "$root"
        printf 'synced %-16s <- original/%-4s  (%s)\n' "$root" "$submodule" "$label"
    fi
}

# Both shared files come from ONE submodule: upstream releases them together, so picking each
# independently could pair a class and config never released together. Assign before `read`:
# `read <<<"$(...)"` takes read's status, so a die() inside newest_source would not stop the script.
selection=$(newest_source econsocart.cls)
read -r shared_submodule shared_date <<<"$selection"
if [ -z "$shared_submodule" ] || [ -z "$shared_date" ]; then
    die "could not determine the newest source for econsocart.cls"
fi

# Taking the pair from one journal must not silently vendor a config that another
# journal has already superseded. If that happens the release trains have
# diverged and a human has to decide which pairing to trust.
chosen_cfg_date=$(provides_date "original/$shared_submodule/econsocart.cfg")
[ -n "$chosen_cfg_date" ] || die "cannot parse a version date from original/$shared_submodule/econsocart.cfg"

for journal in "${JOURNALS[@]}"; do
    if [ "$journal" = "$shared_submodule" ]; then
        continue
    fi

    other_cfg_date=$(provides_date "original/$journal/econsocart.cfg")
    if [[ "$other_cfg_date" > "$chosen_cfg_date" ]]; then
        conflict="econsocart.cfg: $journal ships $other_cfg_date, newer than $shared_submodule's $chosen_cfg_date, while the class is newest in $shared_submodule.
       The release trains have diverged: taking the pair from $shared_submodule ships a config upstream has already superseded, and taking $journal's config pairs it with a class it was never released against. Decide which pairing to trust, then pin the submodules accordingly."

        # Hard-fail only when CHECKING: in sync mode the scheduled job must still open a
        # pull request stating this warning, since nobody watches a red scheduled run.
        if [ "$mode" = "--check" ]; then
            die "$conflict"
        fi

        echo "WARNING: $conflict" >&2
    fi
done

managed=(econsocart.cls econsocart.cfg)

sync_one econsocart.cls "$shared_submodule" "newest class, dated $shared_date"
sync_one econsocart.cfg "$shared_submodule" "paired with the class from the same release"

# Each journal's style is read from its OWN upstream template, never from a table kept here:
# --check would re-derive its expectation from that same table, so a swapped entry would copy
# the wrong .bst and still pass.
declare -A style_owner=()
for journal in "${JOURNALS[@]}"; do
    style=$(journal_bst "$journal")

    # Two journals resolving to the same filename would make the second copy
    # overwrite the first, and would orphan the overwritten journal's .bst at the repo root:
    # still present, no longer in `managed`, so never checked again.
    if [ -n "${style_owner[$style]:-}" ]; then
        die "$style.bst: both ${style_owner[$style]} and $journal declare bibliographystyle{$style}; one would silently overwrite the other"
    fi
    style_owner[$style]=$journal

    sync_one "$style.bst" "$journal" "bibliography style declared by $journal upstream"
    managed+=("$style.bst")
done

# jtex copies exactly what template.yml lists, so the derived styles must equal the listed
# ones: jtex never copies a derived style missing there, and nothing checks a listed style
# no longer derived.
listed_bst=$(template_files template.yml | { grep '\.bst$' || true; } | sort)
derived_bst=$(printf '%s\n' "${managed[@]}" | grep '\.bst$' | sort)

if [ "$listed_bst" != "$derived_bst" ]; then
    echo "ERROR: template.yml files: does not match the styles declared upstream" >&2
    echo "  template.yml lists : $(printf '%s' "$listed_bst" | tr '\n' ' ')" >&2
    echo "  upstream declares  : $(printf '%s' "$derived_bst" | tr '\n' ' ')" >&2
    echo "  Update the files: list in template.yml, or jtex will copy the wrong set." >&2
    status=1
fi

# Report any root .bst no journal declares: after an upstream rename the old file remains at the
# root, outside `managed`, so nothing would ever mention it again.
shopt -s nullglob
for bst in ./*.bst; do
    bst=${bst#./}
    case " ${managed[*]} " in
        *" $bst "*) continue ;;
    esac

    echo "note: $bst is not declared by any journal upstream; it is no longer synced or checked." >&2
    echo "      If an upstream style was renamed, this is the superseded file and can be deleted." >&2
done
shopt -u nullglob

if [ "$mode" = "--check" ]; then
    if [ "$status" -eq 0 ]; then
        echo "All vendored files match the pinned submodules."
    else
        echo "Re-sync with: scripts/sync-vendored.sh" >&2
    fi
fi

exit "$status"
