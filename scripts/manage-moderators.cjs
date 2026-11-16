#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- this is a standalone CommonJS operations script */
"use strict";

// Run only by a trusted operator with access to the forum database.
const path = require("node:path");
const Database = require("better-sqlite3");
const [action, username, requestedRole] = process.argv.slice(2);
if (!username || !["grant", "revoke"].includes(action) ||
    (action === "grant" && !["moderator", "admin"].includes(requestedRole)) ||
    (action === "revoke" && requestedRole !== undefined)) {
  console.error("Usage: node scripts/manage-moderators.cjs grant <username> <moderator|admin> | revoke <username>");
  process.exit(2);
}
const dbPath = process.env.FORUM_DB_PATH || path.join(process.cwd(), "data", "forum.db");
if (dbPath === ":memory:") {
  console.error("A persistent forum database is required.");
  process.exit(2);
}
try {
  const db = new Database(dbPath, { fileMustExist: true });
  try {
    db.pragma("foreign_keys = ON");
    const result = db.transaction(() => {
      const user = db.prepare("SELECT id, username, role, status FROM users WHERE username_normalized = ?")
        .get(username.trim().toLowerCase());
      if (!user) throw new Error("User does not exist.");
      if (user.status !== "active" && action === "grant") throw new Error("Cannot grant a role to an inactive user.");
      const role = action === "grant" ? requestedRole : "user";
      const now = Date.now();
      db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(role, now, user.id);
      db.prepare(`INSERT INTO security_audit_logs
        (event_type, actor_user_id, ip_hash, target, outcome, detail, created_at)
        VALUES ('moderation.role_change', NULL, 'offline-cli', ?, 'allow', ?, ?)`)
        .run(`user:${user.id}`, `${user.role}->${role}`, now);
      return { username: user.username, role };
    })();
    console.log(`Role updated: ${result.username} -> ${result.role}`);
  } finally {
    db.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Role update failed.");
  process.exitCode = 1;
}
