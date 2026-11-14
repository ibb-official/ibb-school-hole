import { NextResponse } from "next/server";
import { getPublicSystemStatus } from "@/lib/config";
import { getDb } from "@/lib/db";
import { getForumStats } from "@/lib/forum-service";
import { handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const system = getPublicSystemStatus();
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
