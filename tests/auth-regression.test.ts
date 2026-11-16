import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type Database from "better-sqlite3";
import { createMemoryDatabase } from "../src/lib/db";
import { assertFeatureEnabled, FeatureLockedError, getPublicSystemStatus } from "../src/lib/config";
import { authenticateUser, registerUser, ServiceError } from "../src/lib/forum-service";
import { parseJsonBody } from "../src/lib/http";
import { issueFormTimingToken } from "../src/lib/security/antibot";
import { verifyCaptchaToken } from "../src/lib/security/captcha";
import { extractClientIp } from "../src/lib/security/ip";

const keys = ["NODE_ENV", "FEATURE_AUTH_ENABLED", "FEATURE_POSTING_ENABLED", "CAPTCHA_PROVIDER", "CAPTCHA_SITE_KEY", "CAPTCHA_SECRET_KEY", "CAPTCHA_EXPECTED_HOSTNAME", "AI_MODERATION_PROVIDER", "AI_MODERATION_API_URL", "AI_MODERATION_API_KEY", "AI_MODERATION_PROVIDER_NAME", "AI_MODERATION_RETENTION", "SESSION_SECRET", "ANONYMOUS_HMAC_SECRET", "IP_HASH_SALT", "FORM_SIGNING_SECRET", "TRUST_PROXY_HEADERS"];
const env = process.env as Record<string, string | undefined>;
let saved: Record<string, string | undefined>;
let db: Database.Database;

describe("auth and gateway regression", () => {
  beforeEach(() => {
    saved = Object.fromEntries(keys.map(k => [k, env[k]]));
    for (const key of keys) delete env[key];
    env.NODE_ENV = "test";
    db = createMemoryDatabase();
  });
  afterEach(() => {
    db.close();
    for (const key of keys) {
      if (saved[key] === undefined) delete env[key]; else env[key] = saved[key];
    }
  });

  it("fails closed in production until Turnstile and the external moderator are fully configured", () => {
    env.NODE_ENV = "production";
    env.FEATURE_AUTH_ENABLED = "true";
    env.FEATURE_POSTING_ENABLED = "true";
    env.SESSION_SECRET = "s".repeat(40);
    env.ANONYMOUS_HMAC_SECRET = "a".repeat(40);
    env.IP_HASH_SALT = "i".repeat(40);
    assert.equal(getPublicSystemStatus().authEnabled, false);
    assert.equal(getPublicSystemStatus().postingEnabled, false);
    assert.throws(() => assertFeatureEnabled("auth"), FeatureLockedError);
    env.CAPTCHA_PROVIDER = "altcha";
    env.CAPTCHA_SECRET_KEY = "secret";
    env.CAPTCHA_SITE_KEY = "site";
    assert.equal(getPublicSystemStatus().captchaReady, false);
    env.CAPTCHA_PROVIDER = "turnstile";
    assert.equal(getPublicSystemStatus().authEnabled, true);
    assert.equal(getPublicSystemStatus().postingEnabled, false);
    env.AI_MODERATION_PROVIDER = "openai_compatible";
    env.AI_MODERATION_API_URL = "http://moderation.example.test/v1";
    env.AI_MODERATION_API_KEY = "secret";
    assert.equal(getPublicSystemStatus().postingEnabled, false);
    env.AI_MODERATION_PROVIDER_NAME = "provider";
    env.AI_MODERATION_RETENTION = "30 days";
    assert.equal(getPublicSystemStatus().postingEnabled, false);
    env.AI_MODERATION_API_URL = "https://moderation.example.test/v1";
    assert.equal(getPublicSystemStatus().postingEnabled, true);
  });

  it("ignores untrusted X-Real-IP when the Caddy forwarding header is enabled", () => {
    env.TRUST_PROXY_HEADERS = "true";
    const headers = new Headers({ "x-real-ip": "203.0.113.22", "x-forwarded-for": "198.51.100.1" });
    assert.equal(extractClientIp(headers), "198.51.100.1");
  });

  it("rejects an oversized streamed JSON body before reading subsequent chunks", async () => {
    let reads = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads++;
        controller.enqueue(new Uint8Array(40000));
        if (reads === 4) controller.close();
      },
    });
    const request = new Request("http://localhost/api/test", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await assert.rejects(parseJsonBody(request), (error: unknown) => error instanceof ServiceError && error.code === "PAYLOAD_TOO_LARGE");
    assert.ok(reads < 4);
  });

  it("counts concurrent failed logins atomically without locking other networks out", async () => {
    const now = Date.now();
    const token = issueFormTimingToken(now - 5000);
    const form = { formIssuedAt: token.issuedAt, formSig: token.sig };
    const user = await registerUser(db, { username: "SampleAuth", password: "SecurePass123!", agreedRules: true, ...form }, { ipHash: "reg", userAgentHash: "ua", nowMs: now });
    const failures = await Promise.allSettled(Array.from({ length: 6 }, (_, n) => authenticateUser(db,
      { identifier: "SampleAuth", password: "WrongPassword1!", ...form },
      { ipHash: `ip-${n}`, userAgentHash: "ua", nowMs: now + 1000 }
    )));
    assert.equal(failures.filter(x => x.status === "rejected").length, 6);
    const row = db.prepare("SELECT failed_login_count, locked_until FROM users WHERE id = ?").get(user.user.id) as { failed_login_count: number; locked_until: number | null };
    assert.equal(row.failed_login_count, 6);
    assert.equal(row.locked_until, null);
    const login = await authenticateUser(db, { identifier: "SampleAuth", password: "SecurePass123!", ...form }, { ipHash: "legitimate", userAgentHash: "ua", nowMs: now + 2000 });
    assert.equal(login.user.id, user.user.id);
  });

  it("does not spend successful registration quota on invalid forms and handles duplicate races", async () => {
    const now = Date.now();
    const token = issueFormTimingToken(now - 5000);
    const form = { formIssuedAt: token.issuedAt, formSig: token.sig };
    const ctx = { ipHash: "shared", userAgentHash: "ua", nowMs: now };
    for (let i = 0; i < 3; i++) {
      await assert.rejects(registerUser(db, { username: "x", password: "SecurePass123!", agreedRules: true, ...form }, ctx), (error: unknown) => error instanceof ServiceError && error.code === "INVALID_USERNAME");
    }
    await registerUser(db, { username: "ValidFirst", password: "SecurePass123!", agreedRules: true, ...form }, ctx);
    const attempts = await Promise.allSettled([1, 2].map(i => registerUser(db,
      { username: "SameName", password: "SecurePass123!", agreedRules: true, ...form },
      { ...ctx, ipHash: `race-${i}` }
    )));
    assert.equal(attempts.filter(x => x.status === "fulfilled").length, 1);
    const rejected = attempts.find(x => x.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected" && rejected.reason instanceof ServiceError && rejected.reason.status === 409);
  });

  it("validates Turnstile action and hostname, and fails closed on a mismatch", async () => {
    env.CAPTCHA_PROVIDER = "turnstile";
    env.CAPTCHA_SECRET_KEY = "secret";
    env.CAPTCHA_EXPECTED_HOSTNAME = "hole.example.test";
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => Response.json({ success: true, action: "login", hostname: "hole.example.test" });
      assert.equal((await verifyCaptchaToken("token", "hash", "login")).ok, true);
      assert.equal((await verifyCaptchaToken("token", "hash", "register")).ok, false);
      globalThis.fetch = async () => Response.json({ success: true, action: "login", hostname: "evil.example.test" });
      assert.equal((await verifyCaptchaToken("token", "hash", "login")).ok, false);
    } finally { globalThis.fetch = originalFetch; }
  });
});
