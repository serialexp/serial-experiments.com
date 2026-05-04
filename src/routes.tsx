import { Route } from "@solidjs/router";
import { lazy } from "solid-js";

const Home = lazy(() => import("./pages/Home"));
const Posts = lazy(() => import("./pages/Posts"));
const Post = lazy(() => import("./pages/Post"));
const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/Admin/Dashboard"));
const AdminPosts = lazy(() => import("./pages/Admin/Posts"));
const AdminPostEdit = lazy(() => import("./pages/Admin/PostEdit"));
const NotFound = lazy(() => import("./pages/NotFound"));

/**
 * Top-level route table.
 *
 * Each page is `lazy()`-imported so the client bundle splits cleanly per
 * route. SolidJS's SSR walks the matching route synchronously during
 * `renderToStringAsync`, awaiting the lazy import + any resources it
 * spawns before producing HTML.
 */
export function AppRoutes() {
  return (
    <>
      <Route path="/" component={Home} />
      <Route path="/posts" component={Posts} />
      <Route path="/posts/:slug" component={Post} />
      <Route path="/login" component={Login} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/posts" component={AdminPosts} />
      <Route path="/admin/posts/new" component={AdminPostEdit} />
      <Route path="/admin/posts/:id" component={AdminPostEdit} />
      <Route path="*" component={NotFound} />
    </>
  );
}
