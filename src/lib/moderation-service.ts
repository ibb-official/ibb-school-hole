import type Database from "better-sqlite3";
import { assertRequestSessionActive, ServiceError, type PublicUserDto, type RequestSecurityContext } from "@/lib/forum-service";
import { recordSecurityAudit } from "@/lib/security/audit";

export type ModerationTarget = "post" | "comment";
export type ModerationAction = "approve" | "reject" | "hide" | "restore" | "reopen" | "resolve_report" | "suspend_user" | "unsuspend_user";

export function assertModerator(user: PublicUserDto, db?: Database.Database): "moderator" | "admin" {
  const current = db
    ? db.prepare("SELECT role, status FROM users WHERE id = ?").get(user.id) as { role: string; status: string } | undefined
    : user;
  if (!current || current.status !== "active" || (current.role !== "moderator" && current.role !== "admin")) {
    throw new ServiceError("FORBIDDEN", 403, "当前账号没有审核权限。");
  }
  return current.role;
}

export interface ModerationContent {
  targetType: ModerationTarget;
  id: number;
  postId: number;
  title: string;
  content: string;
  authorUsername: string;
  authorId: number;
  moderationStatus: string;
  moderationReason: string | null;
  createdAt: number;
}

export interface ModerationReport {
  id: number;
  targetType: ModerationTarget;
  targetId: number;
  reasonCode: string;
  details: string | null;
  title: string | null;
  content: string | null;
  targetStatus: string | null;
  targetAuthorId: number | null;
  createdAt: number;
}

/** Queues only contain non-public details after a server-side role check. */
export function listModerationQueue(db: Database.Database, user: PublicUserDto, offset = 0): {
  pending: ModerationContent[];
  reviewed: ModerationContent[];
  reports: ModerationReport[];
} {
  assertModerator(user, db);
  const safeOffset = Number.isSafeInteger(offset) && offset > 0 ? offset : 0;
  const pending = db.prepare(`
    SELECT 'post' AS targetType, p.id AS id, p.id AS postId, p.title AS title,
           p.content AS content, u.username AS authorUsername, u.id AS authorId,
           p.moderation_status AS moderationStatus, p.moderation_reason AS moderationReason,
           p.created_at AS createdAt
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.moderation_status = 'pending_review'
    UNION ALL
    SELECT 'comment' AS targetType, cm.id AS id, cm.post_id AS postId, p.title AS title,
           cm.content AS content, u.username AS authorUsername, u.id AS authorId,
           cm.moderation_status AS moderationStatus, cm.moderation_reason AS moderationReason,
           cm.created_at AS createdAt
    FROM comments cm JOIN posts p ON p.id = cm.post_id JOIN users u ON u.id = cm.author_id
    WHERE cm.moderation_status = 'pending_review'
    ORDER BY createdAt ASC, id ASC LIMIT 100 OFFSET ?
  `).all(safeOffset) as ModerationContent[];
  const reviewed = db.prepare(`
    SELECT 'post' AS targetType, p.id AS id, p.id AS postId, p.title AS title,
           p.content AS content, u.username AS authorUsername, u.id AS authorId,
           p.moderation_status AS moderationStatus, p.moderation_reason AS moderationReason,
           p.created_at AS createdAt
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.moderation_status IN ('hidden', 'rejected')
    UNION ALL
    SELECT 'comment' AS targetType, cm.id AS id, cm.post_id AS postId, p.title AS title,
           cm.content AS content, u.username AS authorUsername, u.id AS authorId,
           cm.moderation_status AS moderationStatus, cm.moderation_reason AS moderationReason,
           cm.created_at AS createdAt
    FROM comments cm JOIN posts p ON p.id = cm.post_id JOIN users u ON u.id = cm.author_id
    WHERE cm.moderation_status IN ('hidden', 'rejected')
    ORDER BY createdAt DESC, id DESC LIMIT 100 OFFSET ?
  `).all(safeOffset) as ModerationContent[];
  const reports = db.prepare(`
    SELECT r.id AS id, r.target_type AS targetType, r.target_id AS targetId,
           r.reason_code AS reasonCode, r.details AS details, r.created_at AS createdAt,
           CASE WHEN r.target_type = 'post' THEN p.title ELSE cp.title END AS title,
           CASE WHEN r.target_type = 'post' THEN p.content ELSE cm.content END AS content,
           CASE WHEN r.target_type = 'post' THEN p.moderation_status ELSE cm.moderation_status END AS targetStatus,
           CASE WHEN r.target_type = 'post' THEN p.author_id ELSE cm.author_id END AS targetAuthorId
    FROM reports r
    LEFT JOIN posts p ON r.target_type = 'post' AND p.id = r.target_id
    LEFT JOIN comments cm ON r.target_type = 'comment' AND cm.id = r.target_id
    LEFT JOIN posts cp ON cp.id = cm.post_id
    WHERE r.status = 'open'
    ORDER BY r.created_at ASC, r.id ASC LIMIT 100 OFFSET ?
  `).all(safeOffset) as ModerationReport[];
  return { pending, reviewed, reports };
}

