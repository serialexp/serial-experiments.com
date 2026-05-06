import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { useSSRContext } from "~/lib/ssrContext";

/**
 * Admin landing. Reached only when the SSR-side gate in `server.ts` has
 * verified a session — a logged-out visitor is 302'd to /login before
 * this page ever renders.
 */
export default function AdminDashboard() {
  const ctx = useSSRContext();
  return (
    <article class="admin">
      <Title>admin — Serial Experiments</Title>
      <h1>admin</h1>
      <p>signed in as <strong>{ctx.user?.username ?? "(unknown)"}</strong></p>

      <ul class="admin-menu">
        <li><A href="/admin/posts">posts</A></li>
        <li><A href="/admin/projects">projects</A></li>
        <li><A href="/admin/uploads">uploads</A></li>
      </ul>

      <form
        method="post"
        action="/api/logout"
        onSubmit={async (e) => {
          e.preventDefault();
          await fetch("/api/logout", { method: "POST", credentials: "include" });
          window.location.href = "/";
        }}
      >
        <button type="submit">sign out</button>
      </form>
    </article>
  );
}
