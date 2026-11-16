import crypto from "node:crypto";
import path from "node:path";

export type FeatureKind = "auth" | "posting";
export type CaptchaProviderName = "disabled" | "turnstile" | "altcha";
export type AiModerationProviderName = "disabled" | "openai_compatible";

export class FeatureLockedError extends Error {
  readonly code = "FEATURE_LOCKED";
  readonly status = 403;
  readonly kind: FeatureKind;

  constructor(kind: FeatureKind, message?: string) {
    super(
      message ??
        (kind === "auth"
          ? "人机验证模块接入中，当前阶段暂未开放注册与登录功能。"
          : "AI 内容审核与人机验证模块接入中，当前阶段暂未开放发帖与互动功能。")
    );
    this.name = "FeatureLockedError";
    this.kind = kind;
  }
}

export class ConfigError extends Error {
  readonly code = "CONFIG_ERROR";
  readonly status = 500;

  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface RuntimeConfig {
  nodeEnv: string;
  isProduction: boolean;
  forumDbPath: string;
  trustProxyHeaders: boolean;
  authEnabled: boolean;
  postingEnabled: boolean;
  captchaProvider: CaptchaProviderName;
  captchaSiteKey: string;
  captchaSecretKey: string;
  captchaExpectedHostname: string;
  aiModerationProvider: AiModerationProviderName;
  aiModerationApiUrl: string;
  aiModerationApiKey: string;
  aiModerationModel: string;
  aiModerationProviderName: string;
  aiModerationRetention: string;
  sessionSecret: string;
  anonymousHmacSecret: string;
  ipHashSalt: string;
  formSigningSecret: string;
  sessionCookieName: string;
  sessionTtlMs: number;
}

export interface PublicSystemStatus {
  authEnabled: boolean;
  postingEnabled: boolean;
  captchaProvider: CaptchaProviderName;
  captchaReady: boolean;
  aiModerationProvider: AiModerationProviderName;
  aiModerationReady: boolean;
  phaseBadge: string;
  lockSummary: string;
}

interface EphemeralSecrets {
  sessionSecret: string;
  anonymousHmacSecret: string;
  ipHashSalt: string;
  formSigningSecret: string;
}

const globalForSecrets = globalThis as typeof globalThis & {
  __ibbHoleEphemeralSecrets?: EphemeralSecrets;
};

function getEphemeralSecrets(): EphemeralSecrets {
  if (!globalForSecrets.__ibbHoleEphemeralSecrets) {
    globalForSecrets.__ibbHoleEphemeralSecrets = {
      sessionSecret: crypto.randomBytes(32).toString("hex"),
      anonymousHmacSecret: crypto.randomBytes(32).toString("hex"),
      ipHashSalt: crypto.randomBytes(32).toString("hex"),
      formSigningSecret: crypto.randomBytes(32).toString("hex"),
    };
  }
  return globalForSecrets.__ibbHoleEphemeralSecrets;
}

function parseBooleanFlag(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  return value.trim().toLowerCase() === "true";
}

function parseCaptchaProvider(raw: string | undefined): CaptchaProviderName {
  const normalized = (raw ?? "disabled").trim().toLowerCase();
  if (normalized === "turnstile" || normalized === "altcha") {
    return normalized;
  }
  return "disabled";
}

function parseAiProvider(raw: string | undefined): AiModerationProviderName {
  const normalized = (raw ?? "disabled").trim().toLowerCase();
  if (normalized === "openai_compatible") {
    return normalized;
  }
  return "disabled";
}

function resolveSecret(
  envValue: string | undefined,
  name: string,
  fallback: string,
  mustEnforceStrong: boolean
): string {
  const trimmed = (envValue ?? "").trim();
  if (trimmed.length >= 32) {
    return trimmed;
  }
  if (mustEnforceStrong) {
    throw new ConfigError(
      `安全配置错误：生产环境开启认证或发帖功能时，必须配置至少 32 字符的 ${name}。`
    );
  }
  return fallback;
}

export function getRuntimeConfig(): RuntimeConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const authEnabled = parseBooleanFlag(process.env.FEATURE_AUTH_ENABLED, false);
  const postingEnabled = parseBooleanFlag(process.env.FEATURE_POSTING_ENABLED, false);
  const mustEnforceStrong = isProduction && (authEnabled || postingEnabled);
  const ephemeral = getEphemeralSecrets();

  const sessionSecret = resolveSecret(
    process.env.SESSION_SECRET,
    "SESSION_SECRET",
    ephemeral.sessionSecret,
    mustEnforceStrong
  );
  const anonymousHmacSecret = resolveSecret(
    process.env.ANONYMOUS_HMAC_SECRET,
    "ANONYMOUS_HMAC_SECRET",
    ephemeral.anonymousHmacSecret,
    mustEnforceStrong
  );
  const ipHashSalt = resolveSecret(
    process.env.IP_HASH_SALT,
    "IP_HASH_SALT",
    ephemeral.ipHashSalt,
    mustEnforceStrong
  );

