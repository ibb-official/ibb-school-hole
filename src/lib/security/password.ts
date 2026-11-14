import crypto from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_BYTES = 16;

const WEAK_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password123",
  "qwerty123",
  "11111111",
  "00000000",
  "abc12345",
  "admin123",
  "bj166123",
  "bj166166",
  "166166166",
  "iloveyou",
]);

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 },
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scryptAsync(plain, salt);
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") {
    return false;
  }
  const saltHex = parts[2];
  const expectedHex = parts[3];
  if (!saltHex || !expectedHex) {
    return false;
  }
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    if (salt.length === 0 || expected.length !== KEY_LEN) {
      return false;
    }
    const derived = await scryptAsync(plain, salt);
    if (derived.length !== expected.length) {
      return false;
    }
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

const DUMMY_SALT = Buffer.from("00112233445566778899aabbccddeeff", "hex");

export async function verifyDummyPassword(plain: string): Promise<void> {
  await scryptAsync(plain || "dummy-password", DUMMY_SALT);
}

export function validatePasswordStrength(
  plain: string,
  username?: string
): { ok: true } | { ok: false; error: string } {
  if (plain.length < 8) {
    return { ok: false, error: "密码长度至少需要 8 位字符。" };
  }
  if (plain.length > 72) {
    return { ok: false, error: "密码长度不能超过 72 位字符。" };
  }
  if (!/[A-Za-z]/.test(plain) || !/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(plain)) {
    return {
      ok: false,
      error: "密码需同时包含英文字母与至少一位数字或符号。",
    };
  }
  const lower = plain.toLowerCase();
  if (WEAK_PASSWORDS.has(lower)) {
    return { ok: false, error: "该密码过于常见，请更换安全性更高的密码。" };
  }
  if (username && username.trim().length >= 3) {
    const normUser = username.trim().toLowerCase();
    if (lower.includes(normUser)) {
      return { ok: false, error: "密码不能包含用户名本身。" };
    }
  }
  return { ok: true };
}
