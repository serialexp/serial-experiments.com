import { defineConfig } from "vite";
import solid from "@aeolun/vite-plugin-solid-oxc";
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
 * Pattern lifted from gothab/frontend. The Babel-based `vite-plugin-solid`
 * silently produces hydration-mismatch trees on this app — `template()`
 * gets called and re-renders client-side with no diagnostic, leaving the
 * Router's location signal disconnected from `<A>` clicks. The OXC plugin
 * doesn't have that bug; it also requires explicit `generate` + `hydratable`
 * options per build target since it doesn't infer them from `isSsrBuild`.
 *
 * `noExternal` for `@solidjs/*`: ssr build must compile JSX-source variants
 * for the SSR target. Externalizing them resolves to the precompiled DOM
 * bundle which crashes on the server. The Babel plugin auto-detects these
 * via vitefu's `crawlFrameworkPkgs`; the OXC plugin does not, so we list
 * them here manually (gothab parity).
 */
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    // `exclude: []` overrides the default `/node_modules/` so JSX files
    // inside `@solidjs/router` (which ships uncompiled `.jsx` resolved via
    // the `solid` export condition) get transformed for our target build.
    solid(
      isSsrBuild
        ? { generate: "ssr", hydratable: true, solid_condition: true, exclude: [] }
        : { generate: "dom", hydratable: true, solid_condition: true, exclude: [] },
    ),
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
    // Bind to all interfaces so the dev server is reachable from outside
    // localhost (e.g. through a Caddy / Traefik proxy on the home network).
    host: true,
    // Vite 6 rejects requests whose Host header isn't in this allow-list as
    // a DNS-rebinding mitigation. Local dev hostnames need explicit listing.
    // Add more entries here when previewing through a different tunnel.
    allowedHosts: [
      "localhost",
      "home.serial-experiments.com",
      ".serial-experiments.com",
    ],
    // The Vite dev server only renders the client bundle; the JSON API
    // (/api/*) still has to come from the real Bun server. Proxy
    // everything stateful through to it so dev preview behaves like prod.
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
      "/feed.xml": "http://localhost:3001",
    },
  },
}));
