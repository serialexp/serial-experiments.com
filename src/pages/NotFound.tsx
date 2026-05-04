import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <article class="not-found">
      <Title>404 — Serial Experiments</Title>
      <h1>404</h1>
      <p>This is not the page you are looking for.</p>
      <p>
        <A href="/">back home</A>
      </p>
    </article>
  );
}
