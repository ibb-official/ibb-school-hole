import { NextResponse, type NextRequest } from "next/server";
import { assertFeatureEnabled } from "@/lib/config";
import { getDb } from "@/lib/db";
import { registerUser } from "@/lib/forum-service";
import {
  assertCsrf,
  buildSecurityContext,
  handleApiError,
  parseJsonBody,
  setSessionCookie,
} from "@/lib/http";

export const dynamic = "force-dynamic";

interface RegisterRequestBody {
  username?: string;
  email?: string | null;
  password?: string;
  agreedRules?: boolean;
  captchaToken?: string | null;
  website?: string | null;
  formIssuedAt?: number | null;
  formSig?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    assertFeatureEnabled("auth");
    assertCsrf(request);

    const body = await parseJsonBody<RegisterRequestBody>(request);
    const ctx = buildSecurityContext(request);
    const result = await registerUser(
      getDb(),
      {
        username: body.username ?? "",
        email: body.email ?? null,
        password: body.password ?? "",
        agreedRules: body.agreedRules === true,
        captchaToken: body.captchaToken ?? null,
        websiteHoneypot: body.website ?? null,
        formIssuedAt: body.formIssuedAt ?? null,
        formSig: body.formSig ?? null,
      },
      ctx
    );

    const response = NextResponse.json(
      {
        ok: true,
        user: result.user,
      },
      { status: 201 }
    );
    setSessionCookie(response, result.rawSessionToken, result.expiresAt);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
