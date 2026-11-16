"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PenSquare, Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface HeaderUser {
  username: string;
  role: string;
}

function SearchForm({ query }: { query: string }) {
  return (
    <form action="/" method="get" className="header-search" role="search">
      <Search size={15} className="header-search-icon" />
      <input
        key={query}
        type="search"
        name="q"
        defaultValue={query}
        placeholder="搜索帖子标题或正文内容..."
        className="header-search-input"
        aria-label="搜索论坛帖子"
      />
    </form>
  );
}

function CurrentSearch({ initialQuery }: { initialQuery: string }) {
  const params = useSearchParams();
  return <SearchForm query={params.get("q") ?? initialQuery} />;
}

export function SiteHeader({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<HeaderUser | null | undefined>(undefined);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    async function refreshUser() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const result = (await response.json()) as { ok?: boolean; user?: HeaderUser | null };
        if (active) setUser(response.ok && result.ok ? result.user ?? null : null);
      } catch {
        if (active) setUser(null);
      }
    }
    void refreshUser();
    window.addEventListener("ibb-auth-change", refreshUser);
    return () => {
      active = false;
      window.removeEventListener("ibb-auth-change", refreshUser);
    };
  }, []);

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "X-Requested-With": "ibb-hole-web" },
      });
      if (!response.ok) throw new Error("logout failed");
      setUser(null);
      window.dispatchEvent(new Event("ibb-auth-change"));
      router.push("/");
      router.refresh();
    } catch {
      setLogoutError("退出失败，请重试。");
    } finally {
      setLoggingOut(false);
    }
  }

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
              <span className="unofficial" lang="en" title="unofficial">
                unofficial
              </span>
            </span>
          </Link>
        </div>

        <Suspense fallback={<SearchForm query={initialQuery} />}>
          <CurrentSearch initialQuery={initialQuery} />
        </Suspense>

        <nav className="header-nav" aria-label="主导航">
          <Link href="/" className="nav-link">讨论区</Link>
          <Link href="/?category=treehole" className="nav-link">匿名树洞</Link>
          <Link href="/rules" className="nav-link">社区公约</Link>
          <Link href="/about" className="nav-link">安全机制</Link>
          <a href="https://bj166zx.cn" target="_blank" rel="noopener noreferrer" className="nav-link">主站</a>
          <a href="https://map.bj166zx.cn" target="_blank" rel="noopener noreferrer" className="nav-link">3D地图</a>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          {user === null && (
            <>
              <Link href="/login" className="btn btn-secondary">登录</Link>
              <Link href="/register" className="btn btn-secondary header-register">注册</Link>
            </>
          )}
          {user && (
            <details className="header-account">
              <summary className="btn btn-secondary header-account-summary" title={user.username}>
                {user.username}
              </summary>
              <div className="header-account-menu">
                <Link href="/account/submissions">我的投稿</Link>
                {(user.role === "admin" || user.role === "moderator") && (
                  <Link href="/moderation">内容审核</Link>
                )}
                <button type="button" onClick={logout} disabled={loggingOut}>
                  {loggingOut ? "正在退出…" : "退出登录"}
                </button>
                {logoutError && <span role="alert">{logoutError}</span>}
              </div>
            </details>
          )}
          <Link href="/submit" className="btn btn-primary">
            <PenSquare size={15} />
            发帖
          </Link>
        </div>
      </div>
    </header>
  );
}
