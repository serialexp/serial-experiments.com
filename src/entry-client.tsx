/* @refresh reload */
import { hydrate } from "solid-js/web";
import { Router } from "@solidjs/router";
import App from "./App";
import { AppRoutes } from "./routes";
import { SSRContext, type SSRContextValue } from "./lib/ssrContext";

/**
 * Client-side hydration entrypoint.
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

hydrate(
  () => (
    <SSRContext.Provider value={ctx}>
      <Router root={App}>
        <AppRoutes />
      </Router>
    </SSRContext.Provider>
  ),
  root,
);
