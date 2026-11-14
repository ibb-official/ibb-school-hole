import Link from "next/link";

export default function NotFound() {
  return (
    <div className="detail-container">
      <div className="surface-card empty-state-card">
        <span className="mono soft-badge">404 NOT FOUND</span>
        <h1 className="empty-title">页面不存在或已被移除</h1>
        <p className="empty-desc">
          你访问的页面地址有误，或对应主题帖尚未创建。请返回论坛首页浏览讨论区。
        </p>
        <div className="empty-actions">
          <Link href="/" className="btn btn-primary">
            返回论坛首页
          </Link>
          <Link href="/rules" className="btn btn-secondary">
            社区公约
          </Link>
        </div>
      </div>
    </div>
  );
}
