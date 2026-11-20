# Azzurro Hotels — Review Collector & Operations Dashboard

Collects publicly available Booking.com guest reviews for the Azzurro properties and presents them in an operations dashboard.

```text
azzurroHotels/
  files/                 # scraper (capture + local parse)
  data/saved_pages/      # saved review HTML (local, gitignored)
  output/reviews.json    # structured dataset used by the dashboard
  dashboard/             # Next.js operations UI
  run.py                 # scraper entrypoint
```

## Setup

### Scraper

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

### Dashboard

```bash
cd dashboard
npm install
```

## How to run

### Collect / refresh reviews

Edit hotel URLs in `files/urls.txt`, then from the project root:

```bash
source .venv/bin/activate
python run.py capture   # opens Chromium; complete any check if shown
python run.py local     # parse saved HTML → output/reviews.*
```

### Start the dashboard

```bash
cd dashboard
npm run dev
```

Open http://localhost:3000

`predev` / `prebuild` sync `output/reviews.json` into `dashboard/data/reviews.json`.

### Production (Node)

```bash
cd dashboard
npm ci
npm run build
npm start
```

Optional: `export REVIEWS_PATH=/absolute/path/to/reviews.json`  
Health check: `GET /api/health`

### Production (Docker)

```bash
docker compose up --build -d
```

### Production (Vercel)

1. Push this repo to GitHub (sample data is already in `dashboard/data/reviews.json` and `output/reviews.json`).
2. In Vercel → **Add New Project** → import `hemantbfullstack/AzzurroHotels`.
3. Set **Root Directory** to `dashboard` (important — not the repo root).
4. Framework Preset: **Next.js**. Leave Build Command / Output as defaults (`npm run build`).
5. Deploy.
6. Open the deployment URL and check `/api/health` for a successful status and review count.

If a previous deploy failed on `prepare-standalone`, redeploy after the latest `main` (that step is skipped on Vercel).

Refresh flow after new scrapes: run the scraper locally, sync data, commit `dashboard/data/reviews.json`, redeploy.

Do not commit `.browser_profile/`, cookies, API keys, or other credentials.

## Architecture

| Layer | Role |
|-------|------|
| `files/capture_pages.py` | Browser capture of public review pages |
| `files/scrape_reviews.py` | Offline HTML parse + dedupe into SQLite/CSV/JSON |
| `output/reviews.json` | Dataset consumed by the dashboard |
| `dashboard/` | Next.js UI and API routes |

```text
urls.txt → capture (HTML) → local parse → reviews.json → dashboard
```

## Review collection

Booking.com does not provide review API access for this use case, and simple HTTP clients are often challenged.

Approach:

1. Open Chromium and load each hotel’s public reviews UI.
2. Paginate and save each page as local HTML under `data/saved_pages/`.
3. Parse offline with layered selectors (`data-testid`, with older class fallbacks).
4. Deduplicate with a content hash (property + reviewer + date + title + text).
5. Incremental runs add only newly seen reviews.

Fields captured when published: rating, title, dates, property, reviewer, room/traveler type, nights, positive/negative text, owner response.

## Dashboard

- Average rating for the current week vs previous week
- Property-by-property rating breakdown
- Review feed with date, property, sentiment, topic, and text filters
- Positive vs negative trend (28 / 50 / 70 day ranges)
- Topic insights (cleanliness, check-in, staff, noise, facilities, location, room, value)

### Insights method

- Sentiment prefers Booking liked/disliked text; otherwise rating bands (≥8 positive, &lt;6 negative).
- Topics use keyword matching with polarity (negative vs positive text).
- Category scores are estimated as the average overall rating of reviews mentioning each topic (last 90 days). Official Booking category subscores are not available in the collected public HTML.

## Limitations

- Markup changes on Booking.com may require selector updates.
- Browser checks/CAPTCHAs may need manual completion during capture.
- Saved HTML can be large; `data/saved_pages/` is gitignored.
- “Week” is a rolling 7-day window ending on the newest review date in the dataset.
- Keyword topics can miss sarcasm, paraphrases, and non-English phrasing.
