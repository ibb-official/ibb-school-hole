import { getRuntimeConfig } from "@/lib/config";

export interface CaptchaVerificationResult {
  ok: boolean;
  provider: string;
  error?: string;
}

export interface CaptchaProvider {
  readonly name: string;
  verify(token: string | null | undefined, ipHash: string): Promise<CaptchaVerificationResult>;
}

const disabledCaptchaProvider: CaptchaProvider = {
  name: "disabled",
  async verify() {
    return { ok: true, provider: "disabled" };
  },
};

const turnstileCaptchaProvider: CaptchaProvider = {
  name: "turnstile",
  async verify(token) {
    const cfg = getRuntimeConfig();
    if (!cfg.captchaSecretKey) {
      return {
        ok: false,
        provider: "turnstile",
        error: "人机验证服务端密钥未配置，拒绝放行。",
      };
    }
    if (!token || token.trim().length === 0) {
      return {
        ok: false,
        provider: "turnstile",
        error: "请先完成人机验证后再提交。",
      };
    }

    try {
      const formBody = new URLSearchParams({
        secret: cfg.captchaSecretKey,
        response: token.trim(),
      });
      const response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody,
        }
      );
      if (!response.ok) {
        return {
          ok: false,
          provider: "turnstile",
          error: "人机验证服务响应异常，请稍后重试。",
        };
      }
      const data = (await response.json()) as { success?: boolean };
      if (!data.success) {
        return {
          ok: false,
          provider: "turnstile",
          error: "人机验证未通过，请重新完成验证。",
        };
      }
      return { ok: true, provider: "turnstile" };
    } catch {
      return {
        ok: false,
        provider: "turnstile",
        error: "无法连接到人机验证服务，请稍后重试。",
      };
    }
  },
};

const altchaCaptchaProvider: CaptchaProvider = {
  name: "altcha",
  async verify(token) {
    const cfg = getRuntimeConfig();
    if (!cfg.captchaSecretKey) {
      return {
        ok: false,
        provider: "altcha",
        error: "Altcha 自托管验证密钥尚未配置。",
      };
    }
    if (!token || token.trim().length === 0) {
      return {
        ok: false,
        provider: "altcha",
        error: "请先完成工作量证明人机校验后再提交。",
      };
    }
    return {
      ok: false,
      provider: "altcha",
      error: "Altcha 校验器待二期完整接入后启用。",
    };
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
  ipHash: string
): Promise<CaptchaVerificationResult> {
  return getCaptchaProvider().verify(token, ipHash);
}
