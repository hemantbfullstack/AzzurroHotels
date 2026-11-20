import { NextResponse } from "next/server";
import { buildSummary } from "@/lib/analytics";
import { loadEnrichedReviews } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reviews = loadEnrichedReviews();
    const summary = buildSummary(reviews);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
