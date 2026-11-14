import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-disclaimer">
          <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
            北京市第一六六中学 · 非官方校园论坛（ibb-school-hole）
          </div>
          <p style={{ margin: "0 0 6px" }}>
            免责声明：本站为学生协作维护的<strong>非官方 / 非正式校园交流与匿名树洞项目</strong>，不代表北京市第一六六中学或任何教育行政部门。站内所有主题帖、树洞内容与评论均仅代表发布者个人观点，不得作为校方正式通知或学务依据。
          </p>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12.5px" }}>
            隐私与合规红线：严禁发布师生真实姓名、学号/工号、班级座次、电话/微信/QQ 等个人隐私及任何欺凌、造谣、违法内容。
          </p>
        </div>

        <div className="footer-links">
          <Link href="/rules">社区公约</Link>
          <Link href="/about">安全与防爆破说明</Link>
          <Link href="/login">登录预览</Link>
          <Link href="/register">注册预览</Link>
          <Link href="/submit">发帖预览</Link>
          <a
            href="https://github.com/ibb-official/ibb-school-hole"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub 仓库
          </a>
        </div>
      </div>
    </footer>
  );
}
