import { InsightsPanel } from "@/components/InsightsPanel";
import { KpiCard, ratingValue } from "@/components/KpiCard";
import { PropertyBreakdown } from "@/components/PropertyBreakdown";
import { ReviewFeed } from "@/components/ReviewFeed";
import { TrendChart } from "@/components/TrendChart";
import { buildSummary } from "@/lib/analytics";
import { loadEnrichedReviews } from "@/lib/data";
import { fmtDelta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function HomePage() {
  let error: string | null = null;
  let summary = null as ReturnType<typeof buildSummary> | null;

  try {
    const reviews = loadEnrichedReviews();
    summary = buildSummary(reviews);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load review data";
  }

  if (error || !summary) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <div className="rounded-3xl border border-rose-200 bg-white p-8 shadow-lg">
          <h1 className="font-display text-3xl text-ink">Dashboard data missing</h1>
          <p className="mt-3 text-navy-400">{error}</p>
          <p className="mt-4 text-sm text-navy-300">
            From the project root run <code className="rounded bg-navy-50 px-1.5 py-0.5">python run.py local</code>{" "}
            then restart the dashboard.
          </p>
        </div>
      </main>
    );
  }

  const posShare = summary.totalReviews
    ? Math.round((summary.sentimentMix.positive / summary.totalReviews) * 100)
    : 0;
  const negShare = summary.totalReviews
    ? Math.round((summary.sentimentMix.negative / summary.totalReviews) * 100)
    : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 overflow-hidden rounded-2xl bg-navy-900 px-5 py-3 text-sm text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold tracking-wide">
            <span className="text-brand-300">BEST RATE GUARANTEED</span>
            <span className="mx-2 text-navy-300">·</span>
            Guest review operations dashboard
          </p>
          <p className="text-navy-200">
            Week {summary.week.start} → {summary.week.end}
          </p>
        </div>
      </div>

      <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-navy-100 bg-white px-5 py-6 shadow-[0_20px_50px_-40px_rgba(26,43,76,0.55)] sm:px-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            Azzurro<span className="text-brand-500">.</span>
          </p>
          <h1 className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">
            Guest review operations
          </h1>
          <p className="mt-2 max-w-2xl text-navy-400">
            Live view of publicly collected Booking.com reviews across four properties —
            ratings, week-over-week movement, topic signals, and a full review feed for the ops team.
          </p>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy-400">
          <p>
            Dataset:{" "}
            <span className="font-semibold text-navy-900">
              {summary.totalReviews.toLocaleString()}
            </span>{" "}
            reviews
          </p>
          <p className="mt-1">
            Week window: <span className="font-semibold text-navy-900">{summary.week.start}</span> →{" "}
            <span className="font-semibold text-navy-900">{summary.week.end}</span>
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="accent"
          label="Avg rating this week"
          value={ratingValue(summary.weekAvgRating)}
          delta={summary.weekDelta}
          hint={`${summary.weekReviewCount} reviews · prior week ${ratingValue(summary.prevWeekAvgRating)} (${summary.prevWeekReviewCount} reviews)`}
        />
        <KpiCard
          label="Week volume"
          value={String(summary.weekReviewCount)}
          hint={`Previous week: ${summary.prevWeekReviewCount} · delta ${fmtDelta(
            summary.weekReviewCount - summary.prevWeekReviewCount
          )}`}
        />
        <KpiCard
          label="Positive share (all time)"
          value={`${posShare}%`}
          hint={`${summary.sentimentMix.positive.toLocaleString()} positive · ${summary.sentimentMix.mixed} mixed`}
        />
        <KpiCard
          label="Negative share (all time)"
          value={`${negShare}%`}
          hint={`${summary.sentimentMix.negative.toLocaleString()} negative reviews in dataset`}
        />
      </section>

      <section className="mt-6">
        <InsightsPanel summary={summary} />
      </section>

      <section className="mt-6 rounded-3xl border border-navy-100 bg-white p-5 shadow-[0_20px_50px_-40px_rgba(26,43,76,0.45)] sm:p-6">
        <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
          Positive vs negative trend
        </h2>
        <div className="mt-4">
          <TrendChart data={summary.trendDaily} />
        </div>
      </section>

      <section className="mt-6">
        <PropertyBreakdown properties={summary.properties} />
      </section>

      <section className="mt-6">
        <ReviewFeed
          properties={summary.properties}
          defaultFrom={summary.week.start}
          defaultTo={summary.week.end}
        />
      </section>

      <footer className="mt-10 border-t border-navy-100 pt-6 text-sm text-navy-300">
        <p>
          Based on {summary.totalReviews.toLocaleString()} collected Booking.com reviews.
          Sentiment uses guest liked/disliked text when available, otherwise rating bands
          (≥8 positive, &lt;6 negative). Topics are keyword-tagged for operational triage.
        </p>
      </footer>
    </main>
  );
}
