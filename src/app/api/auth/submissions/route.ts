import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { listOwnSubmissions } from "@/lib/moderation-service";
import { handleApiError, requireAuthenticatedUser } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = requireAuthenticatedUser(request);
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
    const items = listOwnSubmissions(getDb(), user, offset);
    return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
