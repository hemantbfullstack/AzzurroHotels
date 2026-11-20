#!/usr/bin/env node
/**
 * Copy the scraper dataset into the Next.js app so production/standalone
 * deploys do not depend on ../output path resolution.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(dashboardRoot, "..");
const src = path.resolve(projectRoot, "output", "reviews.json");
const destDir = path.resolve(dashboardRoot, "data");
const dest = path.resolve(destDir, "reviews.json");

if (!existsSync(src)) {
  console.error(`Missing dataset: ${src}`);
  console.error("Run from project root: python run.py local");
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
const mb = (statSync(dest).size / (1024 * 1024)).toFixed(2);
console.log(`Synced ${src} -> ${dest} (${mb} MB)`);
