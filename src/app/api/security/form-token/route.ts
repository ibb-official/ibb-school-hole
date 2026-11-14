import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/http";
import { issueFormTimingToken } from "@/lib/security/antibot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = issueFormTimingToken();
    return NextResponse.json({
      ok: true,
      ...token,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
