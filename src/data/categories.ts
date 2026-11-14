export interface CategoryDefinition {
  slug: string;
  name: string;
  description: string;
  accentColor: string;
  allowAnonymous: boolean;
  minTrustLevel: number;
  sortOrder: number;
}

export const DEFAULT_CATEGORIES: readonly CategoryDefinition[] = [
  {
    slug: "daily",
    name: "校园日常",
    description: "食堂吐槽、操场夕阳、课间趣事与日常生活分享",
    accentColor: "#2563EB",
    allowAnonymous: false,
    minTrustLevel: 0,
    sortOrder: 1,
  },
  {
    slug: "study",
    name: "学习交流",
    description: "作业答疑、资料经验、竞赛备考与学习方法讨论",
    accentColor: "#059669",
    allowAnonymous: false,
    minTrustLevel: 0,
    sortOrder: 2,
  },
  {
    slug: "guidance",
    name: "选科与升学",
    description: "选科组合参考、志愿经验、学长学姐问答与规划交流",
    accentColor: "#7C3AED",
    allowAnonymous: false,
    minTrustLevel: 0,
    sortOrder: 3,
  },
  {
    slug: "club",
    name: "社团与活动",
    description: "社团招新、校园艺术节、运动会与文化活动记录",
    accentColor: "#D97706",
    allowAnonymous: false,
    minTrustLevel: 0,
    sortOrder: 4,
  },
  {
    slug: "lostfound",
    name: "失物招领",
    description: "校内遗失物品登记与拾获招领（严禁发布个人联系方式）",
    accentColor: "#0284C7",
    allowAnonymous: false,
    minTrustLevel: 0,
    sortOrder: 5,
  },
  {
    slug: "treehole",
    name: "匿名树洞",
    description: "情绪倾诉与心事交流，开启每帖独立 HMAC 隔离匿名代号",
    accentColor: "#475569",
    allowAnonymous: true,
    minTrustLevel: 0,
    sortOrder: 6,
  },
  {
    slug: "notice",
    name: "站务与公约",
    description: "非官方站点更新日志、功能开放公告与社区规则修订说明",
    accentColor: "#DC2626",
    allowAnonymous: false,
    minTrustLevel: 2,
    sortOrder: 7,
  },
] as const;

export interface ReportReasonOption {
  code: string;
  label: string;
  description: string;
}

export const REPORT_REASONS: readonly ReportReasonOption[] = [
  {
    code: "privacy_leak",
    label: "泄露师生隐私 / 人肉信息",
    description: "包含真实姓名、学号、班级座次、电话、微信/QQ、家庭住址等隐私信息",
  },
  {
    code: "bullying",
    label: "人身攻击 / 校园欺凌",
    description: "针对特定个人或群体的侮辱、谩骂、恶意贬低或排挤行为",
  },
  {
    code: "misinformation",
    label: "造谣诽谤 / 不实信息",
    description: "捏造事实、冒充校方通知或恶意误导同学",
  },
  {
    code: "spam_ads",
    label: "商业广告 / 刷屏灌水",
    description: "校外培训引流、兼职推广、无意义重复刷屏",
  },
  {
    code: "illegal_content",
    label: "违法违规或低俗内容",
    description: "色情低俗、暴力血腥或违反法律法规的内容",
  },
  {
    code: "other",
    label: "其他违反社区公约行为",
    description: "请在补充说明中写明具体违规位置与原因",
  },
] as const;

export function getCategoryBySlug(slug: string): CategoryDefinition | undefined {
  return DEFAULT_CATEGORIES.find((cat) => cat.slug === slug);
}