  const rawFormSecret = (process.env.FORM_SIGNING_SECRET ?? "").trim();
  const formSigningSecret =
    rawFormSecret.length >= 32
      ? rawFormSecret
      : mustEnforceStrong
        ? crypto
            .createHmac("sha256", sessionSecret)
            .update("ibb-school-hole:form-signing")
            .digest("hex")
        : ephemeral.formSigningSecret;

  const rawDbPath = (process.env.FORUM_DB_PATH ?? "").trim();
  const forumDbPath =
    rawDbPath.length > 0
      ? rawDbPath
      : path.join(process.cwd(), "data", "forum.db");

  return {
    nodeEnv,
    isProduction,
    forumDbPath,
    trustProxyHeaders: parseBooleanFlag(process.env.TRUST_PROXY_HEADERS, false),
    authEnabled,
    postingEnabled,
    captchaProvider: parseCaptchaProvider(process.env.CAPTCHA_PROVIDER),
    captchaSiteKey: (process.env.CAPTCHA_SITE_KEY ?? "").trim(),
    captchaSecretKey: (process.env.CAPTCHA_SECRET_KEY ?? "").trim(),
    captchaExpectedHostname: (process.env.CAPTCHA_EXPECTED_HOSTNAME ?? "").trim().toLowerCase() ||
      (isProduction ? "hole.bj166zx.cn" : ""),
    aiModerationProvider: parseAiProvider(process.env.AI_MODERATION_PROVIDER),
    aiModerationApiUrl: (process.env.AI_MODERATION_API_URL ?? "").trim(),
    aiModerationApiKey: (process.env.AI_MODERATION_API_KEY ?? "").trim(),
    aiModerationModel: (process.env.AI_MODERATION_MODEL ?? "").trim(),
    aiModerationProviderName: (process.env.AI_MODERATION_PROVIDER_NAME ?? "").trim(),
    aiModerationRetention: (process.env.AI_MODERATION_RETENTION ?? "").trim(),
    sessionSecret,
    anonymousHmacSecret,
    ipHashSalt,
    formSigningSecret,
    sessionCookieName: "ibb_hole_session",
    sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  };
}

function captchaIsReady(cfg: RuntimeConfig): boolean {
  return cfg.captchaProvider === "turnstile" && Boolean(cfg.captchaSiteKey && cfg.captchaSecretKey);
}

function moderationIsReady(cfg: RuntimeConfig): boolean {
  if (cfg.aiModerationProvider !== "openai_compatible" || !cfg.aiModerationApiKey ||
      (cfg.isProduction && (!cfg.aiModerationProviderName || !cfg.aiModerationRetention))) return false;
  try {
    const url = new URL(cfg.aiModerationApiUrl);
    return url.protocol === "https:" || (!cfg.isProduction && url.protocol === "http:");
  } catch {
    return false;
  }
}

export function assertFeatureEnabled(kind: FeatureKind): RuntimeConfig {
  const config = getRuntimeConfig();
  const captchaReady = captchaIsReady(config);
  if (kind === "auth" && (!config.authEnabled || (config.isProduction && !captchaReady))) {
    throw new FeatureLockedError("auth");
  }
  if (kind === "posting" && (!config.postingEnabled ||
      (config.isProduction && (!captchaReady || !moderationIsReady(config))))) {
    throw new FeatureLockedError("posting");
  }
  return config;
}

export function getPublicSystemStatus(): PublicSystemStatus {
  const cfg = getRuntimeConfig();
  const captchaReady = captchaIsReady(cfg);
  const aiModerationReady = moderationIsReady(cfg);
  const authEnabled = cfg.authEnabled && (!cfg.isProduction || captchaReady);
  const postingEnabled = cfg.postingEnabled && (!cfg.isProduction || (captchaReady && aiModerationReady));

  let phaseBadge = "一期锁定态 · 架构已就绪";
  let lockSummary = "账号或发帖功能尚未开放，或必要的安全服务尚未配置。";
  if (authEnabled && postingEnabled) {
    phaseBadge = "社区已开放运行";
    lockSummary = "注册登录与发帖审核通道均已开启。";
  } else if (authEnabled) {
    phaseBadge = "部分开放 · 发帖锁定中";
    lockSummary = "账号服务已开启，发帖通道仍处于锁定状态。";
  } else if (postingEnabled) {
    phaseBadge = "部分开放 · 账号锁定中";
    lockSummary = "账号服务暂未开放。";
  }

  return {
    authEnabled,
    postingEnabled,
    captchaProvider: cfg.captchaProvider,
    captchaReady,
    aiModerationProvider: cfg.aiModerationProvider,
    aiModerationReady,
    phaseBadge,
    lockSummary,
  };
}
