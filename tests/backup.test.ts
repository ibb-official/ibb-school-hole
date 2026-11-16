import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { it } from "node:test";
import Database from "better-sqlite3";

it("backs up a live WAL database without overwriting an existing backup", () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "forum-backup-test-"));
  const source = path.join(dir, "forum.db");
  const target = path.join(dir, "backup.db");
  const db = new Database(source);
  try {
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE sample (value TEXT NOT NULL); INSERT INTO sample VALUES ('wal data')");
    const run = () => spawnSync(process.execPath, ["scripts/backup-database.cjs", target], {
      cwd: process.cwd(),
      env: { ...process.env, FORUM_DB_PATH: source },
      encoding: "utf8",
    });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const backup = new Database(target, { readonly: true });
    try {
      assert.deepEqual(backup.prepare("SELECT value FROM sample").get(), { value: "wal data" });
    } finally {
      backup.close();
    }
    assert.notEqual(run().status, 0);
    assert.equal(fs.statSync(target).size > 0, true);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
