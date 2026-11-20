export type RawReview = {
  review_key: string;
  property_slug: string;
  property_name: string | null;
  source_url: string;
  review_title: string | null;
  rating: number | null;
  review_date: string | null;
  review_date_raw: string | null;
  stay_date: string | null;
  reviewer_name: string | null;
  reviewer_country: string | null;
  room_type: string | null;
  traveler_type: string | null;
  nights: string | null;
  positive_text: string | null;
  negative_text: string | null;
  review_text: string | null;
  owner_response: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

export type Sentiment = "positive" | "negative" | "mixed" | "neutral";

export type TopicId =
  | "cleanliness"
  | "check_in"
  | "staff"
  | "noise"
  | "facilities"
  | "location"
  | "room"
  | "value";

export type EnrichedReview = RawReview & {
  property_label: string;
  sentiment: Sentiment;
  topics: TopicId[];
  topicsPositive: TopicId[];
  topicsNegative: TopicId[];
  display_date: string | null;
};

export type TopicStat = {
  id: TopicId;
  label: string;
  /** Estimated category score: average rating of reviews mentioning this topic. */
  score: number | null;
  mentionCount: number;
  positiveMentions: number;
  negativeMentions: number;
  /** Share of this week's negative reviews that complain about the topic. */
  shareOfNegative: number;
  /** Negative mentions / (positive + negative polarity mentions). */
  complaintRate: number;
  example: string | null;
};

export type PropertyStat = {
  slug: string;
  label: string;
  count: number;
  avgRating: number | null;
  positiveShare: number;
  negativeShare: number;
  weekAvg: number | null;
  prevWeekAvg: number | null;
  weekDelta: number | null;
};

export type DashboardSummary = {
  generatedAt: string;
  totalReviews: number;
  datedReviews: number;
  week: { start: string; end: string };
  prevWeek: { start: string; end: string };
  weekAvgRating: number | null;
  prevWeekAvgRating: number | null;
  weekDelta: number | null;
  weekReviewCount: number;
  prevWeekReviewCount: number;
  properties: PropertyStat[];
  topicInsights: TopicStat[];
  headlineInsight: string;
  insightWindow: { start: string; end: string; reviewCount: number; negativeCount: number };
  trendDaily: Array<{
    date: string;
    avgRating: number | null;
    positive: number;
    negative: number;
    count: number;
  }>;
  sentimentMix: { positive: number; negative: number; mixed: number; neutral: number };
};
