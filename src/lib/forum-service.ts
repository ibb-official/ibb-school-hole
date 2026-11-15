import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { getCategoryBySlug, REPORT_REASONS } from "@/data/categories";
import {
  serializeCommentDto,
  serializePostDto,
  type CommentRowForDto,
  type PostRowForDto,
  type PublicCommentDto,
  type PublicPostDto,
} from "@/lib/anonymous";
import { getRuntimeConfig } from "@/lib/config";
import {
  runModerationPipeline,
} from "@/lib/moderation/pipeline";
import {
  normalizePlainText,
  type ComplianceIssue,
} from "@/lib/moderation/privacy-filter";
import { verifyAntiBotSignals } from "@/lib/security/antibot";
import { recordSecurityAudit } from "@/lib/security/audit";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import {
  hashPassword,
  validatePasswordStrength,
  verifyDummyPassword,
  verifyPassword,
} from "@/lib/security/password";
import {
  calculateAccountLockoutMs,
  clearRateLimitBucket,
  consumeRateLimit,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";
import {
  validateOptionalEmail,
  validateUsername,
} from "@/lib/security/validation";

export class ServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly issues?: ComplianceIssue[];

  constructor(
    code: string,
    status: number,
    message: string,
    extra?: { retryAfterSeconds?: number; issues?: ComplianceIssue[] }
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = extra?.retryAfterSeconds;
    this.issues = extra?.issues;
  }
}

export interface RequestSecurityContext {
  ipHash: string;
  userAgentHash: string;
  nowMs?: number;
}

export interface PublicUserDto {
  id: number;
  username: string;
  hasBoundEmail: boolean;
  role: string;
  status: string;
  trustLevel: number;
  createdAt: number;
}

interface UserRow {
  id: number;
  username: string;
  username_normalized: string;
  email: string | null;
  password_hash: string;
  role: string;
  status: string;
  trust_level: number;
  failed_login_count: number;
  locked_until: number | null;
  last_login_at: number | null;
  created_at: number;
  updated_at: number;
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function toPublicUserDto(row: UserRow): PublicUserDto {
  return {
    id: row.id,
    username: row.username,
    hasBoundEmail: Boolean(row.email),
    role: row.role,
    status: row.status,
    trustLevel: row.trust_level,
    createdAt: row.created_at,
  };
}

function createSessionRecord(
  db: Database.Database,
  userId: number,
  ctx: RequestSecurityContext
): { rawSessionToken: string; expiresAt: number } {
  const now = ctx.nowMs ?? Date.now();
  const ttl = getRuntimeConfig().sessionTtlMs;
  const expiresAt = now + ttl;
  const rawSessionToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawSessionToken);
  const sessionId = crypto.randomUUID();

