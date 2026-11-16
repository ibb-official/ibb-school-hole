import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { assertRequestSessionActive, createReport, ServiceError } from "@/lib/forum-service";
import { assertCsrf, buildSecurityContext, handleApiError, parseJsonBody, requireAuthenticatedUser } from "@/lib/http";

export const dynamic = "force-dynamic";

interface CreateReportBody {
  targetType?: "post" | "comment";
  targetId?: number;
  reasonCode?: string;
  details?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    // Reporting remains available while new posting is paused.
    assertCsrf(request);
    const user = requireAuthenticatedUser(request);
    const body = await parseJsonBody<CreateReportBody>(request);
    if (!body || (body.targetType !== "post" && body.targetType !== "comment") ||
        !Number.isSafeInteger(body.targetId) || (body.targetId ?? 0) <= 0 ||
        typeof body.reasonCode !== "string" ||
        (body.details !== undefined && body.details !== null && typeof body.details !== "string")) {
      throw new ServiceError("INVALID_REPORT", 400, "举报内容格式无效。");
    }
    const targetType = body.targetType;
    const targetId = body.targetId as number;
    const db = getDb();
    const ctx = buildSecurityContext(request);
    const result = db.transaction(() => {
      assertRequestSessionActive(db, user.id, ctx);
      const visible = targetType === "post"
        ? db.prepare("SELECT 1 FROM posts WHERE id = ? AND moderation_status = 'published'").get(targetId)
        : db.prepare(`SELECT 1 FROM comments c JOIN posts p ON p.id = c.post_id
            WHERE c.id = ? AND c.moderation_status = 'published' AND p.moderation_status = 'published'`).get(targetId);
      if (!visible) throw new ServiceError("TARGET_NOT_FOUND", 404, "被举报的内容不存在或不可见。");
      return createReport(db, user, { targetType, targetId, reasonCode: body.reasonCode as string, details: body.details ?? null }, ctx);
    })();
    return NextResponse.json({ ok: true, reportId: result.reportId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
