import Link from "next/link";
import type { PublicSystemStatus } from "@/lib/config";

export function SystemStatusCard({
  status,
  stats,
}: {
  status: PublicSystemStatus;
  stats: { userCount: number; postCount: number; commentCount: number };
}) {
  const allOpen = status.authEnabled && status.postingEnabled;

  return (
    <aside className="sidebar-right">
      <div className="surface-card panel-card">
        <div className="panel-header">
          <h2 className="panel-title">运行与风控状态</h2>
          <span className={`phase-pill ${allOpen ? "phase-pill-ready" : ""}`}>
            {status.phaseBadge}
          </span>
        </div>

        <div className="status-list">
          <div className="status-row">
            <span className="status-label">SQLite WAL 数据库</span>
            <span className="status-tag status-tag-ready">已就绪</span>
          </div>
          <div className="status-row">
            <span className="status-label">防爆破 & 限流器</span>
            <span className="status-tag status-tag-ready">已启用</span>
          </div>
          <div className="status-row">
            <span className="status-label">L1 隐私与词库拦截</span>
            <span className="status-tag status-tag-ready">已启用</span>
          </div>
          <div className="status-row">
            <span className="status-label">人机验证 (Captcha)</span>
            <span
              className={`status-tag ${
                status.captchaReady ? "status-tag-ready" : "status-tag-pending"
              }`}
            >
              {status.captchaReady ? status.captchaProvider : "接入中"}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">L2 AI 内容审核</span>
            <span
              className={`status-tag ${
                status.aiModerationReady
                  ? "status-tag-ready"
                  : "status-tag-pending"
              }`}
            >
              {status.aiModerationReady ? "已接入" : "接入中"}
            </span>
          </div>
        </div>

        <div className="panel-divider" />

        <div className="stats-mini-grid tabular-nums">
          <div className="stat-mini-box">
            <span className="stat-mini-value">{stats.userCount}</span>
            <span className="stat-mini-label">注册用户</span>
          </div>
          <div className="stat-mini-box">
            <span className="stat-mini-value">{stats.postCount}</span>
            <span className="stat-mini-label">公开帖子</span>
          </div>
          <div className="stat-mini-box">
            <span className="stat-mini-value">{stats.commentCount}</span>
            <span className="stat-mini-label">评论楼层</span>
          </div>
        </div>
      </div>

      <div className="surface-card panel-card">
        <div className="panel-header">
          <h2 className="panel-title">社区发帖红线</h2>
        </div>
        <ul className="redline-list">
          <li>禁止发布师生真实姓名、学号、班级座次及联系方式。</li>
          <li>禁止校园欺凌、人身攻击、造谣诽谤及商业引流广告。</li>
          <li>匿名树洞采用每帖独立 HMAC 隔离，接口不返回真实身份。</li>
          <li>仅支持纯文本分段发帖，一期暂不开放图片上传。</li>
        </ul>
        <div className="panel-divider" />
        <Link href="/rules" className="compliance-link" style={{ fontSize: "13px" }}>
          查看完整《社区公约》 →
        </Link>
      </div>
    </aside>
  );
}
