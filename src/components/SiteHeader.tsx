import Link from "next/link";
import { PenSquare, Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader({ initialQuery = "" }: { initialQuery?: string }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand-group">
          <Link href="/" className="brand-group" aria-label="校园论坛首页">
            <img
              src="/logo-mark.svg"
              alt="校园论坛标识"
              className="brand-logo"
              width={32}
              height={32}
            />
            <span className="brand-title">
              校园论坛
              <span className="unofficial-badge">非官方</span>
            </span>
          </Link>
        </div>

        <form action="/" method="get" className="header-search" role="search">
          <Search size={15} className="header-search-icon" />
          <input
            type="search"
            name="q"
            defaultValue={initialQuery}
            placeholder="搜索帖子标题或正文内容..."
            className="header-search-input"
            aria-label="搜索论坛帖子"
          />
        </form>

        <nav className="header-nav" aria-label="主导航">
          <Link href="/" className="nav-link">
            讨论区
          </Link>
          <Link href="/?category=treehole" className="nav-link">
            匿名树洞
          </Link>
          <Link href="/rules" className="nav-link">
            社区公约
          </Link>
          <Link href="/about" className="nav-link">
            安全机制
          </Link>
          <a
            href="https://bj166zx.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
          >
            主站
          </a>
          <a
            href="https://map.bj166zx.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
          >
            3D地图
          </a>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <Link href="/login" className="btn btn-secondary">
            登录
          </Link>
          <Link href="/register" className="btn btn-secondary">
            注册
          </Link>
          <Link href="/submit" className="btn btn-primary">
            <PenSquare size={15} />
            发帖
          </Link>
        </div>
      </div>
    </header>
  );
}
