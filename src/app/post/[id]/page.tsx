import Link from "next/link";
import { ArrowLeft, Eye, Flag, Lock, MessageSquare } from "lucide-react";
import { CommentReplyForm } from "@/components/CommentReplyForm";
import { getCategoryBySlug } from "@/data/categories";
import { getPublicSystemStatus } from "@/lib/config";
import { getDb } from "@/lib/db";
import { getPostDetail } from "@/lib/forum-service";

export const dynamic = "force-dynamic";

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);
  const status = getPublicSystemStatus();
  const detail =
    Number.isInteger(postId) && postId > 0
      ? getPostDetail(getDb(), postId, { incrementView: true })
      : null;

  if (!detail) {
    return (
      <div className="detail-container">
        <div className="surface-card empty-state-card">
          <h1 className="empty-title">帖子不存在或论坛暂未开放发帖</h1>
          <p className="empty-desc">
            当前阶段数据库保持空白（0 篇公开主题帖），未找到编号为{" "}
            <code className="mono">#{id}</code> 的主题帖。待后续接入人机验证与 AI 审核并开放使用后，帖子正文与楼层回复将在此呈现。
          </p>
          <div className="empty-actions">
            <Link href="/" className="btn btn-primary">
              <ArrowLeft size={15} />
              返回论坛首页
            </Link>
            <Link href="/submit" className="btn btn-secondary">
              预览发帖页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { post, comments } = detail;
  const category = getCategoryBySlug(post.categorySlug);
  const allowAnonymous = Boolean(category?.allowAnonymous);

  return (
    <div className="detail-container">
      <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "var(--text-muted)" }}>
        <Link href="/" className="compliance-link" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <ArrowLeft size={14} />
          返回讨论区
        </Link>
        <span>/</span>
        <Link href={`/?category=${post.categorySlug}`}>{post.categoryName}</Link>
        <span>/</span>
        <span className="mono">#{post.id}</span>
      </div>

      <article className="surface-card post-detail-card">
        <div className="post-card-meta">
          <span className="soft-badge">
            <span
              className="cat-dot"
              style={{ backgroundColor: post.categoryAccent }}
              aria-hidden="true"
            />
            {post.categoryName}
          </span>
          {post.isAnonymous && (
            <span className="soft-badge anon-badge">
              <Lock size={11} />
              匿名隔离
            </span>
          )}
          <span>{post.authorDisplayName}</span>
          <span>·</span>
          <span className="tabular-nums">{formatTime(post.createdAt)}</span>
        </div>

        <h1 className="post-detail-title">{post.title}</h1>
        <div className="post-plain-body">{post.content}</div>

        <div
          className="panel-divider"
          style={{ marginTop: "22px", marginBottom: "14px" }}
        />

        <div className="post-card-footer">
          <div className="post-card-stats tabular-nums">
            <span className="stat-item">
              <Eye size={14} />
              {post.viewCount} 浏览
            </span>
            <span className="stat-item">
              <MessageSquare size={14} />
              {post.commentCount} 回复
            </span>
          </div>

          <button
            type="button"
            disabled={!status.postingEnabled}
            className={`btn btn-secondary ${!status.postingEnabled ? "btn-locked" : ""}`}
            title={
              status.postingEnabled
                ? "举报违规内容"
                : "一期锁定态暂未开放举报提交"
            }
          >
            <Flag size={13} />
            举报内容
          </button>
        </div>
      </article>

      <section className="surface-card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-hairline)", fontWeight: 700, fontSize: "15px" }}>
          全部楼层（<span className="tabular-nums">{comments.length}</span>）
        </div>
        {comments.length === 0 ? (
          <div style={{ padding: "24px 20px", fontSize: "13.5px", color: "var(--text-muted)" }}>
            暂无楼层评论。
          </div>
        ) : (
          <div>
            {comments.map((comment) => (
              <div key={comment.id} className="comment-item">
                <div className="post-card-meta" style={{ marginBottom: "6px" }}>
                  <span className="mono soft-badge">#{comment.floorNo}F</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {comment.authorDisplayName}
                  </span>
                  {comment.isPostAuthor && (
                    <span className="soft-badge">楼主</span>
                  )}
                  <span className="tabular-nums">{formatTime(comment.createdAt)}</span>
                </div>
                <div className="post-plain-body" style={{ fontSize: "14.5px" }}>
                  {comment.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <CommentReplyForm
        postId={post.id}
        allowAnonymous={allowAnonymous}
        postingEnabled={status.postingEnabled}
      />
    </div>
  );
}
