import Link from "next/link";
import { Eye, Lock, MessageSquare, Pin } from "lucide-react";
import type { PublicPostDto } from "@/lib/anonymous";
import { formatForumTime } from "@/lib/time";

export function PostCard({ post }: { post: PublicPostDto }) {
  return (
    <Link href={`/post/${post.id}`} className="surface-card post-card">
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

        {post.isPinned && (
          <span className="soft-badge">
            <Pin size={11} />
            置顶
          </span>
        )}

        <span className="mono" style={{ opacity: 0.75 }}>
          #{post.id}
        </span>
        <span>·</span>
        <span>{post.authorDisplayName}</span>
      </div>

      <h3 className="post-card-title">{post.title}</h3>
      <p className="post-card-excerpt">{post.content}</p>

      <div className="post-card-footer">
        <span className="tabular-nums">{formatForumTime(post.createdAt)}</span>
        <div className="post-card-stats tabular-nums">
          <span className="stat-item">
            <Eye size={14} />
            {post.viewCount}
          </span>
          <span className="stat-item">
            <MessageSquare size={14} />
            {post.commentCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
