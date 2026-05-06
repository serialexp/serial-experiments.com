import { createResource, For, Show, Suspense } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { loadProjectsList } from "~/lib/data";

/**
 * Project gallery — visual break from the otherwise text-only blog.
 *
 * Cards link to:
 *  - the in-site detail page if the project has body content (`has_body`),
 *  - or directly to `link_url` (external) when there's no detail to read.
 */
export default function Projects() {
  const [items] = createResource(loadProjectsList);

  return (
    <article class="projects">
      <Title>projects — Serial Experiments</Title>
      <Meta name="description" content="Projects and experiments built at Serial Experiments." />

      <h1>projects</h1>

      <Suspense fallback={<p class="loading">…loading…</p>}>
        <Show when={items()?.length} fallback={<p class="empty">— nothing yet —</p>}>
          <ul class="project-grid">
            <For each={items()}>
              {(p) => (
                <li class="project-card">
                  <ProjectCardLink p={p}>
                    <Show when={p.image_path}>
                      <img class="project-img" src={p.image_path!} alt="" loading="lazy" />
                    </Show>
                    <h2>{p.title}</h2>
                    <p class="summary">{p.summary}</p>
                    <Show when={p.link_url}>
                      <p class="ext">{externalHost(p.link_url!)}</p>
                    </Show>
                  </ProjectCardLink>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Suspense>
    </article>
  );
}

/**
 * Decide where the card click lands. The detail page is preferred when
 * available; falls back to the external link, then to nothing (read-only
 * card). All branches render the same children.
 */
function ProjectCardLink(props: {
  p: { slug: string; link_url: string | null; has_body: number };
  children: import("solid-js").JSX.Element;
}) {
  if (props.p.has_body) {
    return <A href={`/projects/${props.p.slug}`}>{props.children}</A>;
  }
  if (props.p.link_url) {
    return (
      <a href={props.p.link_url} target="_blank" rel="noreferrer">
        {props.children}
      </a>
    );
  }
  return <div class="project-static">{props.children}</div>;
}

function externalHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
