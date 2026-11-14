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

export function recordSecurityAudit(
  db: Database.Database,
  entry: SecurityAuditEntry
): void {
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
    entry.createdAt ?? Date.now()
  );
}
