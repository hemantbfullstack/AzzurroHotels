import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { classifySentiment } from "./sentiment";
import { classifyTopicPolarity } from "./topics";
import type { EnrichedReview, RawReview } from "./types";

const SHORT_NAMES: Record<string, string> = {
  "olympic-paddington": "Olympic Paddington",
  "venus-potts-point-sydney": "Potts Point",
  "venus-surry-hills": "Central Sydney",
  "chateau-de-venus": "Darling Harbour",
};

type Cache = {
  mtimeMs: number;
  file: string;
  enriched: EnrichedReview[];
};

let cache: Cache | null = null;

/** Resolve dataset path for local, production, and Docker deploys. */
export function resolveReviewsPath(): string {
  if (process.env.REVIEWS_PATH) {
    return path.resolve(process.env.REVIEWS_PATH);
  }

  const candidates = [
    // Bundled with the Next app (preferred for production)
    path.resolve(process.cwd(), "data", "reviews.json"),
    // Monorepo layout when running from dashboard/
    path.resolve(process.cwd(), "..", "output", "reviews.json"),
    // Standalone server often runs from .next/standalone/dashboard
    path.resolve(process.cwd(), "..", "data", "reviews.json"),
    path.resolve(process.cwd(), "..", "..", "output", "reviews.json"),
    path.resolve(process.cwd(), "..", "..", "data", "reviews.json"),
  ];

  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return candidates[0];
}

export function propertyLabel(slug: string, name?: string | null): string {
  return SHORT_NAMES[slug] || name || slug;
}

export function loadRawReviews(): RawReview[] {
  const file = resolveReviewsPath();
  if (!existsSync(file)) {
    throw new Error(
      `Reviews dataset not found at ${file}. Run from project root: python run.py local && npm run sync-data --prefix dashboard`
    );
  }
  const raw = JSON.parse(readFileSync(file, "utf-8"));
  if (!Array.isArray(raw)) return [];
  return raw as RawReview[];
}

export function enrichReviews(rows: RawReview[]): EnrichedReview[] {
  return rows.map((r) => {
    const polarity = classifyTopicPolarity(r);
    return {
      ...r,
      property_label: propertyLabel(r.property_slug, r.property_name),
      sentiment: classifySentiment(r),
      topics: polarity.all,
      topicsPositive: polarity.positive,
      topicsNegative: polarity.negative,
      display_date: r.review_date,
    };
  });
}

export function loadEnrichedReviews(): EnrichedReview[] {
  const file = resolveReviewsPath();
  if (!existsSync(file)) {
    throw new Error(
      `Reviews dataset not found at ${file}. Run from project root: python run.py local && npm run sync-data --prefix dashboard`
    );
  }
  const mtimeMs = statSync(file).mtimeMs;
  if (cache && cache.file === file && cache.mtimeMs === mtimeMs) {
    return cache.enriched;
  }
  const enriched = enrichReviews(loadRawReviews());
  cache = { file, mtimeMs, enriched };
  return enriched;
}

export function datasetInfo(): { path: string; count: number; mtimeMs: number } {
  const file = resolveReviewsPath();
  const rows = loadEnrichedReviews();
  return {
    path: file,
    count: rows.length,
    mtimeMs: existsSync(file) ? statSync(file).mtimeMs : 0,
  };
}
