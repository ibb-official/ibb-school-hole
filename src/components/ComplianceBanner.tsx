import Link from "next/link";

export function ComplianceBanner({ phaseBadge }: { phaseBadge: string }) {
  return (
    <div className="compliance-strip" role="region" aria-label="非官方声明">
      <div className="container compliance-strip-inner">
        <div className="compliance-strip-left">
          <span className="status-dot" aria-hidden="true" />
          <span>
            <strong>非官方学生协作项目</strong> · 不代表北京市第一六六中学授权发布，站内帖子与评论仅代表发布者个人观点
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="mono" style={{ fontSize: "11.5px", opacity: 0.85 }}>
            {phaseBadge}
          </span>
          <Link href="/rules" className="compliance-link">
            社区公约与免责声明 →
          </Link>
        </div>
      </div>
    </div>
  );
}
