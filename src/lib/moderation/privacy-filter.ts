export interface ComplianceIssue {
  code:
    | "phone_number"
    | "id_card"
    | "email_exposed"
    | "social_contact"
    | "student_identity_targeting"
    | "prohibited_content";
  label: string;
  message: string;
}

export interface ComplianceCheckResult {
  passed: boolean;
  issues: ComplianceIssue[];
}

const PHONE_RE = /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])/;
const ID_CARD_RE =
  /(?:^|[^\d])[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?:$|[^\d])/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const SOCIAL_CONTACT_RE =
  /(?:微信|vx|v信|wechat|qq|企鹅号|加我|联系我|私聊我)[\s:：号=-]*[A-Za-z0-9_-]{5,}/i;
const QQ_NUMBER_RE = /(?:qq|企鹅|扣扣)[\s:：号=-]*[1-9]\d{4,11}/i;
const STUDENT_TARGET_RE =
  /(?:高[一二三]|初[一二三])[\s(（【\[]*\d{1,2}[\s)）】\]]*班|学号[\s:：#-]*\d{4,}|座号[\s:：#-]*\d{1,2}/;

const PROHIBITED_TERMS = [
  "人肉搜索",
  "开盒",
  "挂人",
  "死全家",
  "去死吧",
  "论文代写",
  "代考",
  "兼职刷单",
  "裸聊",
  "色情网站",
  "赌博平台",
];

/**
 * 纯文本分段归一化：保留自然换行与段落结构，剥离控制字符与零宽隐藏字符。
 */
export function normalizePlainText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function inspectContentCompliance(text: string): ComplianceCheckResult {
  const normalized = normalizePlainText(text);
  const issues: ComplianceIssue[] = [];

  if (PHONE_RE.test(normalized)) {
    issues.push({
      code: "phone_number",
      label: "疑似手机号",
      message: "检测到疑似手机号码。严禁公开个人或他人电话信息。",
    });
  }

  if (ID_CARD_RE.test(normalized)) {
    issues.push({
      code: "id_card",
      label: "疑似身份证号",
      message: "检测到疑似身份证件号码，已拦截以防隐私泄露。",
    });
  }

  if (EMAIL_RE.test(normalized)) {
    issues.push({
      code: "email_exposed",
      label: "疑似邮箱地址",
      message: "正文中不建议直接暴露个人邮箱地址，以防骚扰或人肉。",
    });
  }

  if (SOCIAL_CONTACT_RE.test(normalized) || QQ_NUMBER_RE.test(normalized)) {
    issues.push({
      code: "social_contact",
      label: "社交账号 / 引流",
      message: "禁止在公开帖子中发布微信、QQ 等个人社交联系方式或引流信息。",
    });
  }

  if (STUDENT_TARGET_RE.test(normalized)) {
    issues.push({
      code: "student_identity_targeting",
      label: "精准班级/学号点名",
      message: "检测到具体班级、座号或学号指向性表述，请避免精准定位师生个人。",
    });
  }

  const lower = normalized.toLowerCase();
  const hitTerm = PROHIBITED_TERMS.find((term) => lower.includes(term));
  if (hitTerm) {
    issues.push({
      code: "prohibited_content",
      label: "违规或攻击性词汇",
      message: `内容命中社区禁发词汇规则（${hitTerm}），请修改后再尝试提交。`,
    });
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
