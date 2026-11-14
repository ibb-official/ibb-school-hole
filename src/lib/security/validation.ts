const RESERVED_USERNAME_KEYWORDS = [
  "admin",
  "administrator",
  "root",
  "system",
  "moderator",
  "official",
  "support",
  "staff",
  "bj166",
  "bj166zx",
  "166中",
  "一六六",
  "官方",
  "管理员",
  "版主",
  "站长",
  "教务",
  "校长",
  "校方",
  "老师",
  "洞主",
  "匿名同学",
];

const USERNAME_CHAR_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]+$/;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[A-Za-z]{2,}$/;

export function validateUsername(
  raw: string
):
  | { ok: true; username: string; normalized: string }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  const charCount = [...trimmed].length;

  if (charCount < 3 || charCount > 20) {
    return {
      ok: false,
      error: "用户名长度需在 3 至 20 个字符之间。",
    };
  }

  if (!USERNAME_CHAR_RE.test(trimmed)) {
    return {
      ok: false,
      error: "用户名仅支持中文、英文字母、数字与下划线（_）。",
    };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      error: "为保护隐私与防学号泄露，禁止使用纯数字（如学号）作为用户名。",
    };
  }

  if (/^(?:19|20)\d{6,}$/.test(trimmed)) {
    return {
      ok: false,
      error: "用户名格式疑似入学年份或学号编号，请更换其他昵称。",
    };
  }

  const lower = trimmed.toLowerCase();
  for (const reserved of RESERVED_USERNAME_KEYWORDS) {
    if (lower.includes(reserved)) {
      return {
        ok: false,
        error: `用户名包含保留或易产生官方误导的词组（${reserved}），请更换。`,
      };
    }
  }

  return {
    ok: true,
    username: trimmed,
    normalized: lower,
  };
}

export function validateOptionalEmail(
  raw?: string | null
): { ok: true; email: string | null } | { ok: false; error: string } {
  if (!raw || raw.trim().length === 0) {
    return { ok: true, email: null };
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized.length > 120) {
    return { ok: false, error: "邮箱地址长度不能超过 120 个字符。" };
  }

  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "邮箱格式不正确，请核对后重试（若不绑定可留空）。" };
  }

  return { ok: true, email: normalized };
}
