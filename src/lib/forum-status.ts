import {
  assertFeatureEnabled,
  FeatureLockedError,
  getPublicSystemStatus,
  getRuntimeConfig,
  type PublicSystemStatus,
} from "@/lib/config";
import { getDb } from "@/lib/db";
import type Database from "better-sqlite3";

export function hasActiveModerator(db: Database.Database = getDb()): boolean {
  return Boolean(db.prepare(
    "SELECT 1 FROM users WHERE status = 'active' AND role IN ('moderator', 'admin') LIMIT 1"
  ).get());
}

/** Production publishing requires someone able to act on reports and pending content. */
export function getForumSystemStatus(): PublicSystemStatus {
  const status = getPublicSystemStatus();
  if (!getRuntimeConfig().isProduction || !status.postingEnabled || hasActiveModerator()) {
    return status;
  }
  return {
    ...status,
    postingEnabled: false,
    phaseBadge: status.authEnabled ? "部分开放 · 发帖锁定中" : "一期锁定中",
    lockSummary: "尚未配置可处理举报和待审内容的审核员。",
  };
}

export function assertPostingEnabled(): void {
  const config = assertFeatureEnabled("posting");
  if (config.isProduction && !hasActiveModerator()) {
    throw new FeatureLockedError("posting", "尚未配置审核员，发帖与评论暂未开放。");
  }
}
