import crypto from "node:crypto";
import { getRuntimeConfig } from "@/lib/config";

export interface FormTimingToken {
  issuedAt: number;
  sig: string;
}

export interface AntiBotSignalsInput {
  websiteHoneypot?: string | null;
  formIssuedAt?: number | null;
  formSig?: string | null;
  nowMs?: number;
  minElapsedMs?: number;
}

const DEFAULT_MIN_ELAPSED_MS = 2500;
const MAX_TOKEN_AGE_MS = 2 * 60 * 60 * 1000;

function signTimestamp(issuedAt: number): string {
  const cfg = getRuntimeConfig();
  return crypto
    .createHmac("sha256", cfg.formSigningSecret)
    .update(`form-issued:${issuedAt}`)
    .digest("hex");
}

export function issueFormTimingToken(nowMs = Date.now()): FormTimingToken {
  return {
    issuedAt: nowMs,
    sig: signTimestamp(nowMs),
  };
}

export function verifyAntiBotSignals(
  input: AntiBotSignalsInput
): { ok: true } | { ok: false; reason: string; message: string } {
  if (input.websiteHoneypot != null &&
      (typeof input.websiteHoneypot !== "string" || input.websiteHoneypot.trim().length > 0)) {
    return {
      ok: false,
      reason: "HONEYPOT_TRIGGERED",
      message: "请求未通过安全验证，请刷新页面后手动填写提交。",
    };
  }

  const issuedAt = input.formIssuedAt;
  const sig = input.formSig;

  if (
    typeof issuedAt !== "number" ||
    !Number.isFinite(issuedAt) ||
    typeof sig !== "string" ||
    sig.length < 32
  ) {
    return {
      ok: false,
      reason: "MISSING_FORM_TOKEN",
      message: "表单安全令牌缺失或无效，请刷新页面后重试。",
    };
  }

  const expectedSig = signTimestamp(issuedAt);
  try {
    const actualBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (
      actualBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(actualBuf, expectedBuf)
    ) {
      return {
        ok: false,
        reason: "INVALID_FORM_SIG",
        message: "表单安全令牌校验失败，请刷新页面后重试。",
      };
    }
  } catch {
    return {
      ok: false,
      reason: "INVALID_FORM_SIG",
      message: "表单安全令牌格式无效，请刷新页面后重试。",
    };
  }

  const now = input.nowMs ?? Date.now();
  const elapsed = now - issuedAt;
  const minElapsed = input.minElapsedMs ?? DEFAULT_MIN_ELAPSED_MS;

  if (elapsed < minElapsed) {
    return {
      ok: false,
      reason: "SUBMITTED_TOO_FAST",
      message: "提交速度过快，请核对填写内容后再试。",
    };
  }

  if (elapsed > MAX_TOKEN_AGE_MS) {
    return {
      ok: false,
      reason: "FORM_TOKEN_EXPIRED",
      message: "页面停留超时，请刷新页面后重新提交。",
    };
  }

  return { ok: true };
}
