import { type ParentProps, Show, Suspense } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { MetaProvider, Title, Meta } from "@solidjs/meta";
import { useSSRContext } from "./lib/ssrContext";
import logo1x from "./assets/logo-64.png";
import logo2x from "./assets/logo-128.png";
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
  const loc = useLocation();

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
            <img
              class="brand-mark"
              src={logo1x}
              srcset={`${logo1x} 1x, ${logo2x} 2x`}
              width="32"
              height="32"
              alt=""
              aria-hidden="true"
            />
            <span class="brand-name">Serial Experiments</span>
          </A>
          <nav class="site-nav" aria-label="Primary">
            <A href="/posts">posts</A>
            <A href="/projects">projects</A>
            <A href="/tags">tags</A>
            <A href="/search">search</A>
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
          <span class="footer-sep"> · </span>
          <a href="/feed.xml">feed</a>
          <span class="footer-sep"> · </span>
          <span style={{ "font-family": "monospace", "font-size": "0.8rem", opacity: "0.6" }}>
            [route: {loc.pathname}]
          </span>
        </footer>
      </div>
    </MetaProvider>
  );
}
