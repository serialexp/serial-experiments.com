import { Route } from "@solidjs/router";
import Home from "./pages/Home";
import Posts from "./pages/Posts";
import Post from "./pages/Post";
import Tags from "./pages/Tags";
import TagPosts from "./pages/TagPosts";
import Projects from "./pages/Projects";
import Project from "./pages/Project";
import Search from "./pages/Search";
import Login from "./pages/Login";
import AdminDashboard from "./pages/Admin/Dashboard";
import AdminPosts from "./pages/Admin/Posts";
import AdminPostEdit from "./pages/Admin/PostEdit";
import AdminProjects from "./pages/Admin/Projects";
import AdminProjectEdit from "./pages/Admin/ProjectEdit";
import AdminUploads from "./pages/Admin/Uploads";
import NotFound from "./pages/NotFound";

/**
 * Top-level route table.
 *
 * Routes are imported eagerly. Lazy splitting is tempting for an SPA but
 * interacts badly with our SSR/hydration shape — SolidJS Router's transition
 * machinery + lazy() + a Router root layout left navigation rendering only
 * the URL change, not the new route content. The client bundle is small
 * enough (~50 kB gzipped) that one chunk is fine; revisit if the page set
 * grows by an order of magnitude.
 */
export function AppRoutes() {
  return (
    <>
      <Route path="/" component={Home} />
      <Route path="/posts" component={Posts} />
      <Route path="/posts/:slug" component={Post} />
      <Route path="/tags" component={Tags} />
      <Route path="/tags/:slug" component={TagPosts} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:slug" component={Project} />
      <Route path="/search" component={Search} />
      <Route path="/login" component={Login} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/posts" component={AdminPosts} />
      <Route path="/admin/posts/new" component={AdminPostEdit} />
      <Route path="/admin/posts/:id" component={AdminPostEdit} />
      <Route path="/admin/projects" component={AdminProjects} />
      <Route path="/admin/projects/new" component={AdminProjectEdit} />
      <Route path="/admin/projects/:id" component={AdminProjectEdit} />
      <Route path="/admin/uploads" component={AdminUploads} />
      <Route path="*" component={NotFound} />
    </>
  );
}
