import { createContext, useContext } from "solid-js";

export interface AuthUser {
  id: number;
  username: string;
}

export interface SSRContextValue {
  /** Authenticated admin user, or null when unauthenticated. */
  user: AuthUser | null;
  /** Public-facing origin (scheme+host) — used for canonical/og:url meta. */
  publicOrigin: string;
  /**
   * Raw Cookie header from the incoming request. Server-only; on the client
   * this is always empty (browser attaches cookies automatically; HttpOnly
   * cookies are unreadable from JS).
   */
  cookie: string;
  /**
   * CSRF token, present only when the visitor is authenticated. Required
   * on every state-changing admin API call as the `X-CSRF` header.
   */
  csrf: string | null;
  /** True during SSR, false after hydration. */
  isServer: boolean;
}

/**
 * Per-request context. Both server (entry-server.tsx) and client
 * (entry-client.tsx) wrap the app in `<SSRContext.Provider>` so components
 * read the same shape regardless of environment.
 *
 * Default value is the unauthenticated/no-origin shape, used only if a
 * component is rendered outside the provider (it shouldn't be).
 */
export const SSRContext = createContext<SSRContextValue>({
  user: null,
  publicOrigin: "",
  cookie: "",
  csrf: null,
  isServer: false,
});

export function useSSRContext(): SSRContextValue {
  return useContext(SSRContext);
}
