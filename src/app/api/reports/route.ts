import { NextResponse, type NextRequest } from "next/server";
import { assertFeatureEnabled } from "@/lib/config";
import { getDb } from "@/lib/db";
import { createReport } from "@/lib/forum-service";
import {
  assertCsrf,
  buildSecurityContext,
  handleApiError,
  parseJsonBody,
  requireAuthenticatedUser,
} from "@/lib/http";

export const dynamic = "force-dynamic";

interface CreateReportBody {
  targetType?: "post" | "comment";
  targetId?: number;
  reasonCode?: string;
  details?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    assertFeatureEnabled("posting");
    assertCsrf(request);
    const user = requireAuthenticatedUser(request);
    const body = await parseJsonBody<CreateReportBody>(request);
    const ctx = buildSecurityContext(request);

    const result = createReport(
      getDb(),
      user,
      {
        targetType: body.targetType === "comment" ? "comment" : "post",
        targetId: Number(body.targetId ?? 0),
        reasonCode: body.reasonCode ?? "",
        details: body.details ?? null,
      },
      ctx
    );

    return NextResponse.json(
      {
        ok: true,
        reportId: result.reportId,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
