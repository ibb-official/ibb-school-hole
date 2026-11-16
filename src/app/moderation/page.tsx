"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ModerationAction, ModerationContent, ModerationReport, ModerationTarget } from "@/lib/moderation-service";
import { REPORT_REASONS } from "@/data/categories";

interface Queue {
  pending: ModerationContent[];
  reviewed: ModerationContent[];
  reports: ModerationReport[];
}
const EMPTY: Queue = { pending: [], reviewed: [], reports: [] };

export default function ModerationPage() {
  const [queue, setQueue] = useState<Queue>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [targetType, setTargetType] = useState<ModerationTarget>("post");
  const [targetId, setTargetId] = useState("");
  const [accountId, setAccountId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/moderation?offset=${offset}`, { cache: "no-store" });
      const data = await response.json();
      setLoginRequired(response.status === 401);
      if (!response.ok || !data.ok) throw new Error(data.message || "无法读取审核队列。");
      setQueue({ pending: data.pending, reviewed: data.reviewed, reports: data.reports });
    } catch (error) {
      setQueue(EMPTY);
      setMessage(error instanceof Error ? error.message : "无法读取审核队列。");
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (suspendTarget !== null) document.getElementById("moderation-suspend-confirm")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [suspendTarget]);

  async function perform(action: ModerationAction, id: number, type?: ModerationTarget) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "ibb-hole-web" },
        body: JSON.stringify({ action, targetId: id, targetType: type, reason }),
      });
      const data = await response.json();
      setLoginRequired(response.status === 401);
      if (!response.ok || !data.ok) throw new Error(data.message || "操作失败。");
      setMessage("处理成功。");
      setReason("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  function contentCard(item: ModerationContent, reviewed = false) {
    return (
      <article key={`${item.targetType}:${item.id}`} style={{ padding: "16px 0", borderTop: "1px solid var(--border-hairline)" }}>
        <div className="post-card-meta">
          <span className="soft-badge">{item.targetType === "post" ? "帖子" : "评论"} #{item.id}</span>
          <span>{item.authorUsername}（账号 #{item.authorId}）</span>
          <span>{item.moderationStatus}</span>
        </div>
        <h3 className="panel-title">{item.title}</h3>
        <p className="post-plain-body">{item.content}</p>
        {item.moderationReason && <p className="field-hint">当前说明：{item.moderationReason}</p>}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {!reviewed && <><button className="btn btn-primary" type="button" disabled={busy} onClick={() => void perform("approve", item.id, item.targetType)}>通过</button>
            <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void perform("reject", item.id, item.targetType)}>拒绝</button></>}
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setSuspendTarget(item.authorId)}>停用作者并隐藏其全部公开内容</button>
          {reviewed && item.moderationStatus === "hidden" && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void perform("restore", item.id, item.targetType)}>恢复公开</button>}
          {reviewed && item.moderationStatus === "rejected" && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void perform("reopen", item.id, item.targetType)}>重新待审</button>}
        </div>
      </article>
    );
  }

  return (
    <div className="detail-container">
      <div className="surface-card panel-card">
        <h1 className="form-title">内容审核</h1>
        <p className="form-subtitle">仅审核员和管理员可以查看此页面的数据。处理操作会记录审计日志。</p>
        <label htmlFor="moderation-reason" className="field-label">处理说明（可选，拒绝或隐藏时会显示给作者）</label>
        <textarea id="moderation-reason" className="text-area" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        {message && <p role="status">{message} {loginRequired && <Link href="/login" className="compliance-link">登录</Link>}</p>}
        {suspendTarget !== null && (
          <div id="moderation-suspend-confirm" className="lock-notice-box" role="alert">
            <div>
              <strong>确认停用账号 #{suspendTarget}？</strong>
              该操作会撤销会话、隐藏公开内容并拒绝待审内容。
              <div className="report-actions" style={{ marginTop: "10px" }}>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => {
                  const id = suspendTarget;
                  setSuspendTarget(null);
                  void perform("suspend_user", id);
                }}>确认停用</button>
                <button type="button" className="btn btn-secondary" onClick={() => setSuspendTarget(null)}>取消</button>
              </div>
            </div>
          </div>
        )}
        {loading && <p role="status">正在加载审核队列…</p>}
        <section>
          <h2 className="panel-title">待审核内容</h2>
          {!loading && queue.pending.length === 0 && <p>没有待审核内容。</p>}
          {queue.pending.map((item) => contentCard(item))}
        </section>
        <section style={{ marginTop: "24px" }}>
          <h2 className="panel-title">待处理举报</h2>
          {!loading && queue.reports.length === 0 && <p>没有待处理举报。</p>}
          {queue.reports.map((report) => (
            <article key={report.id} style={{ padding: "16px 0", borderTop: "1px solid var(--border-hairline)" }}>
              <div className="post-card-meta"><span className="soft-badge">举报 #{report.id}</span><span>{REPORT_REASONS.find((r) => r.code === report.reasonCode)?.label ?? report.reasonCode}</span></div>
              <h3 className="panel-title">{report.title ?? "内容已不存在"}</h3>
              <p className="post-plain-body">{report.content}</p>
              {report.details && <p className="field-hint">举报说明：{report.details}</p>}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {report.targetStatus === "published" && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void perform("hide", report.targetId, report.targetType)}>隐藏内容</button>}
                {report.targetAuthorId && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setSuspendTarget(report.targetAuthorId)}>停用作者并隐藏其全部公开内容</button>}
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void perform("resolve_report", report.id)}>标记已处理</button>
              </div>
            </article>
          ))}
        </section>
        <section style={{ marginTop: "24px" }}>
          <h2 className="panel-title">已隐藏或拒绝的内容</h2>
          {!loading && queue.reviewed.length === 0 && <p>没有相关内容。</p>}
          {queue.reviewed.map((item) => contentCard(item, true))}
        </section>
        <section style={{ marginTop: "24px" }}>
          <h2 className="panel-title">按编号处理内容</h2>
          <p className="field-hint">用于处理尚未收到举报的公开内容，或恢复已隐藏内容。</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <label>类型 <select className="select-input" value={targetType} onChange={(event) => setTargetType(event.target.value as ModerationTarget)}><option value="post">帖子</option><option value="comment">评论</option></select></label>
            <label>编号 <input className="text-input" type="number" min="1" value={targetId} onChange={(event) => setTargetId(event.target.value)} /></label>
            <button className="btn btn-secondary" type="button" disabled={busy || !targetId} onClick={() => void perform("hide", Number(targetId), targetType)}>隐藏</button>
            <button className="btn btn-secondary" type="button" disabled={busy || !targetId} onClick={() => void perform("restore", Number(targetId), targetType)}>恢复</button>
          </div>
        </section>
        <section style={{ marginTop: "24px" }}>
          <h2 className="panel-title">账号处置</h2>
          <p className="field-hint">停用会撤销会话、隐藏公开内容并拒绝待审内容；恢复账号不会自动恢复内容。</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <label>账号编号 <input className="text-input" type="number" min="1" value={accountId} onChange={(event) => setAccountId(event.target.value)} /></label>
            <button className="btn btn-secondary" type="button" disabled={busy || !accountId} onClick={() => setSuspendTarget(Number(accountId))}>停用账号并隐藏内容</button>
            <button className="btn btn-secondary" type="button" disabled={busy || !accountId} onClick={() => void perform("unsuspend_user", Number(accountId))}>恢复账号</button>
          </div>
        </section>
        <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
          <button type="button" className="btn btn-secondary" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - 100))}>上一页</button>
          <button type="button" className="btn btn-secondary" disabled={loading || (queue.pending.length < 100 && queue.reviewed.length < 100 && queue.reports.length < 100)} onClick={() => setOffset(offset + 100)}>下一页</button>
        </div>
      </div>
    </div>
  );
}
