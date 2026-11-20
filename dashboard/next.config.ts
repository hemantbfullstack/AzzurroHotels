import type { NextConfig } from "next";

// Vercel uses its own output pipeline — standalone is for Docker/VPS only.
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  // Ensure the real reviews dataset is available to server routes in production.
  outputFileTracingIncludes: {
    "/*": ["./data/reviews.json"],
    "/api/*": ["./data/reviews.json"],
  },
};

export default nextConfig;