  db.prepare(
    `
    INSERT INTO sessions (
      id, user_id, token_hash, ip_hash, user_agent_hash, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(sessionId, userId, tokenHash, ctx.ipHash, ctx.userAgentHash, expiresAt, now);

  return { rawSessionToken, expiresAt };
}

export async function registerUser(
  db: Database.Database,
  input: {
    username: string;
    email?: string | null;
    password: string;
    agreedRules: boolean;
    captchaToken?: string | null;
    websiteHoneypot?: string | null;
    formIssuedAt?: number | null;
    formSig?: string | null;
  },
  ctx: RequestSecurityContext
): Promise<{ user: PublicUserDto; rawSessionToken: string; expiresAt: number }> {
  const now = ctx.nowMs ?? Date.now();

  const antiBot = verifyAntiBotSignals({
    websiteHoneypot: input.websiteHoneypot,
    formIssuedAt: input.formIssuedAt,
    formSig: input.formSig,
    nowMs: now,
  });
  if (!antiBot.ok) {
    recordSecurityAudit(db, {
      eventType: "auth.register",
      ipHash: ctx.ipHash,
      outcome: "deny",
      detail: antiBot.reason,
      createdAt: now,
    });
    throw new ServiceError(antiBot.reason, 400, antiBot.message);
  }

  const captcha = await verifyCaptchaToken(input.captchaToken, ctx.ipHash);
  if (!captcha.ok) {
    recordSecurityAudit(db, {
      eventType: "auth.register",
      ipHash: ctx.ipHash,
      outcome: "deny",
      detail: `CAPTCHA_FAILED:${captcha.provider}`,
      createdAt: now,
    });
    throw new ServiceError(
      "CAPTCHA_FAILED",
      400,
      captcha.error ?? "人机验证未通过。"
    );
  }

  const hourlyLimit = consumeRateLimit(db, {
    key: `reg:ip:1h:${ctx.ipHash}`,
    limit: RATE_LIMIT_POLICIES.REGISTER_IP_HOURLY.limit,
    windowMs: RATE_LIMIT_POLICIES.REGISTER_IP_HOURLY.windowMs,
    nowMs: now,
  });
  if (!hourlyLimit.allowed) {
    recordSecurityAudit(db, {
      eventType: "auth.register",
      ipHash: ctx.ipHash,
      outcome: "deny",
      detail: "REGISTER_IP_HOURLY_EXCEEDED",
      createdAt: now,
    });
    throw new ServiceError(
      "RATE_LIMITED",
      429,
      "当前网络近期注册过于频繁，请稍后再试。",
      { retryAfterSeconds: hourlyLimit.retryAfterSeconds }
    );
  }

  const dailyLimit = consumeRateLimit(db, {
    key: `reg:ip:24h:${ctx.ipHash}`,
    limit: RATE_LIMIT_POLICIES.REGISTER_IP_DAILY.limit,
    windowMs: RATE_LIMIT_POLICIES.REGISTER_IP_DAILY.windowMs,
    nowMs: now,
  });
  if (!dailyLimit.allowed) {
    recordSecurityAudit(db, {
      eventType: "auth.register",
      ipHash: ctx.ipHash,
      outcome: "deny",
      detail: "REGISTER_IP_DAILY_EXCEEDED",
      createdAt: now,
    });
    throw new ServiceError(
      "RATE_LIMITED",
      429,
      "同一网络 24 小时内注册次数已达上限。",
      { retryAfterSeconds: dailyLimit.retryAfterSeconds }
    );
  }

  if (!input.agreedRules) {
    throw new ServiceError(
      "RULES_NOT_ACCEPTED",
      400,
      "请先阅读并同意《社区公约》与《免责声明》。"
    );
  }

  const usernameCheck = validateUsername(input.username ?? "");
  if (!usernameCheck.ok) {
    throw new ServiceError("INVALID_USERNAME", 400, usernameCheck.error);
  }

  const emailCheck = validateOptionalEmail(input.email);
  if (!emailCheck.ok) {
    throw new ServiceError("INVALID_EMAIL", 400, emailCheck.error);
  }

  const passwordCheck = validatePasswordStrength(
    input.password ?? "",
    usernameCheck.username
  );
  if (!passwordCheck.ok) {
    throw new ServiceError("WEAK_PASSWORD", 400, passwordCheck.error);
  }

  const existingUsername = db
    .prepare("SELECT id FROM users WHERE username_normalized = ?")
    .get(usernameCheck.normalized) as { id: number } | undefined;
  if (existingUsername) {
    throw new ServiceError("USERNAME_TAKEN", 409, "该用户名已被注册，请换一个。");
  }

  if (emailCheck.email) {
    const existingEmail = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(emailCheck.email) as { id: number } | undefined;
    if (existingEmail) {
      throw new ServiceError(
        "EMAIL_TAKEN",
        409,
        "该绑定邮箱已被其他账号使用。"
      );
    }
  }

  const passwordHash = await hashPassword(input.password);

  const insertResult = db
    .prepare(
      `
      INSERT INTO users (
        username, username_normalized, email, password_hash,
        role, status, trust_level, failed_login_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'user', 'active', 0, 0, ?, ?)
      `
    )
    .run(
      usernameCheck.username,
      usernameCheck.normalized,
      emailCheck.email,
      passwordHash,
      now,
      now
    );

  const userId = Number(insertResult.lastInsertRowid);
  const createdUser = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as UserRow;

  const session = createSessionRecord(db, userId, ctx);
  recordSecurityAudit(db, {
    eventType: "auth.register",
    actorUserId: userId,
    ipHash: ctx.ipHash,
    target: `user:${userId}`,
    outcome: "allow",
    detail: emailCheck.email ? "with_email" : "username_only",
    createdAt: now,
  });

  return {
    user: toPublicUserDto(createdUser),
    rawSessionToken: session.rawSessionToken,
    expiresAt: session.expiresAt,
  };
}

export async function authenticateUser(
  db: Database.Database,
  input: {
    identifier: string;
    password: string;
    captchaToken?: string | null;
    websiteHoneypot?: string | null;
    formIssuedAt?: number | null;
    formSig?: string | null;
  },
  ctx: RequestSecurityContext
): Promise<{ user: PublicUserDto; rawSessionToken: string; expiresAt: number }> {
  const now = ctx.nowMs ?? Date.now();

  const antiBot = verifyAntiBotSignals({
    websiteHoneypot: input.websiteHoneypot,
    formIssuedAt: input.formIssuedAt,
    formSig: input.formSig,
    nowMs: now,
    minElapsedMs: 1000,
  });
  if (!antiBot.ok) {
    recordSecurityAudit(db, {
      eventType: "auth.login",
      ipHash: ctx.ipHash,
      outcome: "deny",
      detail: antiBot.reason,
      createdAt: now,
    });
    throw new ServiceError(antiBot.reason, 400, antiBot.message);
  }

  const captcha = await verifyCaptchaToken(input.captchaToken, ctx.ipHash);
  if (!captcha.ok) {
    recordSecurityAudit(db, {
      eventType: "auth.login",
      ipHash: ctx.ipHash,
      outcome: "deny",
      detail: `CAPTCHA_FAILED:${captcha.provider}`,
      createdAt: now,
    });
    throw new ServiceError(
      "CAPTCHA_FAILED",
      400,
      captcha.error ?? "人机验证未通过。"
    );
  }

  const ipLimit = consumeRateLimit(db, {
    key: `login:ip:${ctx.ipHash}`,
    limit: RATE_LIMIT_POLICIES.LOGIN_IP.limit,
    windowMs: RATE_LIMIT_POLICIES.LOGIN_IP.windowMs,
    nowMs: now,
  });
  if (!ipLimit.allowed) {
    recordSecurityAudit(db, {
      eventType: "auth.login",
      ipHash: ctx.ipHash,
      outcome: "locked",
      detail: "LOGIN_IP_RATE_LIMITED",
      createdAt: now,
    });
    throw new ServiceError(
      "RATE_LIMITED",
      429,
      "登录尝试过于频繁，请稍后再试。",
      { retryAfterSeconds: ipLimit.retryAfterSeconds }
    );
  }

  const normalizedId = (input.identifier ?? "").trim().toLowerCase();
  if (!normalizedId) {
    throw new ServiceError("INVALID_INPUT", 400, "请输入用户名或已绑定邮箱。");
  }

  const accountKey = `login:account:${normalizedId}`;
  const accountLimit = consumeRateLimit(db, {
    key: accountKey,
    limit: RATE_LIMIT_POLICIES.LOGIN_ACCOUNT.limit,
    windowMs: RATE_LIMIT_POLICIES.LOGIN_ACCOUNT.windowMs,
    nowMs: now,
  });
  if (!accountLimit.allowed) {
    recordSecurityAudit(db, {
      eventType: "auth.login",
      ipHash: ctx.ipHash,
      target: normalizedId,
      outcome: "locked",
      detail: "LOGIN_ACCOUNT_BUCKET_EXCEEDED",
      createdAt: now,
    });
    throw new ServiceError(
      "ACCOUNT_RATE_LIMITED",
      429,
      "该账号近期登录尝试次数过多，请稍后再试。",
      { retryAfterSeconds: accountLimit.retryAfterSeconds }
    );
  }

  const user = db
    .prepare(
      `
      SELECT * FROM users
      WHERE username_normalized = ? OR email = ?
      LIMIT 1
      `
    )
    .get(normalizedId, normalizedId) as UserRow | undefined;

  if (!user) {
    await verifyDummyPassword(input.password ?? "");
    recordSecurityAudit(db, {
      eventType: "auth.login",
      ipHash: ctx.ipHash,
      target: normalizedId,
      outcome: "deny",
      detail: "USER_NOT_FOUND",
      createdAt: now,
    });
    throw new ServiceError(
      "INVALID_CREDENTIALS",
      401,
      "用户名/邮箱或密码错误。"
    );
  }

  if (user.locked_until && user.locked_until > now) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((user.locked_until - now) / 1000)
    );
    recordSecurityAudit(db, {
      eventType: "auth.login",
      actorUserId: user.id,
      ipHash: ctx.ipHash,
      outcome: "locked",
      detail: `ACCOUNT_LOCKED_UNTIL:${user.locked_until}`,
      createdAt: now,
    });
    throw new ServiceError(
      "ACCOUNT_LOCKED",
      429,
      `连续密码错误次数过多，账号已暂时锁定，请 ${retryAfterSeconds} 秒后再试。`,
      { retryAfterSeconds }
    );
  }

  if (user.status !== "active") {
    await verifyDummyPassword(input.password ?? "");
    recordSecurityAudit(db, {
      eventType: "auth.login",
      actorUserId: user.id,
      ipHash: ctx.ipHash,
      outcome: "deny",
      detail: `USER_STATUS:${user.status}`,
      createdAt: now,
    });
    throw new ServiceError(
      "ACCOUNT_DISABLED",
      403,
      "该账号当前处于封禁或停用状态。"
    );
  }

  const valid = await verifyPassword(input.password ?? "", user.password_hash);
  if (!valid) {
    const nextFailedCount = user.failed_login_count + 1;
    const lockDurationMs = calculateAccountLockoutMs(nextFailedCount);
    const lockedUntil = lockDurationMs > 0 ? now + lockDurationMs : null;

    db.prepare(
      `
      UPDATE users
      SET failed_login_count = ?, locked_until = ?, updated_at = ?
      WHERE id = ?
      `
    ).run(nextFailedCount, lockedUntil, now, user.id);

    recordSecurityAudit(db, {
      eventType: "auth.login",
      actorUserId: user.id,
      ipHash: ctx.ipHash,
      outcome: lockedUntil ? "locked" : "deny",
      detail: `WRONG_PASSWORD:count=${nextFailedCount}`,
      createdAt: now,
    });

    if (lockedUntil) {
      const retryAfterSeconds = Math.ceil(lockDurationMs / 1000);
      throw new ServiceError(
        "ACCOUNT_LOCKED",
        429,
        `连续密码错误 ${nextFailedCount} 次，为防止暴力破解，账号已临时锁定 ${retryAfterSeconds} 秒。`,
        { retryAfterSeconds }
      );
    }

    throw new ServiceError(
      "INVALID_CREDENTIALS",
      401,
      "用户名/邮箱或密码错误。"
    );
  }

  db.prepare(
    `
    UPDATE users
    SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
    WHERE id = ?
    `
  ).run(now, now, user.id);
  clearRateLimitBucket(db, accountKey);

  const session = createSessionRecord(db, user.id, ctx);
  recordSecurityAudit(db, {
    eventType: "auth.login",
    actorUserId: user.id,
    ipHash: ctx.ipHash,
    outcome: "allow",
    detail: "LOGIN_SUCCESS",
    createdAt: now,
  });

  return {
    user: toPublicUserDto(user),
    rawSessionToken: session.rawSessionToken,
    expiresAt: session.expiresAt,
  };
}

export function getSessionUser(
  db: Database.Database,
  rawToken: string | undefined | null,
  nowMs = Date.now()
): PublicUserDto | null {
  if (!rawToken || rawToken.length < 32) {
    return null;
  }
  const tokenHash = hashSessionToken(rawToken);
  const row = db
    .prepare(
      `
      SELECT u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
        AND u.status = 'active'
      LIMIT 1
      `
    )
    .get(tokenHash, nowMs) as UserRow | undefined;

  return row ? toPublicUserDto(row) : null;
}

export function revokeSession(
  db: Database.Database,
  rawToken: string | undefined | null,
  nowMs = Date.now()
): void {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  db.prepare(
    "UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL"
  ).run(nowMs, tokenHash);
}

function escapeSqlLike(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}

export function listPosts(
  db: Database.Database,
  options?: {
    categorySlug?: string;
    sort?: "active" | "latest";
    q?: string;
    limit?: number;
    offset?: number;
  }
): { items: PublicPostDto[]; total: number } {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
  const offset = Math.max(options?.offset ?? 0, 0);

  const whereClauses = ["p.moderation_status = 'published'"];
  const params: Array<string | number> = [];

  if (options?.categorySlug && options.categorySlug !== "all") {
    whereClauses.push("p.category_slug = ?");
    params.push(options.categorySlug);
  }

  const trimmedQuery = options?.q?.trim();
  if (trimmedQuery) {
    const pattern = `%${escapeSqlLike(trimmedQuery)}%`;
    whereClauses.push("(p.title LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern);
  }

  const whereSql = whereClauses.join(" AND ");
  const orderSql =
    options?.sort === "latest"
      ? "p.is_pinned DESC, p.created_at DESC, p.id DESC"
      : "p.is_pinned DESC, p.last_comment_at DESC, p.created_at DESC, p.id DESC";

  const countRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM posts p WHERE ${whereSql}`)
    .get(...params) as { cnt: number };

