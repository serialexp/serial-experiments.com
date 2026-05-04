-- Initial schema. Applied at server boot by `server/migrations.ts`.
--
-- Conventions:
--  * TEXT timestamps in ISO-8601 UTC ("YYYY-MM-DD HH:MM:SS"), via SQLite's
--    `datetime('now')`. Cheaper to inspect with sqlite3 than int epochs.
--  * `slug` columns are UNIQUE; the URL-shaped identifier.
--  * Foreign keys ON DELETE CASCADE so removing a post takes its tag links
--    with it. Foreign keys must be enabled by the connection (see
--    `server/db.ts`).

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  body_md TEXT NOT NULL,
  body_html TEXT NOT NULL,
  excerpt TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Partial index: published posts ordered by date. Most reads hit this.
CREATE INDEX idx_posts_pub ON posts(published_at DESC) WHERE published_at IS NOT NULL;

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_md TEXT,
  body_html TEXT,
  image_path TEXT,
  link_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_projects_sort ON projects(sort_order, id) WHERE published = 1;

CREATE TABLE uploads (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
