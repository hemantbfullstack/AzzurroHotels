#!/usr/bin/env python3
"""
Save Booking.com public review pages locally with a real browser.

You complete the bot check once (if shown). The script then opens each
hotel's public reviews UI, paginates, and saves HTML for local scraping.

Usage:
    python capture_pages.py
    python capture_pages.py --urls urls.txt --pages-dir ../data/saved_pages
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit

BLOCK_MARKERS = (
    "challenge-container",
    "awswafintegration",
    "are you a robot",
    "unusual traffic",
    "access denied",
)

NEXT_SELECTORS = [
    'a[aria-label="Next page"]',
    'button[aria-label="Next page"]',
    'a[aria-label="Next"]',
    'button[aria-label="Next"]',
    ".bui-pagination__next a",
    "a.bui-pagination__link--next",
    '[data-testid="pagination-next"]',
    'button:has-text("Next")',
    'a:has-text("Next")',
]


def parse_hotel_url(url: str):
    m = re.search(r"booking\.com/hotel/([a-z]{2})/([^/.?#]+)", url, re.I)
    return (m.group(1).lower(), m.group(2)) if m else None


def load_urls(path: Path) -> list[str]:
    urls = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and line not in urls:
            urls.append(line)
    return urls


def looks_blocked(html: str) -> bool:
    low = html.lower()
    if "page not found" in low and "c-review" not in low and 'data-testid="review-card"' not in low:
        return False  # handled separately as not-found
    if any(m in low for m in BLOCK_MARKERS) and "c-review" not in low and 'data-testid="review-card"' not in low:
        return True
    return False


def looks_not_found(html: str) -> bool:
    low = html.lower()
    return "page not found" in low or "we can't find that page" in low or "404" in (html[:2000].lower())


def has_review_cards(html: str) -> bool:
    low = html.lower()
    return (
        'data-testid="review-card"' in low
        or "review_list_new_item_block" in low
        or "c-review-block" in low
    )


def wait_until_public(page, timeout_s: int = 300, require_reviews: bool = False) -> bool:
    """Wait until challenge clears. User can solve in the window."""
    deadline = time.time() + timeout_s
    prompted = False
    while time.time() < deadline:
        html = page.content()
        if require_reviews and has_review_cards(html):
            return True
        if not require_reviews and (
            has_review_cards(html)
            or (
                not looks_blocked(html)
                and not looks_not_found(html)
                and ("hp__hotel-name" in html.lower() or "<h1" in html.lower() or "<h2" in html.lower())
            )
        ):
            return True
        if looks_blocked(html) and not prompted:
            print(
                "\n>>> Browser is showing a check / challenge page.\n"
                ">>> Complete it in the opened Chromium window.\n"
                ">>> This script will continue automatically once the page is public.\n"
            )
            prompted = True
        page.wait_for_timeout(1500)
    return False


def page_signature(html: str) -> str:
    titles = re.findall(
        r'data-testid="review-title"[^>]*>.*?<(?:/div|/span|/h[1-6])>|c-review-block__title[^>]*>([^<]+)',
        html,
        re.I | re.S,
    )
    scores = re.findall(r'bui-review-score__badge[^>]*>([^<]+)|data-testid="review-score"[^>]*>([^<]+)', html, re.I)
    return f"{len(html)}|{len(titles)}|{titles[:3]}|{scores[:3]}"


def click_first(page, selectors: list[str]) -> bool:
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            if not loc.is_visible():
                continue
            loc.click(timeout=5000)
            return True
        except Exception:
            continue
    return False


def open_reviews_ui(page, cc: str, slug: str, hotel_url: str, args) -> tuple[bool, str]:
    """Open the hotel's public reviews UI."""
    reviews_url = f"https://www.booking.com/reviews/{cc}/hotel/{slug}.html"
    print(f"  opening reviews page: {reviews_url}")
    page.goto(reviews_url, wait_until="domcontentloaded", timeout=args.timeout_ms)
    page.wait_for_timeout(args.settle_ms)
    html = page.content()
    if has_review_cards(html):
        return True, "reviews_url"
    if looks_not_found(html):
        print("  reviews URL not found; trying hotel page 'Read all reviews' button")
    else:
        if wait_until_public(page, args.challenge_timeout, require_reviews=True):
            return True, "reviews_url"
        if has_review_cards(page.content()):
            return True, "reviews_url"

    # Fallback: hotel page button / reviews tab.
    print(f"  reopening hotel page and clicking Read all reviews")
    page.goto(hotel_url, wait_until="domcontentloaded", timeout=args.timeout_ms)
    wait_until_public(page, args.challenge_timeout, require_reviews=False)
    clicked = click_first(
        page,
        [
            '[data-testid="review-score-read-all-actionable"]',
            '[data-testid="review-score-read-all"]',
            'button:has-text("Read all reviews")',
            'a:has-text("Read all reviews")',
            'a:has-text("See all reviews")',
            'button:has-text("Guest reviews")',
            '#show_reviews_tab',
            'a[href*="/reviews/"]',
        ],
    )
    if not clicked:
        # Last resort: hotel URL with reviews hash/query used by Booking UI.
        alt = f"{hotel_url.split('?')[0]}?activeTab=revs"
        print(f"  trying tab URL: {alt}")
        page.goto(alt, wait_until="domcontentloaded", timeout=args.timeout_ms)
    page.wait_for_timeout(args.settle_ms)
    if wait_until_public(page, min(args.challenge_timeout, 90), require_reviews=True):
        return True, "hotel_reviews_ui"
    return has_review_cards(page.content()), "hotel_reviews_ui"


