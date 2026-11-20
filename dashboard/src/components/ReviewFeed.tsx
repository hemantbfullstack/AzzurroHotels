"use client";

import { useEffect, useMemo, useState } from "react";
import { TOPIC_META } from "@/lib/topics";
import type { EnrichedReview, PropertyStat } from "@/lib/types";
import { fmtRating } from "@/lib/format";
import clsx from "clsx";

type Props = {
  properties: PropertyStat[];
  defaultFrom?: string;
  defaultTo?: string;
};

type ApiResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: EnrichedReview[];
  error?: string;
};

export function ReviewFeed({ properties, defaultFrom, defaultTo }: Props) {
  const [property, setProperty] = useState("all");
  const [from, setFrom] = useState(defaultFrom || "");
  const [to, setTo] = useState(defaultTo || "");
  const [sentiment, setSentiment] = useState("all");
  const [topic, setTopic] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      property,
      sentiment,
      topic,
    });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [page, property, sentiment, topic, from, to, q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reviews?${query}`)
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse;
        if (!res.ok) throw new Error(json.error || "Failed to load reviews");
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-[0_20px_50px_-40px_rgba(26,43,76,0.45)]">
      <div className="border-b border-navy-50 px-5 py-4">
        <h2 className="font-display text-xl font-bold text-ink">Review feed</h2>
        <p className="mt-1 text-sm text-navy-400">
          Browse individual guest reviews with date, property, sentiment, and topic filters
        </p>
      </div>

      <div className="grid gap-3 border-b border-navy-50 bg-navy-50/70 px-5 py-4 md:grid-cols-3 xl:grid-cols-6">
        <Field label="Property">
          <select className="field" value={property} onChange={(e) => { setProperty(e.target.value); setPage(1); }}>
            <option value="all">All properties</option>
            {properties.map((p) => (
              <option key={p.slug} value={p.slug}>{p.label}</option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input className="field" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </Field>
        <Field label="To">
          <input className="field" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </Field>
        <Field label="Sentiment">
          <select className="field" value={sentiment} onChange={(e) => { setSentiment(e.target.value); setPage(1); }}>
            <option value="all">All</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="mixed">Mixed</option>
            <option value="neutral">Neutral</option>
          </select>
        </Field>
        <Field label="Topic">
          <select className="field" value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1); }}>
            <option value="all">All topics</option>
            {Object.entries(TOPIC_META).map(([id, meta]) => (
              <option key={id} value={id}>{meta.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Search">
          <input
            className="field"
            placeholder="Search text…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </Field>
      </div>

      <div className="space-y-4 px-5 py-5">
        {loading && <p className="text-sm text-navy-400">Loading reviews…</p>}
        {error && <p className="text-sm text-brand-600">{error}</p>}
        {!loading && !error && data?.items.length === 0 && (
          <p className="text-sm text-navy-400">No reviews match these filters.</p>
        )}
        {data?.items.map((r) => (
          <article key={r.review_key} className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{r.review_title || "Guest review"}</p>
                <p className="mt-1 text-xs text-navy-300">
                  {r.property_label} · {r.display_date || "Unknown date"} · {r.reviewer_name || "Guest"}
                  {r.reviewer_country ? ` · ${r.reviewer_country}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                  r.sentiment === "positive" && "bg-emerald-50 text-emerald-700",
                  r.sentiment === "negative" && "bg-brand-50 text-brand-700",
                  r.sentiment === "mixed" && "bg-amber-50 text-amber-800",
                  r.sentiment === "neutral" && "bg-navy-50 text-navy-400"
                )}>
                  {r.sentiment}
                </span>
                <span className="rounded-full bg-navy-900 px-2.5 py-1 text-sm font-semibold text-white">
                  {fmtRating(r.rating)}
                </span>
              </div>
            </div>
            {r.positive_text && (
              <p className="mt-3 text-sm text-emerald-800">
                <span className="font-semibold">Liked: </span>{r.positive_text}
              </p>
            )}
            {r.negative_text && (
              <p className="mt-2 text-sm text-brand-800">
                <span className="font-semibold">Disliked: </span>{r.negative_text}
              </p>
            )}
            {!r.positive_text && !r.negative_text && r.review_text && (
              <p className="mt-3 text-sm text-navy-600">{r.review_text}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-navy-400">
              {r.room_type && <Chip>{r.room_type}</Chip>}
              {r.traveler_type && <Chip>{r.traveler_type}</Chip>}
              {r.stay_date && <Chip>Stayed {r.stay_date}</Chip>}
              {r.topicsNegative.map((t) => (
                <Chip key={`n-${t}`} tone="warn">⚠ {TOPIC_META[t]?.label || t}</Chip>
              ))}
              {r.topicsPositive
                .filter((t) => !r.topicsNegative.includes(t))
                .map((t) => (
                  <Chip key={`p-${t}`}>{TOPIC_META[t]?.label || t}</Chip>
                ))}
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-navy-50 px-5 py-4 text-sm">
        <p className="text-navy-400">
          {data ? `${data.total.toLocaleString()} matching reviews` : "—"}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="font-semibold text-navy-600">
            {page} / {totalPages}
          </span>
          <button
            className="btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wide text-navy-400">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warn" }) {
  return (
    <span
      className={clsx(
        "rounded-full px-2.5 py-1",
        tone === "warn" ? "bg-brand-50 text-brand-700" : "bg-navy-50 text-navy-500"
      )}
    >
      {children}
    </span>
  );
}
