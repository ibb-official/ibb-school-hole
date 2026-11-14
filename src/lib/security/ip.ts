import crypto from "node:crypto";
import net from "node:net";
import { getRuntimeConfig } from "@/lib/config";

type HeaderSource = Headers | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderSource, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  const lowerName = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lowerName) {
      if (Array.isArray(v)) return v[0] ?? null;
      return v ?? null;
    }
  }
  return null;
}

function normalizeIp(candidate: string | null): string | null {
  if (!candidate) return null;
  let cleaned = candidate.trim();
  if (cleaned.startsWith("[") && cleaned.includes("]")) {
    cleaned = cleaned.slice(1, cleaned.indexOf("]"));
  } else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(cleaned)) {
    cleaned = cleaned.split(":")[0];
  }
  if (cleaned.startsWith("::ffff:")) {
    cleaned = cleaned.slice(7);
  }
  return net.isIP(cleaned) ? cleaned : null;
}

/**
 * 仅在 TRUST_PROXY_HEADERS=true（明确由本机 edge-caddy 反向代理透传）时采信转发头，
 * 避免公网请求直接伪造 X-Forwarded-For 绕过防爆破与注册配额限制。
 */
export function extractClientIp(headers: HeaderSource): string {
  const cfg = getRuntimeConfig();
  if (!cfg.trustProxyHeaders) {
    return "127.0.0.1";
  }

  const realIp = normalizeIp(readHeader(headers, "x-real-ip"));
  if (realIp) {
    return realIp;
  }

  const forwardedFor = readHeader(headers, "x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((part) => part.trim());
    for (const part of parts) {
      const valid = normalizeIp(part);
      if (valid) return valid;
    }
  }

  return "127.0.0.1";
}

export function hashClientIp(ip: string): string {
  const cfg = getRuntimeConfig();
  return crypto
    .createHmac("sha256", cfg.ipHashSalt)
    .update(ip)
    .digest("hex");
}

export function hashUserAgent(userAgent: string | null): string {
  const cfg = getRuntimeConfig();
  return crypto
    .createHmac("sha256", cfg.ipHashSalt)
    .update(userAgent ?? "unknown-ua")
    .digest("hex")
    .slice(0, 32);
}
