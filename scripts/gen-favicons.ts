/**
 * One-shot raster variant generator for the 2026 logo.
 *
 * Inputs:
 *   assets/serial-experiments-logo-2026.png  (1254x1254 master)
 *
 * Outputs:
 *   public/favicon-16.png
 *   public/favicon-32.png
 *   public/favicon-180.png   (apple-touch)
 *   public/favicon-192.png   (android/PWA)
 *   public/favicon-512.png   (PWA / OG fallback)
 *   src/assets/logo-64.png   (header @1x — Vite fingerprints this)
 *   src/assets/logo-128.png  (header @2x for retina)
 *
 * Run on demand: `bun run scripts/gen-favicons.ts`. Outputs are committed —
 * we don't re-run on every build (per the plan: "no build-time work").
 */

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const src = join(root, "assets/serial-experiments-logo-2026.png");

const targets: { out: string; size: number }[] = [
  { out: "public/favicon-16.png", size: 16 },
  { out: "public/favicon-32.png", size: 32 },
  { out: "public/favicon-180.png", size: 180 },
  { out: "public/favicon-192.png", size: 192 },
  { out: "public/favicon-512.png", size: 512 },
  { out: "src/assets/logo-64.png", size: 64 },
  { out: "src/assets/logo-128.png", size: 128 },
];

mkdirSync(join(root, "public"), { recursive: true });
mkdirSync(join(root, "src/assets"), { recursive: true });

for (const t of targets) {
  const dest = join(root, t.out);
  await sharp(src)
    .resize(t.size, t.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);
  console.log(`wrote ${t.out} (${t.size}x${t.size})`);
}

console.log("done");
