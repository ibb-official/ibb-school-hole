import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type Database from "better-sqlite3";
import { DEFAULT_CATEGORIES } from "../src/data/categories";
import {
  assertFeatureEnabled,
  ConfigError,
  FeatureLockedError,
  getPublicSystemStatus,
  getRuntimeConfig,
} from "../src/lib/config";
import { createMemoryDatabase, setDbForTesting } from "../src/lib/db";
import {
  authenticateUser,
  createComment,
  createPost,
  createReport,
  getForumStats,
  getPostDetail,
  getSessionUser,
  listPosts,
  registerUser,
  revokeSession,
  ServiceError,
} from "../src/lib/forum-service";
import {
  inspectContentCompliance,
  normalizePlainText,
} from "../src/lib/moderation/privacy-filter";
import { issueFormTimingToken } from "../src/lib/security/antibot";
import { verifyCsrfRequest } from "../src/lib/security/csrf";
import { extractClientIp, hashClientIp } from "../src/lib/security/ip";

const ENV_KEYS = [
  "NODE_ENV",
  "FEATURE_AUTH_ENABLED",
  "FEATURE_POSTING_ENABLED",
  "SESSION_SECRET",
  "ANONYMOUS_HMAC_SECRET",
  "IP_HASH_SALT",
  "FORM_SIGNING_SECRET",
  "TRUST_PROXY_HEADERS",
  "CAPTCHA_PROVIDER",
  "AI_MODERATION_PROVIDER",
] as const;

let savedEnv: Record<string, string | undefined> = {};
let db: Database.Database;

function saveAndResetEnv() {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
}

function makeCtx(ip: string, nowMs: number) {
  return {
    ipHash: hashClientIp(ip),
    userAgentHash: "ua-test-hash",
    nowMs,
  };
}

