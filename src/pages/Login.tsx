import { createSignal, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";

/**
 * Login page. POSTs to /api/login; on success navigates to the redirect
 * target (or /admin) and reloads so the SSR re-runs with the new session
 * cookie picked up — that way the rest of the app sees `user` populated
 * everywhere on the next render.
 */
export default function Login() {
  const [params] = useSearchParams<{ redirect?: string }>();
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username(), password: password() }),
      });
      if (res.status === 401) {
        setError("invalid credentials");
        return;
      }
      if (!res.ok) {
        setError(`login failed (${res.status})`);
        return;
      }
      // Hard nav so the browser sends the new cookie on the next render
      // and SSR sees the authenticated user, hydration sees the right
      // bootstrap blob, etc.
      const target = params.redirect || "/admin";
      window.location.href = target;
    } catch {
      setError("network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article class="login">
      <Title>login — Serial Experiments</Title>
      <h1>login</h1>

      <form onSubmit={submit}>
        <label>
          <span>username</span>
          <input
            type="text"
            autocomplete="username"
            required
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
        </label>
        <label>
          <span>password</span>
          <input
            type="password"
            autocomplete="current-password"
            required
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </label>
        <Show when={error()}>
          <p class="error" role="alert">{error()}</p>
        </Show>
        <button type="submit" disabled={busy()}>
          {busy() ? "…" : "sign in"}
        </button>
      </form>

      <p class="hint">
        — auth is for the site owner. nothing here for visitors. —
      </p>

      <p>
        <a href="/">back</a>
      </p>
    </article>
  );
}
