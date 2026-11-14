import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/forum-service";
import { getRequestSessionToken, handleApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = getRequestSessionToken(request);
    const user = getSessionUser(getDb(), token);
    return NextResponse.json({
      ok: true,
      user,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
