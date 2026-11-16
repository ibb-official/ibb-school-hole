#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- standalone operations script */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

async function main() {
  const destinationArg = process.argv[2];
  if (!destinationArg || process.argv.length !== 3) {
    throw new Error("Usage: node scripts/backup-database.cjs <new-backup-path>");
  }
  const source = path.resolve(process.env.FORUM_DB_PATH || path.join(process.cwd(), "data", "forum.db"));
  const destination = path.resolve(destinationArg);
  if (source === destination) throw new Error("Backup destination must differ from the source.");

  const db = new Database(source, { readonly: true, fileMustExist: true });
  let created = false;
  try {
    // Never overwrite a previous backup, including an existing symlink.
    const file = fs.openSync(destination, "wx", 0o600);
    fs.closeSync(file);
    created = true;
    await db.backup(destination);
    const backup = new Database(destination, { readonly: true, fileMustExist: true });
    try {
      if (backup.pragma("integrity_check", { simple: true }) !== "ok") {
        throw new Error("Backup integrity check failed.");
      }
    } finally {
      backup.close();
    }
    console.log(`SQLite backup verified: ${destination}`);
  } catch (error) {
    if (created) fs.unlinkSync(destination);
    throw error;
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backup failed.");
  process.exitCode = 1;
});
