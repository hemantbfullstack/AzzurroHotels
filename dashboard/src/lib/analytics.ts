import {
  format,
  parseISO,
  subDays,
  isValid,
  eachDayOfInterval,
} from "date-fns";
import { topicLabel } from "./topics";
import type {
  DashboardSummary,
  EnrichedReview,
  PropertyStat,
  TopicId,
  TopicStat,
} from "./types";

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n: number | null): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

function inRange(date: string | null, start: string, end: string): boolean {
  if (!date) return false;
  return date >= start && date <= end;
}

function anchorDate(reviews: EnrichedReview[]): Date {
  const dates = reviews
    .map((r) => r.review_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  if (!dates.length) return new Date();
  const d = parseISO(dates[dates.length - 1]);
  return isValid(d) ? d : new Date();
}

export function buildSummary(reviews: EnrichedReview[]): DashboardSummary {
  const end = anchorDate(reviews);
  const weekEnd = format(end, "yyyy-MM-dd");
  const weekStart = format(subDays(end, 6), "yyyy-MM-dd");
  const prevEnd = format(subDays(end, 7), "yyyy-MM-dd");
  const prevStart = format(subDays(end, 13), "yyyy-MM-dd");

  const weekReviews = reviews.filter((r) =>
    inRange(r.review_date, weekStart, weekEnd)
  );
  const prevReviews = reviews.filter((r) =>
    inRange(r.review_date, prevStart, prevEnd)
  );

  const weekAvg = round1(
    avg(weekReviews.map((r) => r.rating).filter((n): n is number => n != null))
  );
  const prevAvg = round1(
    avg(prevReviews.map((r) => r.rating).filter((n): n is number => n != null))
  );
  const weekDelta =
    weekAvg != null && prevAvg != null
      ? Math.round((weekAvg - prevAvg) * 10) / 10
      : null;

  const bySlug = new Map<string, EnrichedReview[]>();
  for (const r of reviews) {
    const list = bySlug.get(r.property_slug) || [];
    list.push(r);
    bySlug.set(r.property_slug, list);
  }

  const properties: PropertyStat[] = [...bySlug.entries()]
    .map(([slug, rows]) => {
      const label = rows[0]?.property_label || slug;
      const ratings = rows
        .map((r) => r.rating)
        .filter((n): n is number => n != null);
      const week = rows.filter((r) => inRange(r.review_date, weekStart, weekEnd));
      const prev = rows.filter((r) =>
        inRange(r.review_date, prevStart, prevEnd)
      );
      const wAvg = round1(
        avg(week.map((r) => r.rating).filter((n): n is number => n != null))
      );
      const pAvg = round1(
        avg(prev.map((r) => r.rating).filter((n): n is number => n != null))
      );
      const pos = rows.filter((r) => r.sentiment === "positive").length;
      const neg = rows.filter((r) => r.sentiment === "negative").length;
      return {
        slug,
        label,
        count: rows.length,
        avgRating: round1(avg(ratings)),
        positiveShare: rows.length ? Math.round((pos / rows.length) * 100) : 0,
        negativeShare: rows.length ? Math.round((neg / rows.length) * 100) : 0,
        weekAvg: wAvg,
        prevWeekAvg: pAvg,
        weekDelta:
          wAvg != null && pAvg != null
            ? Math.round((wAvg - pAvg) * 10) / 10
            : null,
      };
    })
    .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));

  // Category scores use a 90-day window; weekly complaint % uses the current week.
  const insightEnd = weekEnd;
  const insightStart = format(subDays(end, 89), "yyyy-MM-dd");
  const insightReviews = reviews.filter((r) =>
    inRange(r.review_date, insightStart, insightEnd)
  );
  const weekNeg = weekReviews.filter((r) => r.sentiment === "negative");

  const topicIds: TopicId[] = [
    "cleanliness",
    "check_in",
    "staff",
    "noise",
    "facilities",
    "location",
    "room",
    "value",
  ];

  const topicInsights: TopicStat[] = topicIds
    .map((id) => {
      const mentioned = insightReviews.filter((r) => r.topics.includes(id));
      const ratings = mentioned
        .map((r) => r.rating)
        .filter((n): n is number => n != null);
      const positiveMentions = insightReviews.filter((r) =>
        r.topicsPositive.includes(id)
      ).length;
      const negativeMentions = insightReviews.filter((r) =>
        r.topicsNegative.includes(id)
      ).length;
      const weekComplaintReviews = weekNeg.filter((r) =>
        r.topicsNegative.includes(id)
      );
      const polarityTotal = positiveMentions + negativeMentions;
      const example =
        weekComplaintReviews[0]?.negative_text ||
        mentioned.find((r) => r.topicsNegative.includes(id))?.negative_text ||
        mentioned[0]?.review_text ||
        null;

      return {
        id,
        label: topicLabel(id),
        score: round1(avg(ratings)),
        mentionCount: mentioned.length,
        positiveMentions,
        negativeMentions,
        shareOfNegative: weekNeg.length
          ? Math.round((weekComplaintReviews.length / weekNeg.length) * 100)
          : 0,
        complaintRate: polarityTotal
          ? Math.round((negativeMentions / polarityTotal) * 100)
          : 0,
        example,
      };
    })
    .filter((t) => t.mentionCount > 0)
    .sort((a, b) => (a.score ?? 99) - (b.score ?? 99));

  const topComplaint = [...topicInsights].sort(
    (a, b) => b.shareOfNegative - a.shareOfNegative || b.negativeMentions - a.negativeMentions
  )[0];

  let headlineInsight =
    "Not enough dated reviews in the current week to form a topic insight.";
  if (weekNeg.length && topComplaint && topComplaint.shareOfNegative > 0) {
    const n = Math.round((topComplaint.shareOfNegative / 100) * weekNeg.length);
    headlineInsight = `${topComplaint.shareOfNegative}% of negative reviews this week mentioned ${topComplaint.label.toLowerCase()}-related issues (${n} of ${weekNeg.length}).`;
  } else if (topicInsights.length) {
    const weakest = topicInsights[0];
    headlineInsight = `${weakest.label} is the weakest estimated category score right now (${weakest.score ?? "—"} / 10 across ${weakest.mentionCount} recent mentions).`;
  }

  const trendStart = subDays(end, 69);
  const days = eachDayOfInterval({ start: trendStart, end });
  const trendDaily = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const dayRows = reviews.filter((r) => r.review_date === key);
    return {
      date: key,
      avgRating: round1(
        avg(dayRows.map((r) => r.rating).filter((n): n is number => n != null))
      ),
      positive: dayRows.filter((r) => r.sentiment === "positive").length,
      negative: dayRows.filter((r) => r.sentiment === "negative").length,
      count: dayRows.length,
    };
  });

  const sentimentMix = {
    positive: reviews.filter((r) => r.sentiment === "positive").length,
    negative: reviews.filter((r) => r.sentiment === "negative").length,
    mixed: reviews.filter((r) => r.sentiment === "mixed").length,
    neutral: reviews.filter((r) => r.sentiment === "neutral").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    totalReviews: reviews.length,
    datedReviews: reviews.filter((r) => r.review_date).length,
    week: { start: weekStart, end: weekEnd },
    prevWeek: { start: prevStart, end: prevEnd },
    weekAvgRating: weekAvg,
    prevWeekAvgRating: prevAvg,
    weekDelta,
    weekReviewCount: weekReviews.length,
    prevWeekReviewCount: prevReviews.length,
    properties,
    topicInsights,
    headlineInsight,
    insightWindow: {
      start: insightStart,
      end: insightEnd,
      reviewCount: insightReviews.length,
      negativeCount: weekNeg.length,
    },
    trendDaily,
    sentimentMix,
  };
}

