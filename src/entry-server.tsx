/// <reference types="bun-types" />
import { renderToStringAsync, generateHydrationScript, getAssets } from "solid-js/web";
import { Router } from "@solidjs/router";
import App from "./App";
import { AppRoutes } from "./routes";
import { SSRContext, type SSRContextValue } from "./lib/ssrContext";

export interface RenderInput {
  url: string;
  publicOrigin: string;
  user: SSRContextValue["user"];
  cookie: string;
}

export interface RenderResult {
  /** Rendered HTML to splice into the page shell at `<!--ssr-outlet-->`. */
  html: string;
  /** Combined Solid asset hints + Meta head tags + hydration script. */
  headTags: string;
}

/**
 * Server-side render the app for one request.
 *
 * Per-request state (auth user, public origin) is injected via a Solid
 * Context provider rather than gothab's AsyncLocalStorage approach. This
 * site has no concurrent state mutation across the render — `createResource`
 * calls go straight to in-process functions that read from SQLite without
 * touching shared state — so a context is sufficient and avoids pulling
 * `node:async_hooks` into the SSR module.
 *
 * Meta tags (Title, Meta, Link) are emitted by @solidjs/meta into Solid's
 * `useAssets` registry inside `<MetaProvider>` (rendered by App.tsx). They
 * surface in the `getAssets()` output below — no separate extraction step.
 */
export async function render(input: RenderInput): Promise<RenderResult> {
  const ctx: SSRContextValue = {
    user: input.user,
    publicOrigin: input.publicOrigin,
    cookie: input.cookie,
    // CSRF is not used during SSR (no forms post during render). The
    // client picks it up from the bootstrap blob written by server.ts.
    csrf: null,
    isServer: true,
  };

  const html = await renderToStringAsync(() => (
    <SSRContext.Provider value={ctx}>
      <Router url={input.url} root={App}>
        <AppRoutes />
      </Router>
    </SSRContext.Provider>
  ));

  const headTags = getAssets() + generateHydrationScript();

  return { html, headTags };
}