export function moderateContent(
  db: Database.Database,
  user: PublicUserDto,
  input: { action: ModerationAction; targetType?: ModerationTarget; targetId: number; reason?: string },
  ctx: RequestSecurityContext
): void {
  assertModerator(user);
  if (!Number.isSafeInteger(input.targetId) || input.targetId <= 0) {
    throw new ServiceError("INVALID_TARGET", 400, "目标编号无效。");
  }
  if (input.reason !== undefined && (typeof input.reason !== "string" || input.reason.length > 500)) {
    throw new ServiceError("INVALID_REASON", 400, "处理说明不能超过 500 字符。");
  }
  const reason = input.reason?.trim() || null;
  const now = ctx.nowMs ?? Date.now();
  db.transaction(() => {
    // Recheck the current role within the same transaction as the action.
    assertRequestSessionActive(db, user.id, ctx);
    const actorRole = assertModerator(user, db);
    if (input.action === "resolve_report") {
      const changed = db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ? AND status = 'open'").run(input.targetId);
      if (!changed.changes) throw new ServiceError("REPORT_NOT_OPEN", 404, "举报不存在或已处理。");
      recordSecurityAudit(db, { eventType: "moderation.resolve_report", actorUserId: user.id, ipHash: ctx.ipHash,
        target: `report:${input.targetId}`, outcome: "allow", detail: reason, createdAt: now });
      return;
    }

    if (input.action === "suspend_user" || input.action === "unsuspend_user") {
      const targetUser = db.prepare("SELECT id, role, status FROM users WHERE id = ?").get(input.targetId) as { id: number; role: string; status: string } | undefined;
      if (!targetUser) throw new ServiceError("TARGET_NOT_FOUND", 404, "目标账号不存在。");
      if (targetUser.id === user.id || (targetUser.role !== "user" && actorRole !== "admin")) {
        throw new ServiceError("FORBIDDEN", 403, "当前账号没有权限处理该账号。");
      }
      const expectedStatus = input.action === "suspend_user" ? "active" : "suspended";
      if (targetUser.status !== expectedStatus) {
        throw new ServiceError("INVALID_TRANSITION", 409, "账号状态已变化，请刷新后重试。");
      }
      const newStatus = input.action === "suspend_user" ? "suspended" : "active";
      db.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(newStatus, now, targetUser.id);
      if (input.action === "suspend_user") {
        db.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(now, targetUser.id);
        const impactedPosts = db.prepare("SELECT DISTINCT post_id FROM comments WHERE author_id = ? AND moderation_status = 'published'")
          .all(targetUser.id) as Array<{ post_id: number }>;
        const suspendReason = reason ?? "账号已停用，内容已隐藏。";
        db.prepare("UPDATE posts SET moderation_status = 'hidden', moderation_reason = ?, updated_at = ? WHERE author_id = ? AND moderation_status = 'published'")
          .run(suspendReason, now, targetUser.id);
        db.prepare("UPDATE posts SET moderation_status = 'rejected', moderation_reason = ?, updated_at = ? WHERE author_id = ? AND moderation_status = 'pending_review'")
          .run(suspendReason, now, targetUser.id);
        db.prepare("UPDATE comments SET moderation_status = 'hidden', moderation_reason = ? WHERE author_id = ? AND moderation_status = 'published'")
          .run(suspendReason, targetUser.id);
        db.prepare("UPDATE comments SET moderation_status = 'rejected', moderation_reason = ? WHERE author_id = ? AND moderation_status = 'pending_review'")
          .run(suspendReason, targetUser.id);
        const recalculate = db.prepare(`UPDATE posts SET
          comment_count = (SELECT COUNT(*) FROM comments WHERE post_id = ? AND moderation_status = 'published'),
          last_comment_at = COALESCE((SELECT MAX(created_at) FROM comments WHERE post_id = ? AND moderation_status = 'published'), created_at),
          updated_at = ? WHERE id = ?`);
        for (const post of impactedPosts) recalculate.run(post.post_id, post.post_id, now, post.post_id);
      }
      recordSecurityAudit(db, { eventType: `moderation.${input.action}`, actorUserId: user.id,
        ipHash: ctx.ipHash, target: `user:${targetUser.id}`, outcome: "allow", detail: reason, createdAt: now });
      return;
    }

    if (input.targetType !== "post" && input.targetType !== "comment") {
      throw new ServiceError("INVALID_TARGET", 400, "目标类型无效。");
    }
    const transitions: Record<string, { from: string; to: string }> = {
      approve: { from: "pending_review", to: "published" },
      reject: { from: "pending_review", to: "rejected" },
      hide: { from: "published", to: "hidden" },
      restore: { from: "hidden", to: "published" },
      reopen: { from: "rejected", to: "pending_review" },
    };
    const transition = transitions[input.action];
    if (!transition) throw new ServiceError("INVALID_ACTION", 400, "审核操作无效。");
    const row = input.targetType === "post"
      ? db.prepare("SELECT id, id AS post_id, author_id, moderation_status FROM posts WHERE id = ?").get(input.targetId)
      : db.prepare("SELECT id, post_id, author_id, moderation_status FROM comments WHERE id = ?").get(input.targetId);
    const target = row as { id: number; post_id: number; author_id: number; moderation_status: string } | undefined;
    if (!target) throw new ServiceError("TARGET_NOT_FOUND", 404, "目标内容不存在。");
    if (target.moderation_status !== transition.from) {
      throw new ServiceError("INVALID_TRANSITION", 409, "内容状态已变化，请刷新后重试。");
    }
    if (transition.to === "published") {
      const author = db.prepare("SELECT status FROM users WHERE id = ?").get(target.author_id) as { status: string } | undefined;
      if (author?.status !== "active") {
        throw new ServiceError("AUTHOR_SUSPENDED", 409, "作者账号已停用，不能公开其内容。");
      }
    }
    if (input.targetType === "comment" && transition.to === "published") {
      const parent = db.prepare("SELECT moderation_status FROM posts WHERE id = ?").get(target.post_id) as { moderation_status: string } | undefined;
      if (parent?.moderation_status !== "published") {
        throw new ServiceError("POST_NOT_PUBLIC", 409, "原帖未公开，不能公开其评论。");
      }
    }
    if (input.targetType === "post") {
      db.prepare("UPDATE posts SET moderation_status = ?, moderation_reason = ?, updated_at = ? WHERE id = ?")
        .run(transition.to, reason, now, target.id);
    } else {
      db.prepare("UPDATE comments SET moderation_status = ?, moderation_reason = ? WHERE id = ?")
        .run(transition.to, reason, target.id);
      db.prepare(`UPDATE posts SET
        comment_count = (SELECT COUNT(*) FROM comments WHERE post_id = ? AND moderation_status = 'published'),
        last_comment_at = COALESCE((SELECT MAX(created_at) FROM comments WHERE post_id = ? AND moderation_status = 'published'), created_at),
        updated_at = ? WHERE id = ?`).run(target.post_id, target.post_id, now, target.post_id);
    }
    recordSecurityAudit(db, { eventType: `moderation.${input.action}`, actorUserId: user.id,
      ipHash: ctx.ipHash, target: `${input.targetType}:${target.id}`, outcome: "allow", detail: reason, createdAt: now });
  })();
}

