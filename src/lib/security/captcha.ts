import { getRuntimeConfig } from "@/lib/config";

export interface CaptchaVerificationResult {
  ok: boolean;
  provider: string;
  error?: string;
}

export interface CaptchaProvider {
  readonly name: string;
  verify(token: string | null | undefined, ipHash: string, action?: string): Promise<CaptchaVerificationResult>;
}

const disabledCaptchaProvider: CaptchaProvider = {
  name: "disabled",
  async verify() {
    if (getRuntimeConfig().isProduction) {
      return { ok: false, provider: "disabled", error: "人机验证尚未配置。" };
    }
    return { ok: true, provider: "disabled" };
  },
};

const turnstileCaptchaProvider: CaptchaProvider = {
  name: "turnstile",
  async verify(token, _ipHash, action) {
    const cfg = getRuntimeConfig();
    if (!cfg.captchaSecretKey) {
      return { ok: false, provider: "turnstile", error: "人机验证尚未配置。" };
    }
    if (!token || typeof token !== "string" || token.trim().length === 0 || token.length > 2048) {
      return { ok: false, provider: "turnstile", error: "请先完成人机验证后再提交。" };
    }

    try {
      const body = new URLSearchParams({ secret: cfg.captchaSecretKey, response: token.trim() });
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("siteverify unavailable");
      const data = (await response.json()) as { success?: boolean; action?: string; hostname?: string };
      if (!data.success || (action && data.action !== action) ||
          (cfg.captchaExpectedHostname && data.hostname?.toLowerCase() !== cfg.captchaExpectedHostname)) {
        return { ok: false, provider: "turnstile", error: "人机验证未通过，请重新完成验证。" };
      }
      return { ok: true, provider: "turnstile" };
    } catch {
      return { ok: false, provider: "turnstile", error: "人机验证服务暂不可用，请稍后重试。" };
    }
  },
};

const altchaCaptchaProvider: CaptchaProvider = {
  name: "altcha",
  async verify() {
    return { ok: false, provider: "altcha", error: "该人机验证方式尚未接入。" };
  },
};

export function getCaptchaProvider(): CaptchaProvider {
  const provider = getRuntimeConfig().captchaProvider;
  if (provider === "turnstile") return turnstileCaptchaProvider;
  if (provider === "altcha") return altchaCaptchaProvider;
  return disabledCaptchaProvider;
}

export async function verifyCaptchaToken(
  token: string | null | undefined,
  ipHash: string,
  action?: string
): Promise<CaptchaVerificationResult> {
  return getCaptchaProvider().verify(token, ipHash, action);
}
