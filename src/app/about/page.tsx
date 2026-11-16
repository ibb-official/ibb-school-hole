import type { Metadata } from "next";
import Link from "next/link";
import { getForumSystemStatus } from "@/lib/forum-status";

export const metadata: Metadata = {
  title: "安全架构与防爆破设计",
};

export const dynamic = "force-dynamic";

export default function AboutPage() {
  const status = getForumSystemStatus();

  return (
    <div className="docs-layout">
      <aside className="surface-card docs-toc" aria-label="架构目录">
        <div className="sidebar-section-title" style={{ paddingLeft: 0 }}>
          安全与架构
        </div>
        <nav className="docs-toc-list">
          <a href="#phase1">一、功能开放状态</a>
          <a href="#auth-defense">二、防爆破与防批量注册</a>
          <a href="#anonymous-design">三、匿名树洞防开盒设计</a>
          <a href="#moderation-slots">四、二期可插拔审核与验证</a>
        </nav>
      </aside>

      <article className="surface-card docs-article">
        <h1>安全架构与功能开放说明</h1>
        <p>
          本站使用账号认证、内容审核和举报处理来维护讨论环境。功能开放状态由服务端配置决定。
        </p>

        <h2 id="phase1">一、功能开放状态</h2>
        <ul>
          <li>
            <strong>当前状态</strong>：账号功能{status.authEnabled ? "已开放" : "暂未开放"}，发帖与评论{status.postingEnabled ? "已开放" : "暂未开放"}。
          </li>
          <li>
            <strong>后端环境变量硬拦截</strong>：注册、登录、发帖和回帖接口在入口处由{" "}
            <code className="mono">FEATURE_AUTH_ENABLED={String(status.authEnabled)}</code> 与{" "}
            <code className="mono">FEATURE_POSTING_ENABLED={String(status.postingEnabled)}</code>{" "}
            守卫控制。功能关闭时，相关接口会返回 <code className="mono">403 FEATURE_LOCKED</code>；已有内容仍可浏览和举报。
          </li>
        </ul>

        <h2 id="auth-defense">二、账号安全、防爆破与防批量注册</h2>
        <ul>
          <li>
            <strong>使用用户名注册</strong>：目前不收集邮箱或手机号，也未提供密码找回功能。
          </li>
          <li>
            <strong>密码与有状态会话</strong>：使用随机盐 <code className="mono">scrypt</code> 慢哈希存储口令；登录发放随机高熵 Session Token，服务端仅存其 SHA-256 哈希，支持秒级踢出与吊销。
          </li>
          <li>
            <strong>防爆破与限流</strong>：客户端 IP 经 <code className="mono">HMAC-SHA256</code> 脱敏后计入限流记录；登录也按账号与请求来源限制尝试频率。
          </li>
          <li>
            <strong>防脚本批量注册与新手冷却</strong>：叠加单 IP 小时/天注册配额、表单隐藏蜜罐字段、服务端签名计时校验（拦截 2.5 秒内机器提交）、纯数字学号/官方仿冒用户名拦截，以及新号注册后观察期与首日发帖限额。
          </li>
        </ul>

        <h2 id="anonymous-design">三、匿名树洞防开盒（DTO 级剥离）</h2>
        <ul>
          <li>
            树洞帖子与评论在服务端序列化层直接将 <code className="mono">authorId</code> 与{" "}
            <code className="mono">authorUsername</code> 置为 <code className="mono">null</code>；具名与匿名回复之间不会公开楼主身份关联。
          </li>
          <li>
            同帖内回复者通过服务端私有密钥派生匿名编号，同一帖内楼层身份连续可辨；请勿在内容中自行泄露身份。
          </li>
        </ul>

        <h2 id="moderation-slots">四、二期可插拔卡槽</h2>
        <ul>
          <li>
            <strong>人机验证</strong>：支持 Cloudflare Turnstile（当前配置：<code className="mono">{status.captchaProvider}</code>）。
          </li>
          <li>
            <strong>两级审核流水线（ModerationPipeline）</strong>：L1 本地隐私与规则过滤已启用，L2 AI 审核适配器接口已就绪（当前配置：<code className="mono">{status.aiModerationProvider}</code>）。
          </li>
        </ul>

        <div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/" className="btn btn-primary">
            返回论坛首页
          </Link>
          <Link href="/register" className="btn btn-secondary">
            查看注册页
          </Link>
        </div>
      </article>
    </div>
  );
}
