import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { createMemoryDatabase, setDbForTesting } from "../src/lib/db";
import { hashSessionToken, ServiceError, type PublicUserDto } from "../src/lib/forum-service";
import { listModerationQueue, listOwnSubmissions, moderateContent } from "../src/lib/moderation-service";
import { GET as getModeration, POST as postModeration } from "../src/app/api/moderation/route";
import { GET as getSubmissions } from "../src/app/api/auth/submissions/route";
import { POST as postReport } from "../src/app/api/reports/route";

let db: Database.Database;
const now = Date.now();
const ctx = { ipHash: "test-hash", userAgentHash: "test-agent", nowMs: now };
const user = (id: number, role = "user"): PublicUserDto => ({ id, username: `user${id}`, hasBoundEmail: false, role, status: "active", trustLevel: 0, createdAt: now - 100000 });
const req = (url: string, token: string, body?: unknown, validOrigin = true) => new NextRequest(`http://localhost${url}`, {
  method: body === undefined ? "GET" : "POST",
  headers: { host: "localhost", origin: validOrigin ? "http://localhost" : "https://bad.example", cookie: `ibb_hole_session=${token}`,
    "x-requested-with": "ibb-hole-web", "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("moderation and reporting boundaries", () => {
  beforeEach(() => {
    db = createMemoryDatabase();
    setDbForTesting(db);
    const insertUser = db.prepare("INSERT INTO users (id,username,username_normalized,password_hash,role,status,created_at,updated_at) VALUES (?,?,?,'dummy',?,'active',?,?)");
    for (const [id, role] of [[1,"user"],[2,"user"],[3,"moderator"]] as const) {
      insertUser.run(id, `user${id}`, `user${id}`, role, now - 100000, now - 100000);
      db.prepare("INSERT INTO sessions (id,user_id,token_hash,ip_hash,user_agent_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,?)")
        .run(`session${id}`, id, hashSessionToken(`token${id}`.padEnd(64, "x")), "hash", "ua", now + 1000000, now);
    }
    db.prepare(`INSERT INTO posts (id,category_slug,author_id,title,content,is_anonymous,moderation_status,created_at,updated_at,last_comment_at,comment_count)
      VALUES (1,'daily',1,'待审帖子','作者自己的待审核帖子',0,'pending_review',?,?,?,0),
             (2,'daily',2,'公开帖子','公开正文',0,'published',?,?,?,1),
             (3,'daily',2,'隐私帖子','不可向其他人透露',1,'hidden',?,?,?,0)`)
      .run(now - 5000, now - 5000, now - 5000, now - 4000, now - 4000, now - 1000, now - 3000, now - 3000, now - 3000);
    db.prepare(`INSERT INTO comments (id,post_id,author_id,floor_no,content,is_anonymous,moderation_status,created_at)
      VALUES (1,2,1,1,'待审评论',0,'pending_review',?),
             (2,2,2,2,'已发布评论',0,'published',?),
             (3,3,1,1,'隐藏帖下自己的评论',0,'published',?)`).run(now - 2000, now - 1000, now - 500);
  });
  afterEach(() => { setDbForTesting(null); db.close(); });

  it("enforces role checks at the HTTP boundary and on mutations", async () => {
    const ordinaryToken = "token1".padEnd(64, "x");
    const moderatorToken = "token3".padEnd(64, "x");
    const denied = await getModeration(req("/api/moderation", ordinaryToken));
    assert.equal(denied.status, 403);
    const deniedPost = await postModeration(req("/api/moderation", ordinaryToken, { action: "approve", targetType: "post", targetId: 1 }));
    assert.equal(deniedPost.status, 403);
    const csrf = await postModeration(req("/api/moderation", moderatorToken, { action: "approve", targetType: "post", targetId: 1 }, false));
    assert.equal(csrf.status, 403);
    const allowed = await getModeration(req("/api/moderation", moderatorToken));
    assert.equal(allowed.status, 200);
    const data = await allowed.json();
    assert.deepEqual(data.pending.map((item: { id: number; targetType: string }) => `${item.targetType}:${item.id}`).sort(), ["comment:1", "post:1"]);
    assert.throws(() => moderateContent(db, user(1), { action: "approve", targetType: "post", targetId: 1 }, ctx), (e: unknown) => e instanceof ServiceError && e.status === 403);
    db.prepare("UPDATE users SET role='user' WHERE id=3").run();
    assert.throws(() => moderateContent(db, user(3, "moderator"), { action: "approve", targetType: "post", targetId: 1 }, ctx), (e: unknown) => e instanceof ServiceError && e.status === 403);
  });

  it("updates moderation state, audit, counts and activity atomically", () => {
    const moderator = user(3, "moderator");
    moderateContent(db, moderator, { action: "approve", targetType: "comment", targetId: 1 }, ctx);
    let post = db.prepare("SELECT comment_count,last_comment_at FROM posts WHERE id=2").get() as { comment_count: number; last_comment_at: number };
    assert.equal(post.comment_count, 2);
    assert.equal(post.last_comment_at, now - 1000);
    moderateContent(db, moderator, { action: "hide", targetType: "comment", targetId: 2, reason: "违规" }, ctx);
    post = db.prepare("SELECT comment_count,last_comment_at FROM posts WHERE id=2").get() as typeof post;
    assert.equal(post.comment_count, 1);
    assert.equal(post.last_comment_at, now - 2000);
    moderateContent(db, moderator, { action: "restore", targetType: "comment", targetId: 2 }, ctx);
    assert.equal((db.prepare("SELECT comment_count FROM posts WHERE id=2").get() as { comment_count: number }).comment_count, 2);
    assert.throws(() => moderateContent(db, moderator, { action: "approve", targetType: "comment", targetId: 1 }, ctx), (e: unknown) => e instanceof ServiceError && e.status === 409);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM security_audit_logs WHERE event_type LIKE 'moderation.%'").get() as { n: number }).n, 3);
  });

  it("suspends an account without leaving its identity in public content", () => {
    const moderator = user(3, "moderator");
    moderateContent(db, moderator, { action: "suspend_user", targetId: 2, reason: "昵称泄露隐私" }, ctx);
    assert.equal((db.prepare("SELECT status FROM users WHERE id=2").get() as { status: string }).status, "suspended");
    assert.equal((db.prepare("SELECT moderation_status FROM posts WHERE id=2").get() as { moderation_status: string }).moderation_status, "hidden");
    assert.equal((db.prepare("SELECT moderation_status FROM comments WHERE id=2").get() as { moderation_status: string }).moderation_status, "hidden");
    assert.equal((db.prepare("SELECT revoked_at FROM sessions WHERE user_id=2").get() as { revoked_at: number }).revoked_at, now);
    assert.throws(() => moderateContent(db, moderator, { action: "restore", targetType: "post", targetId: 2 }, ctx), (e: unknown) => e instanceof ServiceError && e.code === "AUTHOR_SUSPENDED");
    assert.throws(() => moderateContent(db, moderator, { action: "suspend_user", targetId: 3 }, ctx), (e: unknown) => e instanceof ServiceError && e.code === "FORBIDDEN");
    moderateContent(db, moderator, { action: "unsuspend_user", targetId: 2 }, ctx);
    assert.equal((db.prepare("SELECT moderation_status FROM posts WHERE id=2").get() as { moderation_status: string }).moderation_status, "hidden");
    moderateContent(db, moderator, { action: "restore", targetType: "post", targetId: 2 }, ctx);
    moderateContent(db, moderator, { action: "restore", targetType: "comment", targetId: 2 }, ctx);
    assert.equal((db.prepare("SELECT comment_count FROM posts WHERE id=2").get() as { comment_count: number }).comment_count, 1);
  });

  it("only exposes an authenticated user's own submissions", async () => {
    const own = listOwnSubmissions(db, user(1));
    assert.equal(own.length, 3);
    assert.ok(!JSON.stringify(own).includes("隐私帖子"));
    const hiddenParentComment = own.find(item => item.targetType === "comment" && item.id === 3);
    assert.equal(hiddenParentComment?.title, "原帖暂不可见");
    assert.equal(hiddenParentComment?.postId, null);
    const response = await getSubmissions(req("/api/auth/submissions?userId=2", "token1".padEnd(64, "x")));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(!JSON.stringify(payload).includes("不可向其他人透露"));
  });

  it("accepts reports while posting is closed and only for public targets", async () => {
    const previous = process.env.FEATURE_POSTING_ENABLED;
    process.env.FEATURE_POSTING_ENABLED = "false";
    try {
      const token = "token1".padEnd(64, "x");
      const visible = await postReport(req("/api/reports", token, { targetType: "post", targetId: 2, reasonCode: "other" }));
      assert.equal(visible.status, 201);
      const hidden = await postReport(req("/api/reports", token, { targetType: "post", targetId: 3, reasonCode: "other" }));
      assert.equal(hidden.status, 404);
      const hiddenComment = await postReport(req("/api/reports", token, { targetType: "comment", targetId: 3, reasonCode: "other" }));
      assert.equal(hiddenComment.status, 404);
      const queue = listModerationQueue(db, user(3, "moderator"));
      assert.equal(queue.reports.length, 1);
      moderateContent(db, user(3, "moderator"), { action: "resolve_report", targetId: queue.reports[0].id }, ctx);
      assert.equal(listModerationQueue(db, user(3, "moderator")).reports.length, 0);
    } finally {
      if (previous === undefined) delete process.env.FEATURE_POSTING_ENABLED;
      else process.env.FEATURE_POSTING_ENABLED = previous;
    }
  });
});
