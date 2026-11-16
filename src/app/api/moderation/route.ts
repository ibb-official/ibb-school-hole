import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ServiceError } from "@/lib/forum-service";
import { assertModerator, listModerationQueue, moderateContent, type ModerationAction, type ModerationTarget } from "@/lib/moderation-service";
import { assertCsrf, buildSecurityContext, handleApiError, parseJsonBody, requireAuthenticatedUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = requireAuthenticatedUser(request);
    assertModerator(user);
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
    return NextResponse.json({ ok: true, ...listModerationQueue(getDb(), user, offset) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertCsrf(request);
    const user = requireAuthenticatedUser(request);
    assertModerator(user);
    const body = await parseJsonBody<{ action: ModerationAction; targetType?: ModerationTarget; targetId: number; reason?: string }>(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ServiceError("INVALID_INPUT", 400, "审核请求格式无效。");
    }
    moderateContent(getDb(), user, body, buildSecurityContext(request));
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
