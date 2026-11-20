#!/usr/bin/env node
/**
 * After `next build`, assemble a runnable standalone folder with
 * static assets + the real reviews dataset.
 */
import { cpSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const standalone = path.resolve(root, ".next", "standalone");
const staticDir = path.resolve(root, ".next", "static");
const publicDir = path.resolve(root, "public");
const dataFile = path.resolve(root, "data", "reviews.json");

// Vercel disables `output: 'standalone'` — skip this Docker/VPS helper there.
if (process.env.VERCEL === "1" || !existsSync(standalone)) {
  if (process.env.VERCEL === "1") {
    console.log("Skipping standalone prepare on Vercel");
  } else {
    console.log("Skipping standalone prepare (.next/standalone not present)");
  }
  process.exit(0);
}
if (!existsSync(dataFile)) {
  console.error("Missing data/reviews.json — run npm run sync-data first");
  process.exit(1);
}

mkdirSync(path.join(standalone, "data"), { recursive: true });
mkdirSync(path.join(standalone, ".next"), { recursive: true });
cpSync(dataFile, path.join(standalone, "data", "reviews.json"));
if (existsSync(staticDir)) {
  cpSync(staticDir, path.join(standalone, ".next", "static"), { recursive: true });
}
if (existsSync(publicDir)) {
  cpSync(publicDir, path.join(standalone, "public"), { recursive: true });
}
console.log("Standalone server prepared at .next/standalone (dataset included)");
