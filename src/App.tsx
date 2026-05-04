import { type ParentProps, Show, Suspense } from "solid-js";
import { A } from "@solidjs/router";
import { MetaProvider, Title, Meta } from "@solidjs/meta";
import { useSSRContext } from "./lib/ssrContext";
import "./styles/global.css";

/**
 * App shell — wraps every route with the meta provider, header, and footer.
 *
 * @solidjs/meta's `<MetaProvider>` lives here so children's `<Title>`/`<Meta>`
 * tags get registered into Solid's `useAssets` registry. On the server those
 * surface in `getAssets()` (called by entry-server.tsx); on the client the
 * provider mounts/unmounts head tags as routes change.
 */
export default function App(props: ParentProps) {
  const ctx = useSSRContext();

  return (
    <MetaProvider>
      <Title>Serial Experiments</Title>
      <Meta name="description" content="Serial Experiments — a private software development company. Notes, projects, experiments." />
      <Meta property="og:site_name" content="Serial Experiments" />
      <Meta property="og:type" content="website" />

      <div class="crt-overlay" aria-hidden="true" />

      <div class="page">
        <header class="site-header">
          <A href="/" class="brand">
            <span class="brand-mark" aria-hidden="true">◢◣</span>
            <span class="brand-name">Serial Experiments</span>
          </A>
          <nav class="site-nav" aria-label="Primary">
            <A href="/posts">posts</A>
            <A href="/projects">projects</A>
            <A href="/tags">tags</A>
            <Show when={ctx.user} fallback={null}>
              <A href="/admin" class="admin-link">admin</A>
            </Show>
          </nav>
        </header>

        <main>
          <Suspense fallback={<p class="loading">…loading…</p>}>
            {props.children}
          </Suspense>
        </main>

        <footer class="site-footer">
          <span>— Serial Experiments · est. 2009 —</span>
        </footer>
      </div>
    </MetaProvider>
  );
}