  const rows = db
    .prepare(
      `
      SELECT
        p.id,
        p.category_slug,
        c.name AS category_name,
        c.accent_color AS category_accent,
        p.author_id,
        u.username AS author_username,
        p.title,
        p.content,
        p.is_anonymous,
        p.moderation_status,
        p.view_count,
        p.comment_count,
        p.is_pinned,
        p.created_at,
        p.updated_at,
        p.last_comment_at
      FROM posts p
      JOIN categories c ON c.slug = p.category_slug
      JOIN users u ON u.id = p.author_id
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ? OFFSET ?
      `
    )
    .all(...params, limit, offset) as PostRowForDto[];

  return {
    items: rows.map(serializePostDto),
    total: countRow.cnt,
  };
}

export function getPostDetail(
  db: Database.Database,
  postId: number,
  options?: { incrementView?: boolean }
): { post: PublicPostDto; comments: PublicCommentDto[] } | null {
  if (!Number.isInteger(postId) || postId <= 0) {
    return null;
  }

  const row = db
    .prepare(
      `
      SELECT
        p.id,
        p.category_slug,
        c.name AS category_name,
        c.accent_color AS category_accent,
        p.author_id,
        u.username AS author_username,
        p.title,
        p.content,
        p.is_anonymous,
        p.moderation_status,
        p.view_count,
        p.comment_count,
        p.is_pinned,
        p.created_at,
        p.updated_at,
        p.last_comment_at
      FROM posts p
      JOIN categories c ON c.slug = p.category_slug
      JOIN users u ON u.id = p.author_id
      WHERE p.id = ? AND p.moderation_status = 'published'
      LIMIT 1
      `
    )
    .get(postId) as PostRowForDto | undefined;

  if (!row) {
    return null;
  }

  if (options?.incrementView) {
    db.prepare("UPDATE posts SET view_count = view_count + 1 WHERE id = ?").run(
      postId
    );
    row.view_count += 1;
  }

  const commentRows = db
    .prepare(
      `
      SELECT
        cm.id,
        cm.post_id,
        cm.author_id,
        u.username AS author_username,
        cm.floor_no,
        cm.reply_to_comment_id,
        cm.content,
        cm.is_anonymous,
        cm.moderation_status,
        cm.created_at
      FROM comments cm
      JOIN users u ON u.id = cm.author_id
      WHERE cm.post_id = ? AND cm.moderation_status = 'published'
      ORDER BY cm.floor_no ASC, cm.id ASC
      `
    )
    .all(postId) as CommentRowForDto[];

  return {
    post: serializePostDto(row),
    comments: commentRows.map((c) => serializeCommentDto(c, row.author_id)),
  };
}

