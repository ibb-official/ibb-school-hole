import type Database from "better-sqlite3";

export interface SecurityAuditEntry {
  eventType: string;
  actorUserId?: number | null;
  ipHash: string;
  target?: string | null;
  outcome: "allow" | "deny" | "locked" | "error";
  detail?: string | null;
  createdAt?: number;
}

let cleanupTick = 0;
const AUDIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function recordSecurityAudit(
  db: Database.Database,
  entry: SecurityAuditEntry
): void {
  const now = entry.createdAt ?? Date.now();
  if (++cleanupTick % 128 === 0) {
    db.prepare("DELETE FROM security_audit_logs WHERE created_at < ?").run(now - AUDIT_RETENTION_MS);
  }
  db.prepare(
    `
    INSERT INTO security_audit_logs (
      event_type, actor_user_id, ip_hash, target, outcome, detail, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    entry.eventType,
    entry.actorUserId ?? null,
    entry.ipHash,
    entry.target ?? null,
    entry.outcome,
    entry.detail ?? null,
    now
  );
}
