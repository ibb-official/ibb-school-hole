import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p className="footer-copy">© 2026 同学共建 · 校园论坛</p>
        <nav className="footer-links" aria-label="页脚链接">
          <Link href="/rules">社区公约</Link>
          <Link href="/about">安全机制</Link>
          <Link href="/disclaimer">免责声明</Link>
          <a
            href="https://github.com/ibb-official/ibb-school-hole"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