export async function createPost(
  db: Database.Database,
  user: PublicUserDto,
  input: {
    categorySlug: string;
    title: string;
    content: string;
    isAnonymous?: boolean;
  },
  ctx: RequestSecurityContext
): Promise<{ post: PublicPostDto; moderationAction: string }> {
  const now = ctx.nowMs ?? Date.now();
  const category = getCategoryBySlug(input.categorySlug);
  if (!category) {
    throw new ServiceError("INVALID_CATEGORY", 400, "所选论坛板块不存在。");
  }

  if (user.trustLevel < category.minTrustLevel) {
    throw new ServiceError(
      "INSUFFICIENT_TRUST",
      403,
      `当前账号信任等级不足，无法在「${category.name}」板块发帖。`
    );
  }

  if (input.isAnonymous && !category.allowAnonymous) {
    throw new ServiceError(
      "ANONYMOUS_NOT_ALLOWED",
      400,
      `「${category.name}」板块不支持匿名发布，请前往「匿名树洞」板块。`
    );
  }

  const isAnonymous = Boolean(input.isAnonymous) && category.allowAnonymous;

  if (now - user.createdAt < RATE_LIMIT_POLICIES.NEW_USER_COOLDOWN_MS) {
    const waitSeconds = Math.ceil(
      (RATE_LIMIT_POLICIES.NEW_USER_COOLDOWN_MS - (now - user.createdAt)) / 1000
    );
    throw new ServiceError(
      "NEW_USER_COOLDOWN",
      429,
      `新注册账号需等待新手观察期结束后才可发帖（还需 ${waitSeconds} 秒）。`,
      { retryAfterSeconds: waitSeconds }
    );
  }

  const intervalLimit = consumeRateLimit(db, {
    key: `post:interval:user:${user.id}`,
    limit: RATE_LIMIT_POLICIES.POST_INTERVAL.limit,
    windowMs: RATE_LIMIT_POLICIES.POST_INTERVAL.windowMs,
    nowMs: now,
  });
  if (!intervalLimit.allowed) {
    throw new ServiceError(
      "RATE_LIMITED",
      429,
      `发帖间隔过短，请在 ${intervalLimit.retryAfterSeconds} 秒后再试。`,
      { retryAfterSeconds: intervalLimit.retryAfterSeconds }
    );
  }

  if (user.trustLevel === 0) {
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const dailyCount = db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM posts WHERE author_id = ? AND created_at >= ?"
      )
      .get(user.id, dayAgo) as { cnt: number };

    if (dailyCount.cnt >= RATE_LIMIT_POLICIES.NEW_USER_DAILY_POST_LIMIT) {
      throw new ServiceError(
        "DAILY_POST_LIMIT",
        429,
        `新手账号 24 小时内最多发布 ${RATE_LIMIT_POLICIES.NEW_USER_DAILY_POST_LIMIT} 篇主题帖。`
      );
    }
  }

  const normalizedTitle = normalizePlainText(input.title ?? "").replace(/\n+/g, " ");
  const normalizedContent = normalizePlainText(input.content ?? "");

  if ([...normalizedTitle].length < 4 || [...normalizedTitle].length > 80) {
    throw new ServiceError(
      "INVALID_TITLE",
      400,
      "帖子标题长度需在 4 至 80 个字符之间。"
    );
  }

  if ([...normalizedContent].length < 10 || [...normalizedContent].length > 8000) {
    throw new ServiceError(
      "INVALID_CONTENT",
      400,
      "帖子正文长度需在 10 至 8000 个字符之间。"
    );
  }

  const moderation = await runModerationPipeline({
    title: normalizedTitle,
    content: normalizedContent,
    categorySlug: category.slug,
  });

  if (moderation.action === "reject") {
    recordSecurityAudit(db, {
      eventType: "post.create",
      actorUserId: user.id,
      ipHash: ctx.ipHash,
      target: category.slug,
      outcome: "deny",
      detail: `${moderation.stage}:${moderation.reason}`,
      createdAt: now,
    });
    throw new ServiceError("MODERATION_REJECTED", 400, moderation.reason, {
      issues: moderation.issues,
    });
  }

  const moderationStatus =
    moderation.action === "pending_review" ? "pending_review" : "published";

  const res = db
    .prepare(
      `
      INSERT INTO posts (
        category_slug, author_id, title, content, is_anonymous,
        moderation_status, moderation_reason, view_count, comment_count,
        is_pinned, created_at, updated_at, last_comment_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?)
      `
    )
    .run(
      category.slug,
      user.id,
      normalizedTitle,
      normalizedContent,
      isAnonymous ? 1 : 0,
      moderationStatus,
      moderation.reason,
      now,
      now,
      now
    );

  const postId = Number(res.lastInsertRowid);
  const inserted = db
    .prepare(
      `
      SELECT
        p.id,
        p.category_slug,
        c.name AS category_name,
        c.accent_color AS category_accent,
        p.author_id,
        u.username AS author_username,
        p.title,
        p.content,
        p.is_anonymous,
        p.moderation_status,
        p.view_count,
        p.comment_count,
        p.is_pinned,
        p.created_at,
        p.updated_at,
        p.last_comment_at
      FROM posts p
      JOIN categories c ON c.slug = p.category_slug
      JOIN users u ON u.id = p.author_id
      WHERE p.id = ?
      `
    )
    .get(postId) as PostRowForDto;

  recordSecurityAudit(db, {
    eventType: "post.create",
    actorUserId: user.id,
    ipHash: ctx.ipHash,
    target: `post:${postId}`,
    outcome: "allow",
    detail: `status=${moderationStatus},anon=${isAnonymous}`,
    createdAt: now,
  });

  return {
    post: serializePostDto(inserted),
    moderationAction: moderation.action,
  };
}

