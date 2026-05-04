-- Full-text search over posts.
--
-- FTS5 contentless-style virtual table backed by the `posts` table. We keep
-- it in sync via triggers so writes never have to remember to update FTS.
-- Queries: `SELECT posts.* FROM posts JOIN posts_fts ON posts_fts.rowid =
-- posts.id WHERE posts_fts MATCH ?`.

CREATE VIRTUAL TABLE posts_fts USING fts5(
  title,
  body_md,
  content='posts',
  content_rowid='id'
);

CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, body_md) VALUES (new.id, new.title, new.body_md);
END;

CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, body_md)
    VALUES ('delete', old.id, old.title, old.body_md);
END;

CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, body_md)
    VALUES ('delete', old.id, old.title, old.body_md);
  INSERT INTO posts_fts(rowid, title, body_md)
    VALUES (new.id, new.title, new.body_md);
END;
