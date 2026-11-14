import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ComplianceBanner } from "@/components/ComplianceBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getPublicSystemStatus } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "校园论坛（非官方） · 北京市第一六六中学交流与树洞",
    template: "%s · 校园论坛（非官方）",
  },
  description:
    "北京市第一六六中学非官方学生协作校园论坛与匿名树洞（ibb-school-hole）。仅代表发帖者个人观点，不代表校方授权发布。",
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
  const status = getPublicSystemStatus();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <div className="page-wrapper">
          <ComplianceBanner phaseBadge={status.phaseBadge} />
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
