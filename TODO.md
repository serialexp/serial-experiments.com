# TODO

Small follow-ups noted while building, not worth interrupting flow for.

- **Admin edit form SSR pre-population**: `/admin/posts/:id` shows the loading
  state during SSR because the form signals can't synchronously read
  `existing()`'s resolved value before the first render. After hydration the
  fetch completes and the form populates fine. Fix is a per-field memo that
  prefers the user's signal value when set, otherwise reads from `existing()`.
- **PATCH semantics**: `/api/admin/posts/:id` PATCH currently treats missing
  fields as `null` (PUT-like). Fine for the in-app form which always sends
  every field, but a real partial-PATCH would be more correct for scripted use.
- **Two SQLite connections per process**: server.ts opens one (for migrations
  + API queries), the bundled SSR module opens a second when first hit. WAL
  makes this safe but it's wasteful and produces duplicate `[db] opened` log
  lines. Fix is to externalize `~server/*` in the SSR bundle so it loads the
  same module instance.

- **404 status code**: SSR renders the wildcard `NotFound` route with a 200
  response. We should detect the wildcard match (or use SolidJS Router's
  status hooks) and return 404 in `server.ts`. Crawlers care.
- **SVG logo**: ship raster PNG variants now; future iteration should
  replace with a hand-traced SVG of the new logo for crisp scaling at any
  size and a smaller header payload.
- **CodeMirror admin editor**: v1 ships textarea + live preview. Upgrade to
  CodeMirror 6 with `lang-markdown` once the textarea pain shows up.
- **CRT flicker**: original Hugo theme had a 20-step random-opacity flicker.
  Currently disabled. Reintroduce a calmer version (1–2% opacity wobble,
  10s period) gated on `prefers-reduced-motion: no-preference`.
- **Dev mode**: `pnpm dev` currently runs a CSR Vite shell. Add a vite-node
  middleware mode to `server.ts` so `bun run server.ts` in development
  hot-reloads the SSR module instead of requiring a `pnpm build`.
- **Backup**: nightly `data/site.db` snapshot to a sibling `data/backups/`
  dir, retained N days.
- **Lazy route splitting**: routes are eagerly imported in `src/routes.tsx`.
  The earlier SPA-navigation breakage on `lazy()` was actually caused by
  `vite-plugin-solid` (Babel) producing a silently-mismatched hydration
  tree, which was fixed by switching to `@aeolun/vite-plugin-solid-oxc`.
  `lazy()` was never re-tested after the plugin swap; likely re-enables
  cleanly now. Single-bundle client is 85 kB, so not urgent.
