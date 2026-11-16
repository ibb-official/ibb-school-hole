"use client";

import { useState } from "react";
import { CommentReplyForm, type ReplyTarget } from "@/components/CommentReplyForm";
import { ReportButton } from "@/components/ReportButton";
import type { PublicCommentDto } from "@/lib/anonymous";
import { formatForumTime } from "@/lib/time";

export function CommentThread({
  postId,
  comments,
  allowAnonymous,
  postingEnabled,
}: {
  postId: number;
  comments: PublicCommentDto[];
  allowAnonymous: boolean;
  postingEnabled: boolean;
}) {
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const visibleComments = new Map(comments.map((comment) => [comment.id, comment]));

  function startReply(comment: PublicCommentDto) {
    setReplyTarget({
      id: comment.id,
      floorNo: comment.floorNo,
      authorDisplayName: comment.authorDisplayName,
    });
    document.getElementById("reply-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("comment-content")?.focus({ preventScroll: true });
  }

  return (
    <>
      <section className="surface-card" aria-label="帖子回复">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-hairline)", fontWeight: 700, fontSize: "15px" }}>
          全部楼层（<span className="tabular-nums">{comments.length}</span>）
        </div>
        {comments.length === 0 ? (
          <div style={{ padding: "24px 20px", fontSize: "13.5px", color: "var(--text-muted)" }}>
            暂无楼层评论。
          </div>
        ) : (
          <div>
            {comments.map((comment) => {
              const replyTo = comment.replyToCommentId ? visibleComments.get(comment.replyToCommentId) : null;
              return (
                <article key={comment.id} id={`comment-${comment.id}`} className="comment-item">
                  <div className="post-card-meta" style={{ marginBottom: "6px" }}>
                    <span className="mono soft-badge">#{comment.floorNo}F</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {comment.authorDisplayName}
                    </span>
                    {comment.isPostAuthor && <span className="soft-badge">楼主</span>}
                    <span className="tabular-nums">{formatForumTime(comment.createdAt)}</span>
                  </div>
                  {replyTo && (
                    <p className="comment-reply-reference">
                      回复 <a className="compliance-link" href={`#comment-${replyTo.id}`}>
                        #{replyTo.floorNo}F · {replyTo.authorDisplayName}
                      </a>
                    </p>
                  )}
                  <div className="post-plain-body" style={{ fontSize: "14.5px" }}>
                    {comment.content}
                  </div>
                  <div className="comment-actions">
                    {postingEnabled && (
                      <button type="button" className="btn btn-secondary" onClick={() => startReply(comment)}>
                        回复
                      </button>
                    )}
                    <ReportButton targetType="comment" targetId={comment.id} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <CommentReplyForm
        postId={postId}
        allowAnonymous={allowAnonymous}
        postingEnabled={postingEnabled}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
      />
    </>
  );
}
