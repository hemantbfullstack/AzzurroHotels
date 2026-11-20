import { NextRequest, NextResponse } from "next/server";
import { filterReviews, sortReviews } from "@/lib/analytics";
import { loadEnrichedReviews } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 12)));
    const reviews = loadEnrichedReviews();
    const filtered = sortReviews(
      filterReviews(reviews, {
        property: searchParams.get("property") || undefined,
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
        sentiment: searchParams.get("sentiment") || undefined,
        topic: searchParams.get("topic") || undefined,
        q: searchParams.get("q") || undefined,
      })
    );
    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    return NextResponse.json({
      total: filtered.length,
      page,
      pageSize,
      items: slice,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load reviews";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
