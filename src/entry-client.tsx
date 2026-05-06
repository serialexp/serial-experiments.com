/* @refresh reload */
import { hydrate, render } from "solid-js/web";
import { Router } from "@solidjs/router";
import App from "./App";
import { AppRoutes } from "./routes";
import { SSRContext, type SSRContextValue } from "./lib/ssrContext";

/**
 * Client-side entrypoint.
 *
 * In production we attach to a server-rendered tree via `hydrate()`. In
 * `pnpm dev` (Vite-only, no SSR yet — see TODO.md "Dev mode") the page
 * arrives as the bare template with no `_$HY` hydration registry, so
 * `hydrate()` would crash with "_$HY is undefined". Detect that case and
 * fall through to a plain `render()`.
 *
 * The server bootstraps SSR data via a `<script id="ssr-bootstrap">` element
 * (written by `server.ts`) containing a JSON blob with the auth user and
 * public origin. We read it once at startup and surface those values via
 * the same `SSRContext` the server provided during render — components see
 * an identical context shape on both sides of hydration.
 */

const bootstrapEl = document.getElementById("ssr-bootstrap");
const bootstrap: {
  user: SSRContextValue["user"];
  publicOrigin: string;
  csrf: string | null;
} = bootstrapEl?.textContent
  ? JSON.parse(bootstrapEl.textContent)
  : { user: null, publicOrigin: window.location.origin, csrf: null };

const ctx: SSRContextValue = {
  user: bootstrap.user,
  publicOrigin: bootstrap.publicOrigin,
  csrf: bootstrap.csrf,
  // The browser cannot read HttpOnly cookies; client-side fetches rely on the
  // browser to attach them automatically (`credentials: "include"`).
  cookie: "",
  isServer: false,
};

const root = document.getElementById("root")!;

const tree = () => (
  <SSRContext.Provider value={ctx}>
    <Router root={App}>
      <AppRoutes />
    </Router>
  </SSRContext.Provider>
);

// `_$HY` is the hydration registry installed by `generateHydrationScript()`
// during SSR. Its presence is the signal that the DOM has server-rendered
// markers we should hydrate against. Without it we're in a CSR-only shell
// (dev mode), so render fresh — and clear the SSR placeholder comment so
// it doesn't sit alongside the rendered tree.
const hasSsrTree = "_$HY" in globalThis;
if (hasSsrTree) {
  hydrate(tree, root);
} else {
  root.innerHTML = "";
  render(tree, root);
}
