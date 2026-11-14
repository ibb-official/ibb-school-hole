import { NextResponse, type NextRequest } from "next/server";
import {
  ConfigError,
  FeatureLockedError,
  getRuntimeConfig,
} from "@/lib/config";
import { getDb } from "@/lib/db";
import {
  getSessionUser,
  ServiceError,
  type PublicUserDto,
  type RequestSecurityContext,
} from "@/lib/forum-service";
import { verifyCsrfRequest } from "@/lib/security/csrf";
import {
  extractClientIp,
  hashClientIp,
  hashUserAgent,
} from "@/lib/security/ip";

export function buildSecurityContext(request: Request): RequestSecurityContext {
  const clientIp = extractClientIp(request.headers);
  const ipHash = hashClientIp(clientIp);
  const userAgentHash = hashUserAgent(request.headers.get("user-agent"));
  return { ipHash, userAgentHash };
}

export function assertCsrf(request: Request): void {
  const check = verifyCsrfRequest(request);
  if (!check.ok) {
    throw new ServiceError("CSRF_FAILED", 403, check.error);
  }
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 65536) {
    throw new ServiceError("PAYLOAD_TOO_LARGE", 413, "请求体体积超出限制。");
  }
  if (!raw.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ServiceError("INVALID_JSON", 400, "请求体 JSON 格式无效。");
  }
}

export function setSessionCookie(
  response: NextResponse,
  rawToken: string,
  expiresAt: number
): void {
  const cfg = getRuntimeConfig();
  response.cookies.set(cfg.sessionCookieName, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: cfg.isProduction,
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  const cfg = getRuntimeConfig();
  response.cookies.set(cfg.sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cfg.isProduction,
    path: "/",
    maxAge: 0,
  });
}

export function getRequestSessionToken(request: NextRequest): string | null {
  const cfg = getRuntimeConfig();
  return request.cookies.get(cfg.sessionCookieName)?.value ?? null;
}

export function requireAuthenticatedUser(request: NextRequest): PublicUserDto {
  const token = getRequestSessionToken(request);
  const user = getSessionUser(getDb(), token);
  if (!user) {
    throw new ServiceError("UNAUTHORIZED", 401, "请先登录后再进行此操作。");
  }
  return user;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof FeatureLockedError) {
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        kind: error.kind,
        message: error.message,
      },
      { status: error.status }
    );
  }

  if (error instanceof ConfigError) {
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        message: error.message,
      },
      { status: error.status }
    );
  }

  if (error instanceof ServiceError) {
    const headers: Record<string, string> = {};
    if (error.retryAfterSeconds) {
      headers["Retry-After"] = String(error.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        message: error.message,
        ...(error.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
        ...(error.issues && error.issues.length > 0
          ? { issues: error.issues }
          : {}),
      },
      { status: error.status, headers }
    );
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json(
    {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "服务器处理请求时出现异常，请稍后再试。",
    },
    { status: 500 }
  );
}
