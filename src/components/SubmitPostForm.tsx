"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { DEFAULT_CATEGORIES } from "@/data/categories";
import { inspectContentCompliance } from "@/lib/moderation/privacy-filter";

interface SubmitPostFormProps {
  postingEnabled: boolean;
  aiModerationProvider: string;
}

export function SubmitPostForm({
  postingEnabled,
  aiModerationProvider,
}: SubmitPostFormProps) {
  const router = useRouter();
  const [categorySlug, setCategorySlug] = useState("daily");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCategory = useMemo(
    () =>
      DEFAULT_CATEGORIES.find((item) => item.slug === categorySlug) ??
      DEFAULT_CATEGORIES[0],
    [categorySlug]
  );

  const compliancePreview = useMemo(() => {
    const combined = `${title}\n${content}`.trim();
    if (!combined) return null;
    return inspectContentCompliance(combined);
  }, [title, content]);

  function handleCategoryChange(nextSlug: string) {
    setCategorySlug(nextSlug);
    const nextCat = DEFAULT_CATEGORIES.find((item) => item.slug === nextSlug);
    if (nextCat?.allowAnonymous) {
      setIsAnonymous(true);
    } else {
      setIsAnonymous(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!postingEnabled || submitting) {
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "ibb-hole-web",
        },
        body: JSON.stringify({
          categorySlug,
          title,
          content,
          isAnonymous: selectedCategory.allowAnonymous ? isAnonymous : false,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        post?: { id: number };
      };
      if (!response.ok || !payload.ok || !payload.post) {
        setErrorMsg(payload.message ?? "发帖失败，请检查输入内容。");
        return;
      }
      router.push(`/post/${payload.post.id}`);
      router.refresh();
    } catch {
      setErrorMsg("网络请求失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="surface-card form-card">
      <h1 className="form-title">发布纯文本主题帖</h1>
      <p className="form-subtitle">
        支持纯文本分段排版（保留空行与段落），支持本地隐私格式实时预检；一期暂不开放图片上传
      </p>

      {!postingEnabled && (
        <div className="lock-notice-box" role="status">
          <Lock size={17} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>当前暂未开放发帖（一期锁定态）</strong>
            你可以在下方体验板块切换、匿名树洞隔离说明与 L1 本地隐私风险实时预检；因 AI 内容审核尚未接入，发布按钮与发帖 API 均已锁定。
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        <div className="field-group">
          <label htmlFor="post-category" className="field-label">
            所属板块
          </label>
          <select
            id="post-category"
            className="select-input"
            value={categorySlug}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name} — {cat.description}
              </option>
            ))}
          </select>
        </div>

        {selectedCategory.allowAnonymous && (
          <div
            className="surface-card"
            style={{
              padding: "12px 14px",
              backgroundColor: "var(--bg-subtle)",
              boxShadow: "none",
            }}
          >
            <label className="checkbox-row" style={{ alignItems: "center" }}>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                style={{ marginTop: 0 }}
              />
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                启用「匿名树洞」隔离身份发布（显示为 洞主）
              </span>
            </label>
            <p className="field-hint" style={{ margin: "6px 0 0 22px" }}>
              开启后，公开列表、详情页与 API JSON 返回体将彻底剥离作者用户名与用户 ID；同一帖内其他回复者将获得基于{" "}
              <code className="mono">HMAC(post_id + user_id)</code>{" "}
              派生的跨帖不可关联代号（如 <code className="mono">匿名同学 #7B2A</code>）。
            </p>
          </div>
        )}

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="post-title" className="field-label">
              帖子标题
            </label>
            <span className="field-hint tabular-nums">
              {[...title.trim()].length} / 80
            </span>
          </div>
          <input
            id="post-title"
            type="text"
            className="text-input"
            maxLength={80}
            placeholder="简洁概括主题（4 至 80 字，请勿包含师生姓名或学号）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="post-content" className="field-label">
              纯文本正文
            </label>
            <span className="field-hint tabular-nums">
              {[...content.trim()].length} / 8000
            </span>
          </div>
          <textarea
            id="post-content"
            className="text-area"
            maxLength={8000}
            placeholder={
              "请使用纯文本分段写作（回车换行、空行分段）。\n系统将自动过滤控制字符并拒绝任何 HTML 标签注入。\n\n测试隐私预检提示：可尝试输入手机号、微信号或具体班级号查看即时拦截反馈。"
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {compliancePreview ? (
          compliancePreview.passed ? (
            <div className="compliance-preview-box compliance-preview-ok">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                L1 本地隐私与词库预检通过：未检测到手机号、身份证、社交账号或精准班级/学号风险
              </div>
            </div>
          ) : (
            <div className="compliance-preview-box compliance-preview-warn" role="alert">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, marginBottom: "6px" }}>
                <AlertTriangle size={16} />
                L1 本地合规预检触发拦截（{compliancePreview.issues.length} 项）
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px" }}>
                {compliancePreview.issues.map((issue) => (
                  <li key={issue.code}>
                    <strong>{issue.label}：</strong>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <div className="compliance-preview-box">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
              <ShieldCheck size={16} />
              两级内容安全审核流水线：L1 本地隐私规则过滤（已就绪） → L2 AI 语义审核（{aiModerationProvider === "disabled" ? "待接入" : aiModerationProvider}）
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="field-hint field-hint-error" role="alert">
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={!postingEnabled || submitting}
            aria-disabled={!postingEnabled || submitting}
            className={`btn btn-lg btn-primary ${
              !postingEnabled ? "btn-locked" : ""
            }`}
            title={
              postingEnabled
                ? "发布帖子"
                : "AI 审核与人机验证接入前暂未开放发帖"
            }
          >
            {!postingEnabled && <Lock size={15} />}
            {postingEnabled
              ? submitting
                ? "正在审核并发布..."
                : "发布帖子"
              : "发布帖子（暂未开放）"}
          </button>

          <Link href="/rules" className="btn btn-lg btn-secondary">
            阅读社区公约
          </Link>
        </div>
      </form>
    </div>
  );
}
