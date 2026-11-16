import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { createMemoryDatabase, setDbForTesting } from "../src/lib/db";
import { FeatureLockedError } from "../src/lib/config";
import { assertPostingEnabled, getForumSystemStatus } from "../src/lib/forum-status";

const env = process.env as Record<string, string | undefined>;
const values: Record<string, string> = {
  NODE_ENV: "production",
  FEATURE_AUTH_ENABLED: "true",
  FEATURE_POSTING_ENABLED: "true",
  CAPTCHA_PROVIDER: "turnstile",
  CAPTCHA_SITE_KEY: "example-site-key",
  CAPTCHA_SECRET_KEY: "example-secret-key",
  AI_MODERATION_PROVIDER: "openai_compatible",
  AI_MODERATION_API_URL: "https://moderation.example.test/v1",
  AI_MODERATION_API_KEY: "example-api-key",
  AI_MODERATION_PROVIDER_NAME: "Test provider",
  AI_MODERATION_RETENTION: "30 days",
  SESSION_SECRET: "s".repeat(40),
  ANONYMOUS_HMAC_SECRET: "a".repeat(40),
  IP_HASH_SALT: "i".repeat(40),
};
const saved = Object.fromEntries(Object.keys(values).map((key) => [key, env[key]]));
const db = createMemoryDatabase();

before(() => {
  Object.assign(env, values);
  setDbForTesting(db);
});

after(() => {
  setDbForTesting(null);
  db.close();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
});

it("keeps production posting closed until an active moderator can handle reports", () => {
  assert.equal(getForumSystemStatus().postingEnabled, false);
  assert.throws(() => assertPostingEnabled(), FeatureLockedError);

  db.prepare(`INSERT INTO users (username, username_normalized, password_hash, role, status, created_at, updated_at)
    VALUES ('Moderator', 'moderator', 'hash', 'moderator', 'active', 1, 1)`).run();
  assert.equal(getForumSystemStatus().postingEnabled, true);
  assert.doesNotThrow(() => assertPostingEnabled());

  db.prepare("UPDATE users SET status = 'suspended' WHERE username_normalized = 'moderator'").run();
  assert.equal(getForumSystemStatus().postingEnabled, false);
  assert.throws(() => assertPostingEnabled(), FeatureLockedError);
});
