"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OwnSubmission } from "@/lib/moderation-service";

const STATUS_LABELS: Record<string, string> = {
  published: "已发布",
  pending_review: "等待审核",
  rejected: "未通过审核",
  hidden: "已隐藏",
};

export default function SubmissionsPage() {
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<OwnSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/auth/submissions?offset=${offset}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.message || "无法获取投稿记录。");
        setItems(payload.items as OwnSubmission[]);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "无法获取投稿记录。");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offset]);

  return (
    <div className="detail-container">
      <div className="surface-card panel-card">
        <h1 className="form-title">我的投稿</h1>
        <p className="form-subtitle">查看本人帖子与评论的发布和审核状态。</p>
        {error && <p role="alert">{error} <Link href="/login" className="compliance-link">前往登录</Link></p>}
        {loading && <p role="status">正在加载投稿记录…</p>}
        {!loading && !error && items.length === 0 && <p>暂无投稿记录。</p>}
        {!loading && items.map((item) => (
          <article key={`${item.targetType}:${item.id}`} style={{ padding: "16px 0", borderTop: "1px solid var(--border-hairline)" }}>
            <div className="post-card-meta">
              <span className="soft-badge">{item.targetType === "post" ? "帖子" : "评论"}</span>
              <span className="soft-badge">{STATUS_LABELS[item.moderationStatus] ?? item.moderationStatus}</span>
            </div>
            <h2 className="panel-title">{item.postId ? <Link className="compliance-link" href={`/post/${item.postId}`}>{item.title}</Link> : item.title}</h2>
            <p className="post-plain-body">{item.content}</p>
            {item.moderationReason && item.moderationStatus !== "published" && <p className="field-hint">处理说明：{item.moderationReason}</p>}
          </article>
        ))}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button type="button" className="btn btn-secondary" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - 20))}>上一页</button>
          <button type="button" className="btn btn-secondary" disabled={items.length < 20 || loading} onClick={() => setOffset(offset + 20)}>下一页</button>
        </div>
      </div>
    </div>
  );
}