def save_current_reviews(page, prop_dir: Path, page_no: int) -> Path:
    html = page.content()
    out_path = prop_dir / f"reviews_p{page_no:04d}.html"
    out_path.write_text(html, encoding="utf-8")
    return out_path


def go_next_reviews_page(page, page_no: int, rows: int, reviews_base: str | None) -> bool:
    """Prefer clicking Next; fall back to offset query on the reviews URL."""
    before = page_signature(page.content())
    if click_first(page, NEXT_SELECTORS):
        page.wait_for_timeout(1500)
        after = page_signature(page.content())
        return after != before

    # Query-param pagination on /reviews/... pages (when supported).
    if reviews_base:
        offset = page_no * rows
        parts = urlsplit(reviews_base)
        query = dict(
            offset=str(offset),
            rows=str(rows),
            sort="f_recent_desc",
        )
        next_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))
        page.goto(next_url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(1500)
        after = page_signature(page.content())
        return has_review_cards(page.content()) and after != before
    return False


def capture_property(page, url: str, pages_dir: Path, args) -> dict:
    parsed = parse_hotel_url(url)
    if not parsed:
        return {"url": url, "status": "INVALID_URL", "saved": 0, "note": "Not a Booking hotel URL"}
    cc, slug = parsed
    prop_dir = pages_dir / slug
    prop_dir.mkdir(parents=True, exist_ok=True)
    saved = 0
    note = ""

    try:
        print(f"\n=== {slug} ===")
        print(f"Opening hotel page: {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        if not wait_until_public(page, args.challenge_timeout):
            return {
                "url": url,
                "status": "BLOCKED",
                "saved": 0,
                "note": "Challenge did not clear in time; re-run capture and complete the check.",
            }

        html = page.content()
        (prop_dir / "property.html").write_text(html, encoding="utf-8")
        print("  saved property.html")

        ok, mode = open_reviews_ui(page, cc, slug, url, args)
        if not ok:
            return {
                "url": url,
                "status": "NO_REVIEWS_FOUND",
                "saved": 0,
                "note": "Could not open a public reviews page/UI with review cards.",
            }
        print(f"  reviews UI ready via {mode}")

        reviews_base = page.url if "/reviews/" in page.url else f"https://www.booking.com/reviews/{cc}/hotel/{slug}.html"
        prev_sig = None
        for page_no in range(1, args.max_pages + 1):
            page.wait_for_timeout(args.settle_ms)
            html = page.content()
            if looks_blocked(html):
                note = f"Blocked on review page {page_no}."
                return {"url": url, "status": "BLOCKED", "saved": saved, "note": note}
            if looks_not_found(html):
                note = f"Page not found on review page {page_no}."
                return {"url": url, "status": "NOT_FOUND", "saved": saved, "note": note}
            if not has_review_cards(html):
                if page_no == 1:
                    return {
                        "url": url,
                        "status": "NO_REVIEWS_FOUND",
                        "saved": saved,
                        "note": "Reviews UI opened but no review cards were recognised.",
                    }
                note = "No more review cards; pagination finished."
                break

            sig = page_signature(html)
            if sig == prev_sig:
                note = "Same page content repeated; pagination finished."
                break
            prev_sig = sig

            out_path = save_current_reviews(page, prop_dir, page_no)
            saved += 1
            print(f"  saved {out_path.name} ({page.url[:90]})")

            if page_no >= args.max_pages:
                note = f"Hit --max-pages ({args.max_pages})."
                break

            moved = go_next_reviews_page(page, page_no, args.rows, reviews_base)
            if not moved:
                note = "No next page control / end of reviews."
                break
            time.sleep(args.delay)

        status = "OK" if saved else "NO_REVIEWS_FOUND"
        return {"url": url, "status": status, "saved": saved, "note": note or f"Saved {saved} review page(s)."}
    except Exception as exc:  # noqa: BLE001
        return {"url": url, "status": "FAILED", "saved": saved, "note": f"{type(exc).__name__}: {exc}"}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--urls", default="urls.txt")
    ap.add_argument("--pages-dir", default="../data/saved_pages")
    ap.add_argument("--profile-dir", default="../.browser_profile")
    ap.add_argument("--max-pages", type=int, default=120)
    ap.add_argument("--rows", type=int, default=10)
    ap.add_argument("--delay", type=float, default=2.0)
    ap.add_argument("--lang", default="en-gb")
    ap.add_argument("--timeout-ms", type=int, default=60000)
    ap.add_argument("--challenge-timeout", type=int, default=300)
    ap.add_argument("--settle-ms", type=int, default=2500)
    ap.add_argument("--headed", action="store_true", default=True)
    ap.add_argument("--headless", action="store_true")
    args = ap.parse_args(argv)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Playwright is required for capture.\n"
            "  pip install playwright\n"
            "  playwright install chromium",
            file=sys.stderr,
        )
        return 2

    urls_path = Path(args.urls)
    if not urls_path.exists():
        print(f"URL file not found: {urls_path}", file=sys.stderr)
        return 2
    urls = load_urls(urls_path)
    if not urls:
        print("No URLs in file.", file=sys.stderr)
        return 2

    pages_dir = Path(args.pages_dir)
    profile_dir = Path(args.profile_dir)
    pages_dir.mkdir(parents=True, exist_ok=True)
    profile_dir.mkdir(parents=True, exist_ok=True)

    headless = bool(args.headless)
    print(f"Saving pages to: {pages_dir.resolve()}")
    print(f"Browser profile: {profile_dir.resolve()}")
    print(f"Mode: {'headless' if headless else 'headed (complete any check in the window)'}")
    print(f"Properties: {len(urls)}")

    results = []
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=headless,
            viewport={"width": 1365, "height": 900},
            locale=args.lang,
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            args=["--disable-blink-features=AutomationControlled"],
        )
        try:
            # Reuse one tab — opening many tabs was crashing the context.
            page = context.pages[0] if context.pages else context.new_page()
            for url in urls:
                results.append(capture_property(page, url, pages_dir, args))
        finally:
            context.close()

    print("\n" + "=" * 72)
    print("CAPTURE SUMMARY")
    print("=" * 72)
    total_saved = 0
    for r in results:
        total_saved += r["saved"]
        print(f"[{r['status']}] {r['url']}")
        print(f"    saved review pages: {r['saved']}")
        if r.get("note"):
            print(f"    note: {r['note']}")
    print(f"\nTotal review HTML pages saved: {total_saved}")
    print("Next: python run.py local")
    print("=" * 72)
    return 0 if total_saved else 1


if __name__ == "__main__":
    raise SystemExit(main())
