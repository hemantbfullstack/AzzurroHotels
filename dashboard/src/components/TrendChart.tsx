"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardSummary } from "@/lib/types";
import clsx from "clsx";

const RANGES = [28, 50, 70] as const;

export function TrendChart({ data }: { data: DashboardSummary["trendDaily"] }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(28);

  const chartData = useMemo(() => {
    const slice = data.slice(Math.max(0, data.length - days));
    return slice.map((d) => ({
      ...d,
      label: d.date.slice(5),
    }));
  }, [data, days]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy-400">Daily positive vs negative review counts</p>
        <div className="inline-flex rounded-xl border border-navy-100 bg-navy-50 p-1">
          {RANGES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDays(n)}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                days === n
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-ink hover:bg-white"
              )}
            >
              Last {n} days
            </button>
          ))}
        </div>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1A2B4C" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#1A2B4C" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="neg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D81B60" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#D81B60" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe1ec" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#6b82a8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "#6b82a8", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e6ebf3",
                boxShadow: "0 12px 30px rgba(26,43,76,0.08)",
              }}
            />
            <Legend />
            <Area type="monotone" dataKey="positive" name="Positive" stroke="#1A2B4C" fill="url(#pos)" strokeWidth={2} />
            <Area type="monotone" dataKey="negative" name="Negative" stroke="#D81B60" fill="url(#neg)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
