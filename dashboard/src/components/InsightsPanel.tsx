import type { DashboardSummary, TopicStat } from "@/lib/types";
import { fmtRating } from "@/lib/format";
import clsx from "clsx";

export function InsightsPanel({ summary }: { summary: DashboardSummary }) {
  const rankedByScore = [...summary.topicInsights].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  );
  const rankedByComplaint = [...summary.topicInsights]
    .filter((t) => t.shareOfNegative > 0)
    .sort((a, b) => b.shareOfNegative - a.shareOfNegative);

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-navy-800 bg-gradient-to-br from-navy-900 via-navy-700 to-navy-800 p-6 text-white shadow-[0_30px_80px_-40px_rgba(26,43,76,0.95)] sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-8 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-300">
              Operational insight
            </p>
            <h2 className="mt-3 max-w-4xl font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {summary.headlineInsight}
            </h2>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-navy-100 backdrop-blur">
            <p>
              Week complaints:{" "}
              <span className="font-semibold text-white">
                {summary.week.start} → {summary.week.end}
              </span>
            </p>
            <p className="mt-1">
              Category scores: last 90 days ·{" "}
              <span className="font-semibold text-white">
                {summary.insightWindow.reviewCount.toLocaleString()} reviews
              </span>
            </p>
          </div>
        </div>

        <p className="relative mt-4 max-w-3xl text-sm leading-relaxed text-navy-100 sm:text-base">
          Category scores are estimated from reviews that mention each topic (average overall rating,
          last 90 days). Weekly complaint shares use keywords found in disliked comments only.
        </p>

        <div className="relative mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-bold">Category scoreboard</h3>
              <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                Estimated / 10
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {rankedByScore.map((t) => (
                <ScoreRow key={t.id} topic={t} />
              ))}
              {!rankedByScore.length && (
                <p className="text-sm text-navy-100">No topic mentions in the recent window.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur sm:p-6">
            <h3 className="font-display text-2xl font-bold">This week’s complaint themes</h3>
            <p className="mt-1 text-sm text-navy-100">
              Share of {summary.insightWindow.negativeCount} negative reviews
            </p>
            <div className="mt-5 space-y-3">
              {(rankedByComplaint.length ? rankedByComplaint : rankedByScore.slice(0, 4)).map((t) => (
                <div key={t.id} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-lg font-semibold">{t.label}</p>
                    <p className="text-2xl font-bold tabular-nums text-brand-300">
                      {t.shareOfNegative}%
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-navy-100/90">
                    {t.negativeMentions} negative mentions · complaint rate {t.complaintRate}%
                  </p>
                  {t.example && (
                    <p className="mt-2 line-clamp-3 text-sm text-white/90">“{t.example}”</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreRow({ topic }: { topic: TopicStat }) {
  const score = topic.score ?? 0;
  const width = Math.max(4, Math.min(100, (score / 10) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">{topic.label}</span>
        <span className="tabular-nums font-bold">{fmtRating(topic.score)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/15">
        <div
          className={clsx(
            "h-full rounded-full transition-all",
            score >= 8 && "bg-emerald-300",
            score >= 6 && score < 8 && "bg-brand-300",
            score < 6 && "bg-rose-300"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-navy-100/80">
        {topic.mentionCount} mentions · {topic.positiveMentions} liked / {topic.negativeMentions} disliked
      </p>
    </div>
  );
}
