#!/usr/bin/env python3
"""
Azzurro Hotels review collector.

Working flow:
  1) capture  — browser opens each hotel, paginates public reviews, saves HTML
  2) local    — parse saved HTML into output/reviews.*

Commands:
  python run.py capture
  python run.py local
  python run.py all      # capture then local (default)
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = ROOT / "files"
OUT = ROOT / "output"
URLS = FILES / "urls.txt"
PAGES = ROOT / "data" / "saved_pages"
PROFILE = ROOT / ".browser_profile"


def _run_path(script: Path, argv: list[str]) -> None:
    sys.argv = [str(script), *argv]
    runpy.run_path(str(script), run_name="__main__")


def cmd_capture(extra: list[str]) -> int:
    PAGES.mkdir(parents=True, exist_ok=True)
    argv = [
        "--urls",
        str(URLS),
        "--pages-dir",
        str(PAGES),
        "--profile-dir",
        str(PROFILE),
        *extra,
    ]
    _run_path(FILES / "capture_pages.py", argv)
    return 0


def cmd_local(extra: list[str]) -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    argv = [
        "--urls",
        str(URLS),
        "--db",
        str(OUT / "reviews.db"),
        "--out",
        str(OUT),
        "--local-dir",
        str(PAGES),
        *extra,
    ]
    _run_path(FILES / "scrape_reviews.py", argv)
    return 0


def main() -> int:
    if not URLS.exists():
        print(f"Missing URL file: {URLS}", file=sys.stderr)
        return 2

    args = sys.argv[1:]
    cmd = "all"
    if args and args[0] in {"capture", "local", "all", "help", "-h", "--help"}:
        cmd = args[0]
        extra = args[1:]
    else:
        extra = args

    if cmd in {"help", "-h", "--help"}:
        print(__doc__)
        return 0
    if cmd == "capture":
        return cmd_capture(extra)
    if cmd == "local":
        return cmd_local(extra)
    if cmd == "all":
        print("Step 1/2: capturing review pages in browser...")
        code = cmd_capture(extra)
        print("\nStep 2/2: scraping saved local pages...")
        code2 = cmd_local([])
        return code2 or code

    print(f"Unknown command: {cmd}", file=sys.stderr)
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
