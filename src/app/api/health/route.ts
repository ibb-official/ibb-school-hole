import { NextResponse } from "next/server";
import { getPublicSystemStatus } from "@/lib/config";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    const status = getPublicSystemStatus();
    return NextResponse.json({
      ok: row.ok === 1,
      service: "ibb-school-hole",
      database: "sqlite-wal-ready",
      authEnabled: status.authEnabled,
      postingEnabled: status.postingEnabled,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        service: "ibb-school-hole",
        database: "unavailable",
      },
      { status: 503 }
    );
  }
}
