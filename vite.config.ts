import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve } from "node:path";

/**
 * Vite config for serial-experiments.com.
 *
 * Two builds:
 *  - Default (`vite build`): client bundle into `dist/client`. Includes the
 *    Vite manifest so the SSR step can resolve hashed asset paths.
 *  - SSR (`vite build --ssr src/entry-server.tsx`): server bundle into
 *    `dist/server`. Solid is compiled with `generate: "ssr"` and `hydratable`.
 *
 * Pattern lifted from gothab/frontend, simplified: one Solid plugin, one out
 * dir scheme, no debug-build harness.
 *
 * `noExternal` for `@solidjs/*`: ssr build must compile JSX-source variants
 * for the SSR target. Externalizing them resolves to the precompiled DOM
 * bundle which crashes on the server. vite-plugin-solid's vitefu-based
 * crawl picks these up automatically; we list them here as a safety net
 * in case auto-detection misses one.
 */
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    solid({
      ssr: !!isSsrBuild,
      // hydratable mode is implicit when ssr is true; vite-plugin-solid
      // sets it correctly based on the build target.
    }),
  ],
  resolve: {
    alias: {
      "~": resolve(import.meta.dirname, "src"),
      "~server": resolve(import.meta.dirname, "server"),
    },
  },
  build: {
    manifest: !isSsrBuild,
    outDir: isSsrBuild ? "dist/server" : "dist/client",
    sourcemap: false,
    minify: "esbuild",
    target: "es2022",
    emptyOutDir: true,
  },
  ssr: {
    noExternal: [/^@solidjs\//],
  },
  server: {
    port: 5173,
    // Local dev: when you `vite dev`, the SSR server (server.ts on :3001)
    // proxies SSR requests through Vite's middleware via vite-node. The dev
    // story is added in a follow-up; for now `vite dev` serves a CSR shell.
  },
}));
