import { NextResponse, type NextRequest } from "next/server";
import { assertFeatureEnabled } from "@/lib/config";
import { getDb } from "@/lib/db";
import { authenticateUser } from "@/lib/forum-service";
import {
  assertCsrf,
  buildSecurityContext,
  handleApiError,
  parseJsonBody,
  setSessionCookie,
} from "@/lib/http";

export const dynamic = "force-dynamic";

interface LoginRequestBody {
  identifier?: string;
  password?: string;
  captchaToken?: string | null;
  website?: string | null;
  formIssuedAt?: number | null;
  formSig?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    assertFeatureEnabled("auth");
    assertCsrf(request);

    const body = await parseJsonBody<LoginRequestBody>(request);
    const ctx = buildSecurityContext(request);
    const result = await authenticateUser(
      getDb(),
      {
        identifier: body.identifier ?? "",
        password: body.password ?? "",
        captchaToken: body.captchaToken ?? null,
        websiteHoneypot: body.website ?? null,
        formIssuedAt: body.formIssuedAt ?? null,
        formSig: body.formSig ?? null,
      },
      ctx
    );

    const response = NextResponse.json({
      ok: true,
      user: result.user,
    });
    setSessionCookie(response, result.rawSessionToken, result.expiresAt);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
