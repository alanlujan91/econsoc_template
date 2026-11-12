#!/usr/bin/env python3
"""Measure how close each generated sample .tex is to the upstream sample it reproduces.

The template's goal is that a paper written in MyST emits nearly the LaTeX its authors would
have written by hand. For each journal this compares the exported article and supplement
against ``original/<journal>/<journal>[_supp]_sample.tex``, token by token with comments
dropped, and fails when a similarity falls below the floor committed in
``scripts/fidelity-floors.json``. ``--update`` raises the floors to the current scores and
refuses to lower one, so the floors only ratchet up. ``--explain`` lists the largest
differing blocks. Run after ``scripts/build-samples.sh``.
"""

from __future__ import annotations

import argparse
import difflib
import json
import logging
import re
import signal
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
FLOORS = REPO / "scripts" / "fidelity-floors.json"
JOURNALS = ("qe", "ecta", "te")
DOCUMENTS = {"article": "sample", "supplement": "supp_sample"}
COMMENT = re.compile(r"(?<!\\)%.*")
# A MyST paper keeps its references in a .bib. The metric drops the upstream sample's
# hand-written thebibliography and the export's BibTeX input (the plugin's filecontents*
# copy of the paper's entries, and the \bibliography call) from both sides.
BIBLIOGRAPHY = re.compile(
    r"\\begin\{thebibliography\}.*?\\end\{thebibliography\}"
    r"|\\begin\{filecontents\*\}.*?\\end\{filecontents\*\}\s*\\gdef\\econsocbibliography\{[^}]*\}"
    r"|\\providecommand\{\\econsocbibliography\}.*?\\fi\b",
    re.DOTALL,
)
TOKEN = re.compile(r"\\[A-Za-z@]+\*?|\\.|[A-Za-z0-9]+|\S")

log = logging.getLogger("fidelity")


def tokens(text: str) -> list[str]:
    """Split LaTeX into macro, word and symbol tokens, comments and bibliography dropped."""
    return TOKEN.findall(BIBLIOGRAPHY.sub("", COMMENT.sub("", text)))


def similarity(a: list[str], b: list[str]) -> difflib.SequenceMatcher[str]:
    return difflib.SequenceMatcher(None, a, b, autojunk=False)


def pairs() -> dict[str, tuple[Path, Path]]:
    """Map each export name to (upstream sample, generated .tex)."""
    out = {}
    for journal in JOURNALS:
        for doc, suffix in DOCUMENTS.items():
            name = f"{doc}_{journal}"
            upstream = REPO / "original" / journal / f"{journal}_{suffix}.tex"
            generated = REPO / "sample" / "exports" / f"{name}_pdf_tex" / f"{name}.tex"
            out[name] = (upstream, generated)
    return out


def read(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else ""
    if not text.strip():
        raise SystemExit(
            f"ERROR: {path} is missing or empty (run scripts/build-samples.sh first)"
        )
    return text


def explain(a: list[str], b: list[str], count: int = 8) -> None:
    ops = [op for op in similarity(a, b).get_opcodes() if op[0] != "equal"]
    ops.sort(key=lambda op: (op[1] - op[2]) + (op[3] - op[4]))
    for tag, i1, i2, j1, j2 in ops[:count]:
        log.info("    %-7s -%d +%d", tag, i2 - i1, j2 - j1)
        log.info("      upstream:  %s", " ".join(a[i1 : min(i2, i1 + 16)])[:90])
        log.info("      generated: %s", " ".join(b[j1 : min(j2, j1 + 16)])[:90])


def scores(show: bool) -> dict[str, float]:
    out = {}
    for name, (upstream, generated) in pairs().items():
        a, b = tokens(read(upstream)), tokens(read(generated))
        out[name] = round(similarity(a, b).ratio(), 3)
        log.info("%-16s %.3f  (%s)", name, out[name], upstream.relative_to(REPO))
        if show:
            explain(a, b)
    return out


def self_test() -> int:
    """The metric must score a text against itself 1 and a damaged copy strictly lower."""
    full = tokens(read(pairs()["article_qe"][0]))
    whole = similarity(full, full).ratio()
    half = similarity(full, full[: len(full) // 2]).ratio()
    if whole != 1.0 or not half < 0.9:
        log.error("self-test failed: identical %.3f, half-truncated %.3f", whole, half)
        return 1
    if "\\bibitem" in full or "\\bibliography" in tokens(
        read(pairs()["article_qe"][1])
    ):
        log.error("self-test failed: a bibliography block survived tokenizing")
        return 1
    log.info("self-test: identical 1.000, half-truncated %.3f", half)
    return 0


def check(current: dict[str, float], floors: dict[str, float]) -> int:
    missing = sorted(set(current) - set(floors))
    below = {
        n: (s, floors[n]) for n, s in current.items() if n in floors and s < floors[n]
    }
    for name in missing:
        log.error("%s has no floor in %s; run with --update", name, FLOORS.name)
    for name, (score, floor) in below.items():
        log.error(
            "%s fell to %.3f, below its floor %.3f: the emitted LaTeX moved away from "
            "the upstream sample (--explain shows where)",
            name,
            score,
            floor,
        )
    if missing or below:
        return 1
    log.info("OK: every export at or above its committed floor")
    return 0


def update(current: dict[str, float], floors: dict[str, float]) -> int:
    lower = {n: s for n, s in current.items() if s < floors.get(n, 0.0)}
    if lower:
        log.error(
            "refusing to lower a floor: %s",
            ", ".join(f"{n} {s:.3f}" for n, s in lower.items()),
        )
        return 1
    FLOORS.write_text(
        json.dumps(current, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    log.info("wrote %s", FLOORS.relative_to(REPO))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--update", action="store_true", help="raise the floors to the current scores"
    )
    mode.add_argument(
        "--self-test", action="store_true", help="check the metric itself"
    )
    parser.add_argument(
        "--explain", action="store_true", help="list the largest differing blocks"
    )
    args = parser.parse_args()
    signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # quiet exit when piped into head
    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
    if args.self_test:
        return self_test()
    current = scores(args.explain)
    floors = json.loads(FLOORS.read_text(encoding="utf-8")) if FLOORS.is_file() else {}
    return update(current, floors) if args.update else check(current, floors)


if __name__ == "__main__":
    sys.exit(main())
