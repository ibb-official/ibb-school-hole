import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getRuntimeConfig } from "@/lib/config";
import { migrateDatabase } from "@/lib/db/schema";

const globalForDb = globalThis as typeof globalThis & {
  __ibbHoleDb?: Database.Database;
  __ibbHoleDbPath?: string;
  __ibbHoleTestDb?: Database.Database | null;
  __ibbHoleBuildDb?: Database.Database;
};

export function createMemoryDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  migrateDatabase(db);
  return db;
}

export function setDbForTesting(db: Database.Database | null): void {
  globalForDb.__ibbHoleTestDb = db;
}

export function getDb(): Database.Database {
  if (globalForDb.__ibbHoleTestDb) {
    return globalForDb.__ibbHoleTestDb;
  }

  // Next.js 构建阶段收集路由信息时会导入模块，强制走纯内存库，禁止往磁盘写入 .db
  if (process.env.NEXT_PHASE === "phase-production-build") {
    if (!globalForDb.__ibbHoleBuildDb) {
      globalForDb.__ibbHoleBuildDb = createMemoryDatabase();
    }
    return globalForDb.__ibbHoleBuildDb;
  }

  const dbPath = getRuntimeConfig().forumDbPath;
  if (globalForDb.__ibbHoleDb && globalForDb.__ibbHoleDbPath === dbPath) {
    return globalForDb.__ibbHoleDb;
  }

  if (globalForDb.__ibbHoleDb) {
    globalForDb.__ibbHoleDb.close();
    globalForDb.__ibbHoleDb = undefined;
    globalForDb.__ibbHoleDbPath = undefined;
  }

  if (dbPath !== ":memory:") {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  if (dbPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrateDatabase(db);

  globalForDb.__ibbHoleDb = db;
  globalForDb.__ibbHoleDbPath = dbPath;
  return db;
}

export function closeDb(): void {
  if (globalForDb.__ibbHoleDb) {
    globalForDb.__ibbHoleDb.close();
    globalForDb.__ibbHoleDb = undefined;
    globalForDb.__ibbHoleDbPath = undefined;
  }
  if (globalForDb.__ibbHoleBuildDb) {
    globalForDb.__ibbHoleBuildDb.close();
    globalForDb.__ibbHoleBuildDb = undefined;
  }
  globalForDb.__ibbHoleTestDb = null;
}
