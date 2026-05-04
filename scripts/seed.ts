/// <reference types="bun-types" />
/**
 * Seed the local DB with a couple of posts so /posts and /posts/:slug
 * have something to render during development.
 *
 * Run: `bun run scripts/seed.ts`
 *
 * Idempotent — uses `INSERT OR IGNORE` keyed on slug.
 */
import { applyMigrations } from "../server/migrations";
import { db, getOne } from "../server/db";
import { create } from "../server/posts";

applyMigrations("migrations");

async function ensurePost(input: {
  slug: string;
  title: string;
  subtitle?: string;
  body_md: string;
  published_at?: string;
  tags?: string[];
}) {
  const exists = getOne<{ id: number }>(`SELECT id FROM posts WHERE slug = ?`, input.slug);
  if (exists) {
    console.log(`[seed] post '${input.slug}' already exists, skipping`);
    return;
  }
  await create({
    slug: input.slug,
    title: input.title,
    subtitle: input.subtitle ?? null,
    body_md: input.body_md,
    published_at: input.published_at ?? new Date().toISOString().slice(0, 19).replace("T", " "),
    tags: input.tags,
  });
  console.log(`[seed] created post '${input.slug}'`);
}

await ensurePost({
  slug: "hello-world",
  title: "Hello, world",
  subtitle: "the rebuild begins",
  body_md: `The website is alive again.

After a few years parked as a single static placeholder page, \`serial-experiments.com\` is back as a real site — written from scratch in TypeScript, server-rendered with SolidJS, content stored in SQLite, served by Bun.

This first post mostly exists to verify the pipeline: markdown comes in, sanitised HTML goes out, the page renders without re-fetching on hydration.

\`\`\`ts
console.log("hello, again");
\`\`\`
`,
  published_at: "2026-05-04 12:00:00",
  tags: ["meta", "site"],
});

await ensurePost({
  slug: "on-rebuilding",
  title: "On rebuilding",
  subtitle: "small notes about scope",
  body_md: `Every rebuild is a chance to throw out the parts that no longer fit. The original Hugo blog had a lovely CRT/terminal aesthetic — that part stays. The static-site recompile loop did not — that part goes.

Content lives in a SQLite database now. I can edit a post and refresh the page to see the change. No \`hugo build\`, no CI, no waiting.

> The best deploy is the one that doesn't redeploy.

— end —
`,
  published_at: "2026-05-04 12:30:00",
  tags: ["meta", "writing"],
});

const total = getOne<{ n: number }>(`SELECT COUNT(*) AS n FROM posts`)!;
console.log(`[seed] done. ${total.n} posts in db.`);
db.close();
