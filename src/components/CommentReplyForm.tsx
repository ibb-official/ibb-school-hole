"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export function CommentReplyForm({
  postId,
  allowAnonymous,
  postingEnabled,
}: {
  postId: number;
  allowAnonymous: boolean;
  postingEnabled: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(allowAnonymous);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!postingEnabled || submitting) return;

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "ibb-hole-web",
        },
        body: JSON.stringify({
          content,
          isAnonymous: allowAnonymous ? isAnonymous : false,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        setErrorMsg(payload.message ?? "回复发送失败。");
        return;
      }
      setContent("");
      router.refresh();
    } catch {
      setErrorMsg("网络请求失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="surface-card panel-card" style={{ padding: "20px 24px" }}>
      <h2 className="panel-title" style={{ marginBottom: "10px", fontSize: "15.5px" }}>
        发表楼层回复
      </h2>

      {!postingEnabled && (
        <div className="lock-notice-box" style={{ marginBottom: "14px" }}>
          <Lock size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>回复功能暂未开放（一期锁定态）</strong>
            人机验证与 AI 审核接入前，回复与举报提交均处于锁定状态。
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        <textarea
          className="text-area"
          style={{ minHeight: "110px" }}
          placeholder="请输入纯文本评论（2 至 2000 字，严禁泄露隐私与人身攻击）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {allowAnonymous && (
          <label className="checkbox-row" style={{ alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              style={{ marginTop: 0 }}
            />
            <span>以本帖独立匿名代号（匿名同学 / 洞主）回复</span>
          </label>
        )}

        {errorMsg && (
          <div className="field-hint field-hint-error" role="alert">
            {errorMsg}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={!postingEnabled || submitting}
            aria-disabled={!postingEnabled || submitting}
            className={`btn btn-primary ${!postingEnabled ? "btn-locked" : ""}`}
          >
            {!postingEnabled && <Lock size={14} />}
            {postingEnabled
              ? submitting
                ? "正在发送..."
                : "发送回复"
              : "发送回复（暂未开放）"}
          </button>
        </div>
      </form>
    </div>
  );
}
