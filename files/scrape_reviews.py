#!/usr/bin/env python3
"""
Parse locally saved Booking.com review HTML pages into a dataset.

Usage (from project root):
    python run.py local

Or directly:
    python scrape_reviews.py --urls urls.txt --local-dir ../data/saved_pages --out ../output

HTML pages are produced by capture_pages.py (browser crawl + save).
This script only reads those files, deduplicates reviews, and exports CSV/JSON/SQLite.
"""
import argparse
import csv
import hashlib
import json
import logging
import re
import sqlite3
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

FIELDS = [
    "review_key", "property_slug", "property_name", "source_url", "review_title",
    "rating", "review_date", "review_date_raw", "stay_date", "reviewer_name",
    "reviewer_country", "room_type", "traveler_type", "nights", "positive_text",
    "negative_text", "review_text", "owner_response", "first_seen_at", "last_seen_at",
]
COVERAGE_FIELDS = [
    "rating", "review_date", "review_title", "reviewer_name", "reviewer_country",
    "room_type", "traveler_type", "stay_date", "positive_text", "negative_text",
    "owner_response",
]
log = logging.getLogger("collector")


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def norm(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def parse_date(raw):
    """Return ISO date (YYYY-MM-DD), or YYYY-MM for month-only values, else None."""
    raw = norm(raw)
    if not raw:
        return None
    pats = [
        (r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", "dmy"),
        (r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", "mdy"),
        (r"([A-Za-z]+)\s+(\d{4})", "my"),
    ]
    for pat, kind in pats:
        m = re.search(pat, raw)
        if not m:
            continue
        g = m.groups()
        if kind == "dmy":
            d, mon, y = g
        elif kind == "mdy":
            mon, d, y = g
        else:
            mon, y = g
            d = "1"
        for fmt in ("%d %B %Y", "%d %b %Y"):
            try:
                dt = datetime.strptime(f"{d} {mon} {y}", fmt)
                return dt.strftime("%Y-%m") if kind == "my" else dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None


def parse_hotel_url(url):
    m = re.search(r"booking\.com/hotel/([a-z]{2})/([^/.?#]+)", url, re.I)
    return (m.group(1).lower(), m.group(2)) if m else None


def make_key(slug, r):
    basis = "|".join(
        norm(str(x)).lower()
        for x in (
            slug,
            r.get("reviewer_name"),
            r.get("reviewer_country"),
            r.get("review_date") or r.get("review_date_raw"),
            r.get("review_title"),
            r.get("positive_text"),
            r.get("negative_text"),
            r.get("review_text"),
        )
    )
    return hashlib.sha256(basis.encode()).hexdigest()[:32]


def pick(node, selectors):
    """First non-empty text for any selector (tolerant to markup changes)."""
    for sel in selectors:
        try:
            el = node.select_one(sel)
        except Exception:
            continue
        if el and norm(el.get_text(" ")):
            return norm(el.get_text(" "))
    return None


def parse_reviews(html):
    soup = BeautifulSoup(html, "html.parser")
    cards = (
        soup.select('[data-testid="review-card"]')
        or soup.select("li.review_list_new_item_block")
        or soup.select("div.c-review-block")
    )
    out = []
    for c in cards:
        r = {}
        score = pick(c, ['[data-testid="review-score"]', ".bui-review-score__badge"])
        m = re.search(r"\d+(?:[.,]\d+)?", score or "")
        r["rating"] = float(m.group().replace(",", ".")) if m else None
        r["review_title"] = pick(c, ['[data-testid="review-title"]', ".c-review-block__title"])
        r["review_date_raw"] = pick(c, ['[data-testid="review-date"]', ".c-review-block__date"])
        r["review_date"] = parse_date(re.sub(r"^\s*Reviewed:?", "", r["review_date_raw"] or ""))
        stay_raw = pick(c, ['[data-testid="review-stay-date"]', ".c-review-block__stay-date"])
        r["stay_date"] = parse_date(stay_raw)
        r["reviewer_name"] = pick(
            c, ['[data-testid="review-avatar"] .a3332d346a', ".bui-avatar-block__title"]
        )
        r["reviewer_country"] = pick(
            c, ['[data-testid="review-avatar"] .afac1f68d9', ".bui-avatar-block__subtitle"]
        )
        if not r["reviewer_name"]:
            av = c.select_one('[data-testid="review-avatar"]')
            if av:
                lines = [norm(x) for x in av.get_text("\n").split("\n") if norm(x)]
                r["reviewer_name"] = lines[0] if lines else None
                r["reviewer_country"] = r["reviewer_country"] or (
                    lines[1] if len(lines) > 1 else None
                )
        r["room_type"] = pick(c, ['[data-testid="review-room-name"]', ".c-review-block__room-link"])
        r["traveler_type"] = pick(
            c, ['[data-testid="review-traveler-type"]', ".review-panel-wide__traveller_type"]
        )
        r["nights"] = pick(c, ['[data-testid="review-num-nights"]'])
        r["owner_response"] = pick(
            c, ['[data-testid="review-response"]', ".c-review-block__response"]
        )
        pos = pick(c, ['[data-testid="review-positive-text"]'])
        neg = pick(c, ['[data-testid="review-negative-text"]'])
        if pos is None and neg is None:
            for row in c.select(".c-review__row"):
                body = pick(row, [".c-review__body"])
                if not body:
                    continue
                if row.select_one('[class*="review_great"]'):
                    pos = body
                elif row.select_one('[class*="review_poor"]'):
                    neg = body
                elif pos is None and neg is None:
                    pos = body
        r["positive_text"], r["negative_text"] = pos, neg
        r["review_text"] = " ".join(x for x in (pos, neg) if x) or None
        if not any((r["rating"], r["review_text"], r["review_title"])):
            continue
        out.append(r)
    return out, len(cards)


def parse_property(html):
    """Property name/address/overall rating from the hotel page (JSON-LD, then <h2>)."""
    soup = BeautifulSoup(html, "html.parser")
    meta = {}
    for tag in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(tag.string or "")
        except Exception:
            continue
        for d in (data if isinstance(data, list) else [data]):
            if isinstance(d, dict) and d.get("@type") in (
                "Hotel",
                "LodgingBusiness",
                "Hostel",
                "Resort",
            ):
                meta["name"] = d.get("name")
                addr = d.get("address") or {}
                meta["address"] = addr.get("streetAddress") if isinstance(addr, dict) else None
                agg = d.get("aggregateRating") or {}
                meta["overall_rating"] = agg.get("ratingValue")
                meta["review_count"] = agg.get("reviewCount")
    if not meta.get("name"):
        h = soup.select_one("h2.pp-header__title, h2")
        meta["name"] = norm(h.get_text()) if h else None
    return meta


class Store:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute(
            f"""CREATE TABLE IF NOT EXISTS reviews (
            review_key TEXT PRIMARY KEY, property_slug TEXT, property_name TEXT, source_url TEXT,
            review_title TEXT, rating REAL, review_date TEXT, review_date_raw TEXT, stay_date TEXT,
            reviewer_name TEXT, reviewer_country TEXT, room_type TEXT, traveler_type TEXT,
            nights TEXT, positive_text TEXT, negative_text TEXT, review_text TEXT,
            owner_response TEXT, first_seen_at TEXT, last_seen_at TEXT)"""
        )
        self.db.commit()

    def known(self, key):
        return (
            self.db.execute("SELECT 1 FROM reviews WHERE review_key=?", (key,)).fetchone()
            is not None
        )

    def upsert(self, rec):
        """True if new, False if duplicate (duplicates only get last_seen_at refreshed)."""
        if self.known(rec["review_key"]):
            self.db.execute(
                "UPDATE reviews SET last_seen_at=? WHERE review_key=?",
                (rec["last_seen_at"], rec["review_key"]),
            )
            return False
        self.db.execute(
            f"INSERT INTO reviews ({','.join(FIELDS)}) VALUES ({','.join('?' * len(FIELDS))})",
            [rec.get(f) for f in FIELDS],
        )
        return True

    def commit(self):
        self.db.commit()

    def rows(self):
        cur = self.db.execute(
            "SELECT * FROM reviews ORDER BY property_slug, review_date DESC"
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    def coverage(self, slug):
        total = self.db.execute(
            "SELECT COUNT(*) FROM reviews WHERE property_slug=?", (slug,)
        ).fetchone()[0]
        cov = {}
        for f in COVERAGE_FIELDS:
            n = self.db.execute(
                f"SELECT COUNT(*) FROM reviews WHERE property_slug=? "
                f"AND {f} IS NOT NULL AND {f}!=''",
                (slug,),
            ).fetchone()[0]
            cov[f] = n
        return total, cov

    def export(self, folder):
        rows = self.rows()
        with open(folder / "reviews.csv", "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.DictWriter(fh, fieldnames=FIELDS)
            w.writeheader()
            w.writerows(rows)
        (folder / "reviews.json").write_text(
            json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        return len(rows)


@dataclass
class Result:
    url: str
    slug: str = ""
    property_name: str = ""
    status: str = "OK"
    pages: int = 0
    found: int = 0
    new: int = 0
    duplicates: int = 0
    notes: list = field(default_factory=list)


def collect_local(url, store, pages_dir):
    """Parse previously saved review HTML for one hotel URL."""
    res = Result(url)
    parsed = parse_hotel_url(url)
    if not parsed:
        res.status = "INVALID_URL"
        res.notes.append("Not a Booking.com /hotel/<cc>/<name>.html URL.")
        return res
    _cc, slug = parsed
    res.slug = res.property_name = slug
    prop_dir = Path(pages_dir) / slug
    if not prop_dir.exists():
        res.status = "NOT_FOUND"
        res.notes.append(f"No saved pages folder: {prop_dir}")
        return res

    property_html = prop_dir / "property.html"
    if property_html.exists():
        meta = parse_property(property_html.read_text(encoding="utf-8", errors="replace"))
        res.property_name = meta.get("name") or slug

    files = sorted(prop_dir.glob("reviews_p*.html"))
    if not files:
        files = sorted(p for p in prop_dir.glob("*.html") if p.name != "property.html")
    if not files:
        res.status = "NO_REVIEWS_FOUND"
        res.notes.append(f"No saved review HTML files in {prop_dir}")
        return res

    for html_path in files:
        html = html_path.read_text(encoding="utf-8", errors="replace")
        reviews, n_cards = parse_reviews(html)
        if not reviews:
            res.notes.append(
                f"{html_path.name}: no review cards recognised ({n_cards} raw cards)."
            )
            continue
        res.pages += 1
        page_new = 0
        for rv in reviews:
            rv.update(
                property_slug=slug, property_name=res.property_name, source_url=url
            )
            rv["review_key"] = make_key(slug, rv)
            rv["first_seen_at"] = rv["last_seen_at"] = now()
            res.found += 1
            if store.upsert(rv):
                res.new += 1
                page_new += 1
            else:
                res.duplicates += 1
        store.commit()
        log.info("%s %s: %d reviews, %d new", slug, html_path.name, len(reviews), page_new)

    if res.found:
        res.status = "OK"
    else:
        res.status = "NO_REVIEWS_FOUND"
        res.notes.append("Saved pages present but no reviews could be parsed.")
    return res


def build_report(results, store, mode):
    L = ["", "=" * 72, f"REVIEW COLLECTION SUMMARY  ({mode} mode, {now()})", "=" * 72]
    ok = [r for r in results if r.status in ("OK", "PARTIAL") and r.found]
    bad = [r for r in results if r not in ok]
    L.append(
        f"New reviews added: {sum(r.new for r in results)}   "
        f"Duplicates skipped: {sum(r.duplicates for r in results)}   "
        f"URLs collected: {len(ok)}/{len(results)}"
    )
    L.append("")
    L.append("COLLECTED")
    for r in ok:
        total, cov = store.coverage(r.slug)
        have = [f for f, n in cov.items() if total and n / total >= 0.5]
        miss = [f for f in COVERAGE_FIELDS if f not in have]
        L.append(f" [{r.status}] {r.property_name}  ({r.url})")
        L.append(
            f"     pages: {r.pages} | found this run: {r.found} | new: {r.new} | "
            f"duplicates: {r.duplicates} | total in dataset: {total}"
        )
        L.append(
            "     fields collected: "
            + ", ".join(f"{f} ({cov[f]}/{total})" for f in have)
        )
        if miss:
            L.append("     fields mostly empty/not available: " + ", ".join(miss))
        for n in r.notes:
            L.append(f"     note: {n}")
    L.append("")
    L.append("NOT COLLECTED")
    if not bad:
        L.append(" (none)")
    meaning = {
        "NOT_FOUND": "saved pages folder missing",
        "FAILED": "unexpected error while parsing local HTML",
        "INVALID_URL": "not a valid Booking.com hotel URL",
        "NO_REVIEWS_FOUND": "saved pages present but no reviews recognised",
        "PARTIAL": "partial, no reviews retrieved",
    }
    for r in bad:
        L.append(f" [{r.status}] {r.url} - {meaning.get(r.status, r.status)}")
        for n in r.notes:
            L.append(f"     note: {n}")
    L += [
        "",
        "Always NOT collected: reviewer profile links, photos, helpful votes, reviews that "
        "Booking.com does not show publicly, and category subscores.",
        "Outputs: reviews.db, reviews.csv, reviews.json, run_report.txt, collector.log",
        "=" * 72,
    ]
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--urls", default="urls.txt")
    ap.add_argument("--db", default="reviews.db")
    ap.add_argument("--out", default=".", help="folder for exports/report")
    ap.add_argument(
        "--local-dir",
        required=True,
        help="folder of saved HTML from capture_pages.py (data/saved_pages)",
    )
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(out / "collector.log", encoding="utf-8"),
            logging.StreamHandler(sys.stderr),
        ],
    )

    p = Path(args.urls)
    if not p.exists():
        sys.exit(f"URL file not found: {p}")
    urls = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and line not in urls:
            urls.append(line)
    if not urls:
        sys.exit("No URLs in file.")

    local_dir = Path(args.local_dir)
    if not local_dir.exists():
        sys.exit(f"Local pages folder not found: {local_dir}")

    store = Store(args.db)
    results = []
    log.info("Parsing saved HTML from %s", local_dir)
    for u in urls:
        try:
            results.append(collect_local(u, store, local_dir))
        except Exception as e:  # one bad URL must never kill the run
            log.exception("Unexpected error for %s", u)
            r = Result(u, status="FAILED")
            r.notes.append(f"Unexpected error: {e!r}")
            results.append(r)

    n = store.export(out)
    report = build_report(results, store, "LOCAL")
    (out / "run_report.txt").write_text(report, encoding="utf-8")
    print(report)
    print(f"\nExported {n} total reviews to {out / 'reviews.csv'} and reviews.json")


if __name__ == "__main__":
    main()
