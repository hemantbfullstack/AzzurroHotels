import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { datasetInfo, resolveReviewsPath } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const file = resolveReviewsPath();
    const present = existsSync(file);
    if (!present) {
      return NextResponse.json(
        {
          ok: false,
          service: "azzurro-dashboard",
          datasetFound: false,
          datasetPath: file,
        },
        { status: 503 }
      );
    }
    const info = datasetInfo();
    return NextResponse.json({
      ok: true,
      service: "azzurro-dashboard",
      datasetFound: true,
      reviewCount: info.count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        service: "azzurro-dashboard",
        error: err instanceof Error ? err.message : "health check failed",
      },
      { status: 500 }
    );
  }
}
