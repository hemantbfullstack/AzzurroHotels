import { fmtDelta, fmtRating } from "@/lib/format";
import clsx from "clsx";

type Props = {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  tone?: "default" | "good" | "bad" | "accent";
};

export function KpiCard({ label, value, hint, delta, tone = "default" }: Props) {
  return (
    <article
      className={clsx(
        "rounded-2xl border border-navy-100 bg-white p-5 shadow-[0_12px_40px_-28px_rgba(26,43,76,0.45)]",
        tone === "accent" && "border-transparent bg-gradient-to-br from-brand-500 to-brand-700 text-white"
      )}
    >
      <p
        className={clsx(
          "text-xs font-bold uppercase tracking-[0.14em]",
          tone === "accent" ? "text-pink-100" : "text-navy-400"
        )}
      >
        {label}
      </p>
      <div className="mt-3 flex items-end gap-3">
        <p
          className={clsx(
            "font-display text-4xl font-bold tracking-tight",
            tone === "accent" ? "text-white" : "text-ink"
          )}
        >
          {value}
        </p>
        {delta != null && (
          <span
            className={clsx(
              "mb-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              delta > 0 && "bg-emerald-100 text-emerald-700",
              delta < 0 && "bg-rose-100 text-rose-700",
              delta === 0 && "bg-navy-50 text-navy-600",
              tone === "accent" && "bg-white/20 text-white"
            )}
          >
            {fmtDelta(delta)} vs prior week
          </span>
        )}
      </div>
      {hint && (
        <p className={clsx("mt-2 text-sm", tone === "accent" ? "text-pink-50/95" : "text-navy-400")}>
          {hint}
        </p>
      )}
    </article>
  );
}

export function ratingValue(n: number | null): string {
  return fmtRating(n);
}
