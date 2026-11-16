import type Database from "better-sqlite3";

export interface RateLimitPolicy {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

export const RATE_LIMIT_POLICIES = {
  LOGIN_IP: { limit: 40, windowMs: 15 * 60 * 1000 },
  REGISTER_IP_ATTEMPTS: { limit: 30, windowMs: 15 * 60 * 1000 },
  LOGIN_ACCOUNT: { limit: 8, windowMs: 15 * 60 * 1000 },
  REGISTER_IP_HOURLY: { limit: 20, windowMs: 60 * 60 * 1000 },
  REGISTER_IP_DAILY: { limit: 60, windowMs: 24 * 60 * 60 * 1000 },
  POST_ATTEMPTS: { limit: 12, windowMs: 5 * 60 * 1000 },
  COMMENT_ATTEMPTS: { limit: 60, windowMs: 15 * 60 * 1000 },
  POST_INTERVAL: { limit: 1, windowMs: 60 * 1000 },
  COMMENT_INTERVAL: { limit: 1, windowMs: 15 * 1000 },
  COMMENT_HOURLY: { limit: 30, windowMs: 60 * 60 * 1000 },
  REPORT_HOURLY: { limit: 10, windowMs: 60 * 60 * 1000 },
  NEW_USER_COOLDOWN_MS: 5 * 60 * 1000,
  NEW_USER_DAILY_POST_LIMIT: 5,
  LOCKOUT_THRESHOLD: 5,
} as const;

export function calculateAccountLockoutMs(failedCount: number): number {
  if (failedCount < RATE_LIMIT_POLICIES.LOCKOUT_THRESHOLD) {
    return 0;
  }
  const steps = failedCount - RATE_LIMIT_POLICIES.LOCKOUT_THRESHOLD;
  if (steps === 0) return 60 * 1000; // 1 minute
  if (steps === 1) return 5 * 60 * 1000; // 5 minutes
  if (steps === 2) return 15 * 60 * 1000; // 15 minutes
  return 30 * 60 * 1000; // cap at 30 minutes
}

let cleanupTick = 0;

export function consumeRateLimit(
  db: Database.Database,
  policy: RateLimitPolicy
): RateLimitResult {
  const now = policy.nowMs ?? Date.now();
  if (++cleanupTick % 128 === 0) {
    db.prepare("DELETE FROM rate_limit_buckets WHERE reset_at <= ?").run(now);
  }
  const tx = db.transaction((): RateLimitResult => {
    const existing = db
      .prepare(
        "SELECT count, reset_at FROM rate_limit_buckets WHERE bucket_key = ?"
      )
      .get(policy.key) as { count: number; reset_at: number } | undefined;

    if (!existing || existing.reset_at <= now) {
      const nextReset = now + policy.windowMs;
      db.prepare(
        `
        INSERT INTO rate_limit_buckets (bucket_key, count, reset_at, updated_at)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(bucket_key) DO UPDATE SET
          count = 1,
          reset_at = excluded.reset_at,
          updated_at = excluded.updated_at
        `
      ).run(policy.key, nextReset, now);

      return {
        allowed: true,
        remaining: Math.max(0, policy.limit - 1),
        retryAfterSeconds: 0,
        resetAt: nextReset,
      };
    }

    if (existing.count >= policy.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.reset_at - now) / 1000)),
        resetAt: existing.reset_at,
      };
    }

    const updatedCount = existing.count + 1;
    db.prepare(
      "UPDATE rate_limit_buckets SET count = ?, updated_at = ? WHERE bucket_key = ?"
    ).run(updatedCount, now, policy.key);

    return {
      allowed: true,
      remaining: Math.max(0, policy.limit - updatedCount),
      retryAfterSeconds: 0,
      resetAt: existing.reset_at,
    };
  });

  return tx();
}

export function clearRateLimitBucket(db: Database.Database, key: string): void {
  db.prepare("DELETE FROM rate_limit_buckets WHERE bucket_key = ?").run(key);
}
