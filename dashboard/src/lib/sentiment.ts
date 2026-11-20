import type { RawReview, Sentiment } from "./types";

/** Booking-aware sentiment: prefer explicit +/- text, then rating bands. */
export function classifySentiment(review: RawReview): Sentiment {
  const pos = Boolean(review.positive_text?.trim());
  const neg = Boolean(review.negative_text?.trim());
  const rating = review.rating;

  if (pos && neg) return "mixed";
  if (pos && !neg) return "positive";
  if (neg && !pos) return "negative";

  if (rating != null) {
    if (rating >= 8) return "positive";
    if (rating < 6) return "negative";
    if (rating >= 6 && rating < 8) return "mixed";
  }
  return "neutral";
}
