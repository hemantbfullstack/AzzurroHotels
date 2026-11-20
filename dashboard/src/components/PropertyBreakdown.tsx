import { fmtDelta, fmtRating } from "@/lib/format";
import type { PropertyStat } from "@/lib/types";
import clsx from "clsx";

export function PropertyBreakdown({ properties }: { properties: PropertyStat[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-[0_20px_50px_-40px_rgba(26,43,76,0.45)]">
      <div className="border-b border-navy-50 px-5 py-4">
        <h2 className="font-display text-xl font-bold text-ink">Property rating breakdown</h2>
        <p className="mt-1 text-sm text-navy-400">Overall scores plus this week vs previous week</p>
      </div>
      <div className="divide-y divide-navy-50">
        {properties.map((p) => (
          <div key={p.slug} className="grid gap-3 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-center">
            <div>
              <p className="font-semibold text-ink">{p.label}</p>
              <p className="text-xs text-navy-300">
                {p.count.toLocaleString()} reviews · {p.positiveShare}% positive
              </p>
            </div>
            <Metric label="Overall" value={fmtRating(p.avgRating)} />
            <Metric label="This week" value={fmtRating(p.weekAvg)} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-navy-300">Week delta</p>
              <p
                className={clsx(
                  "mt-1 text-lg font-semibold",
                  (p.weekDelta ?? 0) > 0 && "text-emerald-700",
                  (p.weekDelta ?? 0) < 0 && "text-brand-600",
                  (p.weekDelta ?? 0) === 0 && "text-navy-400"
                )}
              >
                {fmtDelta(p.weekDelta)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy-300">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