export interface OwnSubmission {
  targetType: ModerationTarget;
  id: number;
  postId: number | null;
  title: string;
  content: string;
  moderationStatus: string;
  moderationReason: string | null;
  createdAt: number;
}

export function listOwnSubmissions(db: Database.Database, user: PublicUserDto, offset = 0): OwnSubmission[] {
  const safeOffset = Number.isSafeInteger(offset) && offset > 0 ? offset : 0;
  return db.prepare(`
    SELECT 'post' AS targetType, p.id AS id,
           CASE WHEN p.moderation_status = 'published' THEN p.id ELSE NULL END AS postId,
           p.title AS title, p.content AS content, p.moderation_status AS moderationStatus,
           p.moderation_reason AS moderationReason, p.created_at AS createdAt
    FROM posts p WHERE p.author_id = ?
    UNION ALL
    SELECT 'comment' AS targetType, cm.id AS id,
           CASE WHEN p.moderation_status = 'published' THEN p.id ELSE NULL END AS postId,
           CASE WHEN p.moderation_status = 'published' THEN p.title ELSE '原帖暂不可见' END AS title,
           cm.content AS content, cm.moderation_status AS moderationStatus,
           cm.moderation_reason AS moderationReason, cm.created_at AS createdAt
    FROM comments cm JOIN posts p ON p.id = cm.post_id WHERE cm.author_id = ?
    ORDER BY createdAt DESC, id DESC LIMIT 20 OFFSET ?
  `).all(user.id, user.id, safeOffset) as OwnSubmission[];
}
