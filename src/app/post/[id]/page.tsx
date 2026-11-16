import Link from "next/link";
import { ArrowLeft, Eye, Lock, MessageSquare } from "lucide-react";
import { notFound } from "next/navigation";
import { CommentThread } from "@/components/CommentThread";
import { ReportButton } from "@/components/ReportButton";
import { getCategoryBySlug } from "@/data/categories";
import { getForumSystemStatus } from "@/lib/forum-status";
import { getDb } from "@/lib/db";
import { getPostDetail } from "@/lib/forum-service";
import { formatForumTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);
  const status = getForumSystemStatus();
  const detail =
    Number.isInteger(postId) && postId > 0
      ? getPostDetail(getDb(), postId, { incrementView: true })
      : null;

  if (!detail) notFound();

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
          <span className="tabular-nums">{formatForumTime(post.createdAt)}</span>
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

          <ReportButton targetType="post" targetId={post.id} />
        </div>
      </article>

      <CommentThread
        postId={post.id}
        comments={comments}
        allowAnonymous={allowAnonymous}
        postingEnabled={status.postingEnabled}
      />
    </div>
  );
}
