import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { revokeSession } from "@/lib/forum-service";
import {
  assertCsrf,
  clearSessionCookie,
  getRequestSessionToken,
  handleApiError,
} from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertCsrf(request);
    const token = getRequestSessionToken(request);
    if (token) {
      revokeSession(getDb(), token);
    }
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