describe("ibb-school-hole security, gates, anti-abuse and anonymous isolation", () => {
  beforeEach(() => {
    saveAndResetEnv();
    delete process.env.FEATURE_AUTH_ENABLED;
    delete process.env.FEATURE_POSTING_ENABLED;
    delete process.env.TRUST_PROXY_HEADERS;
    process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
    process.env.ANONYMOUS_HMAC_SECRET = "test-anon-hmac-secret-0123456789abcdef";
    process.env.IP_HASH_SALT = "test-ip-hash-salt-0123456789abcdef";
    process.env.FORM_SIGNING_SECRET = "test-form-signing-secret-0123456789ab";

    db = createMemoryDatabase();
    setDbForTesting(db);
  });

  afterEach(() => {
    setDbForTesting(null);
    db.close();
    restoreEnv();
  });

  it("enforces default locked phase-1 gates and keeps zero users/posts", () => {
    assert.throws(
      () => assertFeatureEnabled("auth"),
      (err: unknown) =>
        err instanceof FeatureLockedError &&
        err.status === 403 &&
        err.code === "FEATURE_LOCKED"
    );

    assert.throws(
      () => assertFeatureEnabled("posting"),
      (err: unknown) =>
        err instanceof FeatureLockedError &&
        err.status === 403 &&
        err.code === "FEATURE_LOCKED"
    );

    const status = getPublicSystemStatus();
    assert.equal(status.authEnabled, false);
    assert.equal(status.postingEnabled, false);
    assert.equal(status.captchaReady, false);
    assert.equal(status.aiModerationReady, false);

    const stats = getForumStats(db);
    assert.equal(stats.userCount, 0);
    assert.equal(stats.postCount, 0);
    assert.equal(stats.commentCount, 0);

    const catCount = (
      db.prepare("SELECT COUNT(*) AS cnt FROM categories").get() as { cnt: number }
    ).cnt;
    assert.equal(catCount, DEFAULT_CATEGORIES.length);
  });

  it("refuses starting with missing secrets in production when feature gates are enabled", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.FEATURE_AUTH_ENABLED = "true";
    delete process.env.SESSION_SECRET;

    assert.throws(
      () => getRuntimeConfig(),
      (err: unknown) => err instanceof ConfigError && err.status === 500
    );

    process.env.SESSION_SECRET = "prod-strong-session-secret-0123456789";
    const cfg = getRuntimeConfig();
    assert.equal(cfg.authEnabled, true);
  });

  it("extracts proxy client IP only when TRUST_PROXY_HEADERS=true and verifies CSRF headers", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.45",
      "x-real-ip": "203.0.113.45",
    });

    assert.equal(extractClientIp(headers), "127.0.0.1");
    process.env.TRUST_PROXY_HEADERS = "true";
    assert.equal(extractClientIp(headers), "203.0.113.45");

    const badReq = new Request("https://hole.bj166zx.cn/api/posts", {
      method: "POST",
      headers: {
        host: "hole.bj166zx.cn",
        origin: "https://evil.example.com",
        "x-requested-with": "ibb-hole-web",
      },
    });
    assert.equal(verifyCsrfRequest(badReq).ok, false);

    const goodReq = new Request("https://hole.bj166zx.cn/api/posts", {
      method: "POST",
      headers: {
        host: "hole.bj166zx.cn",
        origin: "https://hole.bj166zx.cn",
        "x-requested-with": "ibb-hole-web",
      },
    });
    assert.equal(verifyCsrfRequest(goodReq).ok, true);
  });

  it("supports username-only and optional-email registration, scrypt hashing, session hashing, anti-bot and IP quotas", async () => {
    const t0 = 1_760_000_000_000;
    const token = issueFormTimingToken(t0);

    // 1. Honeypot trap
    await assert.rejects(
      () =>
        registerUser(
          db,
          {
            username: "bot_user",
            password: "Password123!",
            agreedRules: true,
            websiteHoneypot: "https://spam.invalid",
            formIssuedAt: token.issuedAt,
            formSig: token.sig,
          },
          makeCtx("198.51.100.1", t0 + 5000)
        ),
      (err: unknown) =>
        err instanceof ServiceError && err.code === "HONEYPOT_TRIGGERED"
    );

    // 2. Too fast (<2.5s) submission
    await assert.rejects(
      () =>
        registerUser(
          db,
          {
            username: "fast_user",
            password: "Password123!",
            agreedRules: true,
            formIssuedAt: token.issuedAt,
            formSig: token.sig,
          },
          makeCtx("198.51.100.1", t0 + 500)
        ),
      (err: unknown) =>
        err instanceof ServiceError && err.code === "SUBMITTED_TOO_FAST"
    );

    // 3. Student ID / pure-digit username blocked
    await assert.rejects(
      () =>
        registerUser(
          db,
          {
            username: "20260101",
            password: "Password123!",
            agreedRules: true,
            formIssuedAt: token.issuedAt,
            formSig: token.sig,
          },
          makeCtx("198.51.100.1", t0 + 5000)
        ),
      (err: unknown) =>
        err instanceof ServiceError && err.code === "INVALID_USERNAME"
    );

    // 4. Official impersonation blocked
    await assert.rejects(
      () =>
        registerUser(
          db,
          {
            username: "一六六官方通知",
            password: "Password123!",
            agreedRules: true,
            formIssuedAt: token.issuedAt,
            formSig: token.sig,
          },
          makeCtx("198.51.100.1", t0 + 5000)
        ),
      (err: unknown) =>
        err instanceof ServiceError && err.code === "INVALID_USERNAME"
    );

    // 5. Username-only registration (email omitted) succeeds
    const regA = await registerUser(
      db,
      {
        username: "CampusReader",
        email: null,
        password: "StrongPass99!",
        agreedRules: true,
        formIssuedAt: token.issuedAt,
        formSig: token.sig,
      },
      makeCtx("198.51.100.10", t0 + 5000)
    );
    assert.equal(regA.user.username, "CampusReader");
    assert.equal(regA.user.hasBoundEmail, false);

    // Verify password is scrypt hashed & session token is hashed in DB
    const storedUser = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(regA.user.id) as { password_hash: string };
    assert.match(storedUser.password_hash, /^scrypt\$N=16384/);
    const storedSession = db
      .prepare("SELECT token_hash FROM sessions WHERE user_id = ?")
      .get(regA.user.id) as { token_hash: string };
    assert.notEqual(storedSession.token_hash, regA.rawSessionToken);

    // 6. Registration with optional bound email succeeds
    const regB = await registerUser(
      db,
      {
        username: "StudyBuddy",
        email: "Buddy@Example.COM",
        password: "StrongPass88!",
        agreedRules: true,
        formIssuedAt: token.issuedAt,
        formSig: token.sig,
      },
      makeCtx("198.51.100.10", t0 + 6000)
    );
    assert.equal(regB.user.hasBoundEmail, true);

    // 7. 3rd registration from same IP within 1 hour hits rate limit
    await assert.rejects(
      () =>
        registerUser(
          db,
          {
            username: "ThirdUser",
            password: "StrongPass77!",
            agreedRules: true,
            formIssuedAt: token.issuedAt,
            formSig: token.sig,
          },
          makeCtx("198.51.100.10", t0 + 7000)
        ),
      (err: unknown) =>
        err instanceof ServiceError &&
        err.status === 429 &&
        err.code === "RATE_LIMITED"
    );
  });

  it("defends against password brute force with exponential lockout and uniform invalid-user responses", async () => {
    const t0 = 1_760_000_000_000;
    const token = issueFormTimingToken(t0);

    await registerUser(
      db,
      {
        username: "TargetStudent",
        email: "target@example.com",
        password: "CorrectHorse99!",
        agreedRules: true,
        formIssuedAt: token.issuedAt,
        formSig: token.sig,
      },
      makeCtx("203.0.113.2", t0 + 5000)
    );

    // Non-existent account error message matches wrong password message
    await assert.rejects(
      () =>
        authenticateUser(
          db,
          {
            identifier: "nobody_here",
            password: "SomePassword1!",
            formIssuedAt: token.issuedAt,
            formSig: token.sig,
          },
          makeCtx("203.0.113.3", t0 + 6000)
        ),
      (err: unknown) =>
        err instanceof ServiceError &&
        err.status === 401 &&
        err.message === "用户名/邮箱或密码错误。"
    );

    // 4 wrong password attempts from rotating IPs -> 401
    for (let i = 1; i <= 4; i++) {
      await assert.rejects(
        () =>
          authenticateUser(
            db,
            {
              identifier: "targetstudent",
              password: "WrongPassword1!",
              formIssuedAt: token.issuedAt,
              formSig: token.sig,
            },
            makeCtx(`203.0.113.${10 + i}`, t0 + 6000 + i * 1000)
          ),
        (err: unknown) => err instanceof ServiceError && err.status === 401
      );
    }

    // 5th wrong attempt triggers account lockout (429 ACCOUNT_LOCKED)
    await assert.rejects(
      () =>
        authenticateUser(
          db,
          {
            identifier: "targetstudent",
            password: "WrongPassword1!",
            formIssuedAt: token.issuedAt,
            formSig: token.sig,
          },
          makeCtx("203.0.113.20", t0 + 15000)
        ),
      (err: unknown) =>
        err instanceof ServiceError &&
        err.status === 429 &&
        err.code === "ACCOUNT_LOCKED" &&
        (err.retryAfterSeconds ?? 0) >= 59
    );

    // After lockout window expires (65s later), login via bound email succeeds and revocable session works
    const loginRes = await authenticateUser(
      db,
      {
        identifier: "TARGET@example.com",
        password: "CorrectHorse99!",
        formIssuedAt: token.issuedAt,
        formSig: token.sig,
      },
      makeCtx("203.0.113.21", t0 + 80_000)
    );
    assert.equal(loginRes.user.username, "TargetStudent");
    assert.ok(getSessionUser(db, loginRes.rawSessionToken, t0 + 81_000));
    revokeSession(db, loginRes.rawSessionToken, t0 + 82_000);
    assert.equal(getSessionUser(db, loginRes.rawSessionToken, t0 + 83_000), null);
  });

  it("blocks privacy leaks in L1 filter and enforces per-post HMAC anonymous isolation without leaking authorId", async () => {
    const t0 = 1_760_000_000_000;
    const token = issueFormTimingToken(t0);

    // Privacy filter unit checks
    assert.equal(inspectContentCompliance("电话联系 13812345678").passed, false);
    assert.equal(inspectContentCompliance("加我微信 wxid_1234567").passed, false);
    assert.equal(inspectContentCompliance("高二(3)班某同学").passed, false);
    assert.equal(
      inspectContentCompliance("今天操场晚霞很漂亮，物理作业第三题大家有思路吗？")
        .passed,
      true
    );
    assert.equal(
      normalizePlainText("第一段\r\n\r\n\r\n第二段  \n\u200B测试"),
      "第一段\n\n第二段\n测试"
    );

    const userA = await registerUser(
      db,
      {
        username: "AuthorAlpha",
        password: "StrongPass11!",
        agreedRules: true,
        formIssuedAt: token.issuedAt,
        formSig: token.sig,
      },
      makeCtx("198.51.100.51", t0 + 5000)
    );

    const userB = await registerUser(
      db,
      {
        username: "ReaderBeta",
        password: "StrongPass22!",
        agreedRules: true,
        formIssuedAt: token.issuedAt,
        formSig: token.sig,
      },
      makeCtx("198.51.100.52", t0 + 5000)
    );

    // Cooldown prevents immediate posting right after registration
    await assert.rejects(
      () =>
        createPost(
          db,
          userA.user,
          {
            categorySlug: "daily",
            title: "刚注册就发帖测试",
            content: "这是一条处于新手冷静期内的测试发帖内容。",
            isAnonymous: false,
          },
          makeCtx("198.51.100.51", t0 + 10_000)
        ),
      (err: unknown) =>
        err instanceof ServiceError && err.code === "NEW_USER_COOLDOWN"
    );

    const afterCooldown = t0 + 6 * 60 * 1000;

    // Anonymous post is forbidden outside treehole category
    await assert.rejects(
      () =>
        createPost(
          db,
          userA.user,
          {
            categorySlug: "daily",
            title: "日常板块尝试匿名",
            content: "在非树洞板块开启匿名应当被服务端明确拒绝。",
            isAnonymous: true,
          },
          makeCtx("198.51.100.51", afterCooldown)
        ),
      (err: unknown) =>
        err instanceof ServiceError && err.code === "ANONYMOUS_NOT_ALLOWED"
    );

    // Create two anonymous posts in treehole
    const post1 = await createPost(
      db,
      userA.user,
      {
        categorySlug: "treehole",
        title: "月考前有点紧张怎么办",
        content: "最近复习节奏有点乱，想听听大家的调整经验。\n\n谢谢每一位回复的同学。",
        isAnonymous: true,
      },
      makeCtx("198.51.100.51", afterCooldown)
    );

    const post2 = await createPost(
      db,
      userA.user,
      {
        categorySlug: "treehole",
        title: "另一个树洞话题测试隔离",
        content: "同一位评论者在不同帖子下应当获得完全不同的匿名编号。",
        isAnonymous: true,
      },
      makeCtx("198.51.100.51", afterCooldown + 70_000)
    );

    // DTO must strip authorId & authorUsername completely
    assert.equal(post1.post.isAnonymous, true);
    assert.equal(post1.post.authorId, null);
    assert.equal(post1.post.authorUsername, null);
    assert.equal(post1.post.authorDisplayName, "洞主");

    // User B comments on post1 twice, and once on post2
    const c1 = await createComment(
      db,
      userB.user,
      post1.post.id,
      { content: "慢慢来，按科列一个小清单会踏实很多。", isAnonymous: true },
      makeCtx("198.51.100.52", afterCooldown + 80_000)
    );
    const c2 = await createComment(
      db,
      userB.user,
      post1.post.id,
      { content: "加油，考前保持睡眠很重要！", isAnonymous: true },
      makeCtx("198.51.100.52", afterCooldown + 100_000)
    );
    const cPost2 = await createComment(
      db,
      userB.user,
      post2.post.id,
      { content: "跨帖匿名代号隔离测试。", isAnonymous: true },
      makeCtx("198.51.100.52", afterCooldown + 120_000)
    );

    // Post author replies on post1 as anonymous -> "洞主"
    const cOwner = await createComment(
      db,
      userA.user,
      post1.post.id,
      { content: "谢谢大家的建议！", isAnonymous: true },
      makeCtx("198.51.100.51", afterCooldown + 125_000)
    );

    assert.equal(c1.comment.authorId, null);
    assert.equal(c1.comment.authorUsername, null);
    assert.match(c1.comment.authorDisplayName, /^匿名同学 #[0-9A-F]{4}$/);
    // Same user in same post keeps identical alias
    assert.equal(c1.comment.authorDisplayName, c2.comment.authorDisplayName);
    // Same user in different post gets different unlinkable alias
    assert.notEqual(
      c1.comment.authorDisplayName,
      cPost2.comment.authorDisplayName
    );
    assert.equal(cOwner.comment.authorDisplayName, "洞主");
    assert.equal(cOwner.comment.isPostAuthor, true);

    const detail = getPostDetail(db, post1.post.id);
    assert.ok(detail);
    assert.equal(detail.post.authorId, null);
    assert.equal(detail.comments.length, 3);
    assert.equal(listPosts(db, { categorySlug: "treehole" }).total, 2);

    const reportRes = createReport(
      db,
      userB.user,
      {
        targetType: "post",
        targetId: post1.post.id,
        reasonCode: "other",
        details: "测试举报记录写入",
      },
      makeCtx("198.51.100.52", afterCooldown + 130_000)
    );
    assert.ok(reportRes.reportId > 0);
  });
});