export function filterReviews(
  reviews: EnrichedReview[],
  opts: {
    property?: string;
    from?: string;
    to?: string;
    sentiment?: string;
    topic?: string;
    q?: string;
  }
): EnrichedReview[] {
  return reviews.filter((r) => {
    if (opts.property && opts.property !== "all" && r.property_slug !== opts.property)
      return false;
    if (opts.from && (!r.review_date || r.review_date < opts.from)) return false;
    if (opts.to && (!r.review_date || r.review_date > opts.to)) return false;
    if (opts.sentiment && opts.sentiment !== "all" && r.sentiment !== opts.sentiment)
      return false;
    if (opts.topic && opts.topic !== "all" && !r.topics.includes(opts.topic as TopicId))
      return false;
    if (opts.q) {
      const hay = [
        r.review_title,
        r.review_text,
        r.positive_text,
        r.negative_text,
        r.reviewer_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(opts.q.toLowerCase())) return false;
    }
    return true;
  });
}

export function sortReviews(reviews: EnrichedReview[]): EnrichedReview[] {
  return [...reviews].sort((a, b) => {
    const da = a.review_date || "";
    const db = b.review_date || "";
    if (da !== db) return db.localeCompare(da);
    return (b.rating || 0) - (a.rating || 0);
  });
}