export async function createComment(
  db: Database.Database,
  user: PublicUserDto,
  postId: number,
  input: {
    content: string;
    isAnonymous?: boolean;
    replyToCommentId?: number | null;
  },
  ctx: RequestSecurityContext
): Promise<{ comment: PublicCommentDto; moderationAction: string }> {
  const now = ctx.nowMs ?? Date.now();
  const postRow = db
    .prepare(
      "SELECT id, category_slug, author_id, moderation_status FROM posts WHERE id = ? LIMIT 1"
    )
    .get(postId) as
    | {
        id: number;
        category_slug: string;
        author_id: number;
        moderation_status: string;
      }
    | undefined;

  if (!postRow || postRow.moderation_status !== "published") {
    throw new ServiceError("POST_NOT_FOUND", 404, "目标帖子不存在或未处于公开状态。");
  }

  const category = getCategoryBySlug(postRow.category_slug);
  const allowAnon = Boolean(category?.allowAnonymous);
  if (input.isAnonymous && !allowAnon) {
    throw new ServiceError(
      "ANONYMOUS_NOT_ALLOWED",
      400,
      "该帖子所在板块不支持匿名回复。"
    );
  }
  const isAnonymous = Boolean(input.isAnonymous) && allowAnon;

  const intervalLimit = consumeRateLimit(db, {
    key: `comment:interval:user:${user.id}`,
    limit: RATE_LIMIT_POLICIES.COMMENT_INTERVAL.limit,
    windowMs: RATE_LIMIT_POLICIES.COMMENT_INTERVAL.windowMs,
    nowMs: now,
  });
  if (!intervalLimit.allowed) {
    throw new ServiceError(
      "RATE_LIMITED",
      429,
      `回复频率过快，请在 ${intervalLimit.retryAfterSeconds} 秒后再试。`,
      { retryAfterSeconds: intervalLimit.retryAfterSeconds }
    );
  }

  const hourlyLimit = consumeRateLimit(db, {
    key: `comment:hourly:user:${user.id}`,
    limit: RATE_LIMIT_POLICIES.COMMENT_HOURLY.limit,
    windowMs: RATE_LIMIT_POLICIES.COMMENT_HOURLY.windowMs,
    nowMs: now,
  });
  if (!hourlyLimit.allowed) {
    throw new ServiceError(
      "RATE_LIMITED",
      429,
      "当前小时内评论数量已达上限，请稍后再试。",
      { retryAfterSeconds: hourlyLimit.retryAfterSeconds }
    );
  }

  const normalizedContent = normalizePlainText(input.content ?? "");
  if ([...normalizedContent].length < 2 || [...normalizedContent].length > 2000) {
    throw new ServiceError(
      "INVALID_COMMENT",
      400,
      "回复正文长度需在 2 至 2000 个字符之间。"
    );
  }

  let replyToId: number | null = null;
  if (input.replyToCommentId) {
    const parentComment = db
      .prepare("SELECT id FROM comments WHERE id = ? AND post_id = ? LIMIT 1")
      .get(input.replyToCommentId, postId) as { id: number } | undefined;
    if (!parentComment) {
      throw new ServiceError(
        "INVALID_REPLY_TARGET",
        400,
        "引用的目标楼层不存在。"
      );
    }
    replyToId = parentComment.id;
  }

  const moderation = await runModerationPipeline({
    title: "",
    content: normalizedContent,
    categorySlug: postRow.category_slug,
  });

  if (moderation.action === "reject") {
    recordSecurityAudit(db, {
      eventType: "comment.create",
      actorUserId: user.id,
      ipHash: ctx.ipHash,
      target: `post:${postId}`,
      outcome: "deny",
      detail: `${moderation.stage}:${moderation.reason}`,
      createdAt: now,
    });
    throw new ServiceError("MODERATION_REJECTED", 400, moderation.reason, {
      issues: moderation.issues,
    });
  }

  const moderationStatus =
    moderation.action === "pending_review" ? "pending_review" : "published";

  const insertTx = db.transaction(() => {
    const maxFloorRow = db
      .prepare(
        "SELECT COALESCE(MAX(floor_no), 0) AS max_floor FROM comments WHERE post_id = ?"
      )
      .get(postId) as { max_floor: number };
    const nextFloor = maxFloorRow.max_floor + 1;

    const res = db
      .prepare(
        `
        INSERT INTO comments (
          post_id, author_id, floor_no, reply_to_comment_id,
          content, is_anonymous, moderation_status, moderation_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        postId,
        user.id,
        nextFloor,
        replyToId,
        normalizedContent,
        isAnonymous ? 1 : 0,
        moderationStatus,
        moderation.reason,
        now
      );

    if (moderationStatus === "published") {
      db.prepare(
        `
        UPDATE posts
        SET comment_count = comment_count + 1,
            last_comment_at = ?,
            updated_at = ?
        WHERE id = ?
        `
      ).run(now, now, postId);
    }

    return Number(res.lastInsertRowid);
  });

  const commentId = insertTx();
  const insertedRow = db
    .prepare(
      `
      SELECT
        cm.id,
        cm.post_id,
        cm.author_id,
        u.username AS author_username,
        cm.floor_no,
        cm.reply_to_comment_id,
        cm.content,
        cm.is_anonymous,
        cm.moderation_status,
        cm.created_at
      FROM comments cm
      JOIN users u ON u.id = cm.author_id
      WHERE cm.id = ?
      `
    )
    .get(commentId) as CommentRowForDto;

  return {
    comment: serializeCommentDto(insertedRow, postRow.author_id),
    moderationAction: moderation.action,
  };
}

export function createReport(
  db: Database.Database,
  user: PublicUserDto,
  input: {
    targetType: "post" | "comment";
    targetId: number;
    reasonCode: string;
    details?: string | null;
  },
  ctx: RequestSecurityContext
): { reportId: number } {
  const now = ctx.nowMs ?? Date.now();
  const reportLimit = consumeRateLimit(db, {
    key: `report:hourly:user:${user.id}`,
    limit: RATE_LIMIT_POLICIES.REPORT_HOURLY.limit,
    windowMs: RATE_LIMIT_POLICIES.REPORT_HOURLY.windowMs,
    nowMs: now,
  });
  if (!reportLimit.allowed) {
    throw new ServiceError(
      "RATE_LIMITED",
      429,
      "举报提交过于频繁，请稍后再试。",
      { retryAfterSeconds: reportLimit.retryAfterSeconds }
    );
  }

  if (input.targetType !== "post" && input.targetType !== "comment") {
    throw new ServiceError("INVALID_TARGET", 400, "举报目标类型无效。");
  }

  const validReason = REPORT_REASONS.some((r) => r.code === input.reasonCode);
  if (!validReason) {
    throw new ServiceError("INVALID_REASON", 400, "请选择有效的举报原因分类。");
  }

  const exists =
    input.targetType === "post"
      ? db.prepare("SELECT id FROM posts WHERE id = ?").get(input.targetId)
      : db.prepare("SELECT id FROM comments WHERE id = ?").get(input.targetId);
  if (!exists) {
    throw new ServiceError("TARGET_NOT_FOUND", 404, "被举报的内容不存在。");
  }

  const cleanedDetails = input.details
    ? normalizePlainText(input.details).slice(0, 500)
    : null;

  const res = db
    .prepare(
      `
      INSERT INTO reports (
        target_type, target_id, reporter_id, reason_code, details, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'open', ?)
      `
    )
    .run(
      input.targetType,
      input.targetId,
      user.id,
      input.reasonCode,
      cleanedDetails,
      now
    );

  const reportId = Number(res.lastInsertRowid);
  recordSecurityAudit(db, {
    eventType: "moderation.report",
    actorUserId: user.id,
    ipHash: ctx.ipHash,
    target: `${input.targetType}:${input.targetId}`,
    outcome: "allow",
    detail: input.reasonCode,
    createdAt: now,
  });

  return { reportId };
}

export function getForumStats(db: Database.Database): {
  userCount: number;
  postCount: number;
  commentCount: number;
  categoryCounts: Record<string, number>;
} {
  const userRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM users")
    .get() as { cnt: number };
  const postRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM posts WHERE moderation_status = 'published'")
    .get() as { cnt: number };
  const commentRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM comments WHERE moderation_status = 'published'")
    .get() as { cnt: number };

  const catRows = db
    .prepare(
      `
      SELECT category_slug, COUNT(*) AS cnt
      FROM posts
      WHERE moderation_status = 'published'
      GROUP BY category_slug
      `
    )
    .all() as Array<{ category_slug: string; cnt: number }>;

  const categoryCounts: Record<string, number> = {};
  for (const row of catRows) {
    categoryCounts[row.category_slug] = row.cnt;
  }

  return {
    userCount: userRow.cnt,
    postCount: postRow.cnt,
    commentCount: commentRow.cnt,
    categoryCounts,
  };
}
