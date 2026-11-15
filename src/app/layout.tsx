import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "校园论坛 · 北京市第一六六中学交流与树洞",
    template: "%s · 校园论坛",
  },
  description:
    "面向北京市第一六六中学同学的校园交流与匿名树洞站点，分享校园日常、学习讨论与社团活动。",
  robots: {
    index: true,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

const THEME_INIT_SCRIPT = `
(function(){
  try {
    var saved = localStorage.getItem('ibb_hole_theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <div className="page-wrapper">
          <SiteHeader />
          <main className="main-content">
            <div className="container">{children}</div>
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
