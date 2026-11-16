import { NextResponse } from "next/server";
import { getForumSystemStatus } from "@/lib/forum-status";
import { getDb } from "@/lib/db";
import { getForumStats } from "@/lib/forum-service";
import { handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const system = getForumSystemStatus();
    const stats = getForumStats(db);
    return NextResponse.json({
      ok: true,
      system,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
