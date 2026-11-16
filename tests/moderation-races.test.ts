import assert from "node:assert/strict";
import { it } from "node:test";
import { createMemoryDatabase } from "../src/lib/db";
import { FeatureLockedError } from "../src/lib/config";
import { createComment, createPost, hashSessionToken, ServiceError, type PublicUserDto } from "../src/lib/forum-service";

it("does not publish in-flight content after its author or parent post is hidden", async () => {
  const db = createMemoryDatabase();
  const now = Date.now();
  const user: PublicUserDto = { id: 1, username: "Writer", hasBoundEmail: false, role: "user", status: "active", trustLevel: 0, createdAt: now - 600_000 };
  const ctx = { ipHash: "test-ip", userAgentHash: "test-agent", nowMs: now };
  db.prepare("INSERT INTO users (id, username, username_normalized, password_hash, created_at, updated_at) VALUES (1, 'Writer', 'writer', 'hash', ?, ?)").run(user.createdAt, user.createdAt);
  db.prepare(`INSERT INTO posts (id, category_slug, author_id, title, content, moderation_status, created_at, updated_at, last_comment_at)
    VALUES (1, 'daily', 1, '公开测试帖子', '一篇用于隔离测试的公开帖子。', 'published', ?, ?, ?)`).run(now, now, now);

  const env = process.env as Record<string, string | undefined>;
  const keys = ["AI_MODERATION_PROVIDER", "AI_MODERATION_API_URL", "AI_MODERATION_API_KEY"];
  const saved = Object.fromEntries(keys.map((key) => [key, env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(env, { AI_MODERATION_PROVIDER: "openai_compatible", AI_MODERATION_API_URL: "https://moderation.example.test", AI_MODERATION_API_KEY: "test" });
  try {
    globalThis.fetch = async () => {
      db.prepare("UPDATE users SET status = 'suspended' WHERE id = 1").run();
      return Response.json({ choices: [{ message: { content: '{"decision":"pass","reason":"ok"}' } }] });
    };
    await assert.rejects(
      createPost(db, user, { categorySlug: "daily", title: "一篇新的测试帖子", content: "这是一篇用于验证审核竞态的测试内容。" }, ctx),
      (error: unknown) => error instanceof ServiceError && error.code === "UNAUTHORIZED"
    );
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM posts").get() as { n: number }).n, 1);

    db.prepare("UPDATE users SET status = 'active' WHERE id = 1").run();
    globalThis.fetch = async () => {
      db.prepare("UPDATE posts SET moderation_status = 'hidden' WHERE id = 1").run();
      return Response.json({ choices: [{ message: { content: '{"decision":"pass","reason":"ok"}' } }] });
    };
    await assert.rejects(
      createComment(db, user, 1, { content: "这是一条测试评论。" }, ctx),
      (error: unknown) => error instanceof ServiceError && error.code === "POST_NOT_FOUND"
    );
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM comments").get() as { n: number }).n, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
    db.close();
  }
});

it("rechecks the session and active moderator after asynchronous moderation", async () => {
  const db = createMemoryDatabase();
  const now = Date.now();
  const user: PublicUserDto = { id: 1, username: "Writer", hasBoundEmail: false, role: "user", status: "active", trustLevel: 0, createdAt: now - 600_000 };
  const tokenHash = hashSessionToken("test-token".padEnd(64, "x"));
  db.prepare("INSERT INTO users (id, username, username_normalized, password_hash, role, created_at, updated_at) VALUES (1, 'Writer', 'writer', 'hash', 'user', ?, ?), (2, 'Reviewer', 'reviewer', 'hash', 'moderator', ?, ?)")
    .run(user.createdAt, user.createdAt, user.createdAt, user.createdAt);
  db.prepare("INSERT INTO sessions (id,user_id,token_hash,ip_hash,user_agent_hash,expires_at,created_at) VALUES ('s',1,?,'ip','ua',?,?)")
    .run(tokenHash, now + 60_000, now);
  const env = process.env as Record<string, string | undefined>;
  const values = {
    NODE_ENV: "production", FEATURE_POSTING_ENABLED: "true",
    SESSION_SECRET: "s".repeat(40), ANONYMOUS_HMAC_SECRET: "a".repeat(40), IP_HASH_SALT: "i".repeat(40),
    AI_MODERATION_PROVIDER: "openai_compatible", AI_MODERATION_API_URL: "https://moderation.example.test", AI_MODERATION_API_KEY: "test",
  };
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(env, values);
  const ctx = { ipHash: "test-ip", userAgentHash: "test-agent", sessionTokenHash: tokenHash, nowMs: now };
  const input = { categorySlug: "daily", title: "一篇新的测试帖子", content: "这是一篇用于验证审核竞态的测试内容。" };
  try {
    globalThis.fetch = async () => {
      db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = 's'").run(now);
      return Response.json({ choices: [{ message: { content: '{"decision":"pass","reason":"ok"}' } }] });
    };
    await assert.rejects(createPost(db, user, input, ctx), (error: unknown) => error instanceof ServiceError && error.code === "UNAUTHORIZED");
    db.prepare("UPDATE sessions SET revoked_at = NULL WHERE id = 's'").run();
    globalThis.fetch = async () => {
      db.prepare("UPDATE users SET role = 'user' WHERE id = 2").run();
      return Response.json({ choices: [{ message: { content: '{"decision":"pass","reason":"ok"}' } }] });
    };
    await assert.rejects(createPost(db, user, input, ctx), FeatureLockedError);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM posts").get() as { n: number }).n, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    db.close();
  }
});

it("does not spend posting intervals on invalid or rejected input", async () => {
  const db = createMemoryDatabase();
  const now = Date.now();
  const user: PublicUserDto = { id: 1, username: "Writer", hasBoundEmail: false, role: "user", status: "active", trustLevel: 0, createdAt: now - 600_000 };
  const ctx = { ipHash: "ip", userAgentHash: "ua", nowMs: now };
  const env = process.env as Record<string, string | undefined>;
  const oldProvider = env.AI_MODERATION_PROVIDER;
  env.AI_MODERATION_PROVIDER = "disabled";
  db.prepare("INSERT INTO users (id,username,username_normalized,password_hash,created_at,updated_at) VALUES (1,'Writer','writer','hash',?,?)").run(user.createdAt, user.createdAt);
  try {
    const base = { categorySlug: "daily", title: "一篇测试帖子", content: "这是用于验证间隔限制的有效内容。" };
    await assert.rejects(createPost(db, user, { ...base, title: "短" }, ctx), (error: unknown) => error instanceof ServiceError && error.code === "INVALID_TITLE");
    await assert.rejects(createPost(db, user, { ...base, content: "这段内容包含去死吧一类禁发词语。" }, ctx), (error: unknown) => error instanceof ServiceError && error.code === "MODERATION_REJECTED");
    const post = await createPost(db, user, base, ctx);
    await assert.rejects(createComment(db, user, post.post.id, { content: "短" }, ctx), (error: unknown) => error instanceof ServiceError && error.code === "INVALID_COMMENT");
    await assert.rejects(createComment(db, user, post.post.id, { content: "去死吧" }, ctx), (error: unknown) => error instanceof ServiceError && error.code === "MODERATION_REJECTED");
    const comment = await createComment(db, user, post.post.id, { content: "这是一条有效回复。" }, ctx);
    assert.equal(comment.moderationAction, "publish");
    await assert.rejects(createComment(db, user, post.post.id, { content: "再次回复。" }, ctx), (error: unknown) => error instanceof ServiceError && error.code === "RATE_LIMITED");
  } finally {
    if (oldProvider === undefined) delete env.AI_MODERATION_PROVIDER;
    else env.AI_MODERATION_PROVIDER = oldProvider;
    db.close();
  }
});
