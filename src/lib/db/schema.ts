import type Database from "better-sqlite3";
import { DEFAULT_CATEGORIES } from "@/data/categories";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  allow_anonymous INTEGER NOT NULL DEFAULT 0,
  min_trust_level INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  trust_level INTEGER NOT NULL DEFAULT 0,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip_hash TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  author_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'published',
  moderation_reason TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_comment_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  floor_no INTEGER NOT NULL,
  reply_to_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'published',
  moderation_reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  reason_code TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  actor_user_id INTEGER,
  ip_hash TEXT NOT NULL,
  target TEXT,
  outcome TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires
  ON sessions(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_posts_feed
  ON posts(moderation_status, is_pinned DESC, last_comment_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_category
  ON posts(category_slug, moderation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_post_floor
  ON comments(post_id, floor_no ASC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON security_audit_logs(created_at DESC);
`;

export function migrateDatabase(db: Database.Database): void {
  db.exec(SCHEMA_SQL);

  const upsertCategory = db.prepare(`
    INSERT INTO categories (
      slug, name, description, accent_color, allow_anonymous, min_trust_level, sort_order
    ) VALUES (
      @slug, @name, @description, @accentColor, @allowAnonymous, @minTrustLevel, @sortOrder
    )
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      accent_color = excluded.accent_color,
      allow_anonymous = excluded.allow_anonymous,
      min_trust_level = excluded.min_trust_level,
      sort_order = excluded.sort_order
  `);

  const syncCategories = db.transaction(() => {
    for (const category of DEFAULT_CATEGORIES) {
      upsertCategory.run({
        slug: category.slug,
        name: category.name,
        description: category.description,
        accentColor: category.accentColor,
        allowAnonymous: category.allowAnonymous ? 1 : 0,
        minTrustLevel: category.minTrustLevel,
        sortOrder: category.sortOrder,
      });
    }
  });

  syncCategories();
}
