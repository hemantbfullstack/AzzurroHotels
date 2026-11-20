export function fmtRating(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

export function fmtDelta(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

export function ratingTone(n: number | null | undefined): string {
  if (n == null) return "muted";
  if (n >= 8) return "good";
  if (n >= 6) return "ok";
  return "bad";
}
