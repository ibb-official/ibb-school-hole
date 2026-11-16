"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { Flag } from "lucide-react";
import { REPORT_REASONS } from "@/data/categories";

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "post" | "comment";
  targetId: number;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState(REPORT_REASONS[0].code as string);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setLoginRequired(false);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "ibb-hole-web",
        },
        body: JSON.stringify({ targetType, targetId, reasonCode, details }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setLoginRequired(response.status === 401);
        setError(payload.message ?? "举报提交失败，请稍后重试。");
        return;
      }
      setOpen(false);
      setDetails("");
      setSuccess(true);
    } catch {
      setError("网络请求失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="report-widget">
      <button
        type="button"
        className="btn btn-secondary report-toggle"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => {
          setOpen((value) => !value);
          setSuccess(false);
          setError("");
        }}
      >
        <Flag size={13} /> 举报{targetType === "comment" ? "评论" : "内容"}
      </button>
      {success && <span className="report-success" role="status">举报已提交</span>}
      {open && (
        <form id={`${id}-panel`} className="report-panel form-stack" onSubmit={submitReport}>
          <label htmlFor={`${id}-reason`} className="field-label">举报原因</label>
          <select
            id={`${id}-reason`}
            className="select-input"
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
          >
            {REPORT_REASONS.map((reason) => (
              <option key={reason.code} value={reason.code}>{reason.label}</option>
            ))}
          </select>
          <label htmlFor={`${id}-details`} className="field-label">补充说明（选填）</label>
          <textarea
            id={`${id}-details`}
            className="text-area report-details"
            maxLength={500}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
          {error && (
            <p className="field-hint field-hint-error" role="alert">
              {error} {loginRequired && <Link className="compliance-link" href="/login">前往登录</Link>}
            </p>
          )}
          <div className="report-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "正在提交…" : "提交举报"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>取消</button>
          </div>
        </form>
      )}
    </div>
  );
}
