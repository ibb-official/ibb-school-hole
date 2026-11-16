"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export interface ReplyTarget {
  id: number;
  floorNo: number;
  authorDisplayName: string;
}

export function CommentReplyForm({
  postId,
  allowAnonymous,
  postingEnabled,
  replyTarget,
  onClearReply,
}: {
  postId: number;
  allowAnonymous: boolean;
  postingEnabled: boolean;
  replyTarget: ReplyTarget | null;
  onClearReply: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(allowAnonymous);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!postingEnabled || submitting) return;

    setErrorMsg(null);
    setLoginRequired(false);
    setFeedback(null);
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
          replyToCommentId: replyTarget?.id ?? null,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        moderationAction?: string;
        comment?: { moderationStatus?: string };
      };
      if (!response.ok || !payload.ok) {
        setLoginRequired(response.status === 401);
        setErrorMsg(payload.message ?? "回复发送失败。");
        return;
      }
      setContent("");
      onClearReply();
      if (payload.moderationAction === "pending_review" || payload.comment?.moderationStatus === "pending_review") {
        setFeedback("回复已提交，审核通过后将显示在帖子中。");
      } else {
        setFeedback("回复已发布。");
        router.refresh();
      }
    } catch {
      setErrorMsg("网络请求失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="reply-form" className="surface-card panel-card reply-form-card" style={{ padding: "20px 24px" }}>
      <h2 className="panel-title" style={{ marginBottom: "10px", fontSize: "15.5px" }}>
        发表楼层回复
      </h2>

      {!postingEnabled && (
        <div className="lock-notice-box" style={{ marginBottom: "14px" }}>
          <Lock size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>回复功能暂未开放</strong>
            目前无法提交新回复，仍可举报已有内容。
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-stack" noValidate>
        {replyTarget && (
          <div className="reply-target">
            <span>回复 #{replyTarget.floorNo}F · {replyTarget.authorDisplayName}</span>
            <button type="button" className="reply-cancel" onClick={onClearReply}>取消回复</button>
          </div>
        )}
        <label htmlFor="comment-content" className="field-label">回复内容</label>
        <textarea
          id="comment-content"
          className="text-area"
          style={{ minHeight: "110px" }}
          maxLength={2000}
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
            <span>以本帖独立匿名代号回复</span>
          </label>
        )}

        {errorMsg && (
          <div className="field-hint field-hint-error" role="alert">
            {errorMsg} {loginRequired && <Link href="/login" className="compliance-link">前往登录</Link>}
          </div>
        )}
        {feedback && (
          <div className="form-feedback" role="status">
            {feedback} {feedback.includes("审核") && <Link href="/account/submissions" className="compliance-link">查看我的投稿</Link>}
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
