import type { Metadata } from "next";
import Link from "next/link";
import { getPublicSystemStatus } from "@/lib/config";

export const metadata: Metadata = {
  title: "安全架构与防爆破设计",
};

export const dynamic = "force-dynamic";

export default function AboutPage() {
  const status = getPublicSystemStatus();

  return (
    <div className="docs-layout">
      <aside className="surface-card docs-toc" aria-label="架构目录">
        <div className="sidebar-section-title" style={{ paddingLeft: 0 }}>
          安全与架构
        </div>
        <nav className="docs-toc-list">
          <a href="#phase1">一、当前阶段：双保险锁定态</a>
          <a href="#auth-defense">二、防爆破与防批量注册</a>
          <a href="#anonymous-design">三、匿名树洞防开盒设计</a>
          <a href="#moderation-slots">四、二期可插拔审核与验证</a>
        </nav>
      </aside>

      <article className="surface-card docs-article">
        <h1>安全架构与一期锁定态技术说明</h1>
        <p>
          本站后端存储、身份认证、反爆破限流、隐私脱敏过滤与接口闸门已全套工程化落地。当前处于「人机验证与 AI 审核接入前」的一期准备阶段。
        </p>

        <h2 id="phase1">一、双保险“总闸门”锁定机制</h2>
        <ul>
          <li>
            <strong>前端明确禁用态</strong>：登录（<code className="mono">/login</code>）、注册（<code className="mono">/register</code>）与发帖（<code className="mono">/submit</code>）页面已完整呈现交互布局，但提交按钮统一设置为{" "}
            <code className="mono">disabled</code>，不可点击触发提交。
          </li>
          <li>
            <strong>后端环境变量硬拦截</strong>：所有写入 API（注册、登录、发帖、回帖、举报）在入口处由{" "}
            <code className="mono">FEATURE_AUTH_ENABLED={String(status.authEnabled)}</code> 与{" "}
            <code className="mono">FEATURE_POSTING_ENABLED={String(status.postingEnabled)}</code>{" "}
            守卫控制。关闭状态下，即使绕过前端直接请求接口，也会直接返回{" "}
            <code className="mono">403 FEATURE_LOCKED</code>，确保数据库保持 0 用户、0 帖子。
          </li>
        </ul>

        <h2 id="auth-defense">二、账号安全、防爆破与防批量注册</h2>
        <ul>
          <li>
            <strong>仅用户名即可注册，推荐绑定邮箱</strong>：无需强制绑定个人手机或真实信息；若选填邮箱，将在底层校验唯一性并用于安全提醒。
          </li>
          <li>
            <strong>密码与有状态会话</strong>：使用随机盐 <code className="mono">scrypt</code> 慢哈希存储口令；登录发放随机高熵 Session Token，服务端仅存其 SHA-256 哈希，支持秒级踢出与吊销。
          </li>
          <li>
            <strong>双维度防爆破与防枚举</strong>：客户端 IP 统一经 <code className="mono">HMAC-SHA256</code> 脱敏后计入 SQLite 事务限流桶；登录同时叠加 IP 限流、账号桶限流与连续错误 5 次后的账号指数退避锁定（1 分钟 → 5 分钟 → 15 分钟 → 30 分钟），并对不存在账号执行等时伪哈希计算，杜绝账号枚举。
          </li>
          <li>
            <strong>防脚本批量注册与新手冷却</strong>：叠加单 IP 小时/天注册配额、表单隐藏蜜罐字段、服务端签名计时校验（拦截 2.5 秒内机器提交）、纯数字学号/官方仿冒用户名拦截，以及新号注册后观察期与首日发帖限额。
          </li>
        </ul>

        <h2 id="anonymous-design">三、匿名树洞防开盒（DTO 级剥离）</h2>
        <ul>
          <li>
            树洞帖子与评论在服务端序列化层直接将 <code className="mono">authorId</code> 与{" "}
            <code className="mono">authorUsername</code> 置为 <code className="mono">null</code>，杜绝前端开发者工具抓包开盒。
          </li>
          <li>
            同帖内回复者通过服务端私有密钥计算的 <code className="mono">HMAC(postId + authorId)</code> 派生匿名编号，同一帖内楼层身份连续可辨，跨帖完全不可关联追踪。
          </li>
        </ul>

        <h2 id="moderation-slots">四、二期可插拔卡槽</h2>
        <ul>
          <li>
            <strong>人机验证适配器（CaptchaProvider）</strong>：已预留 Cloudflare Turnstile 与自托管 Altcha 接口（当前配置：<code className="mono">{status.captchaProvider}</code>）。
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
            查看注册页锁止态
          </Link>
        </div>
      </article>
    </div>
  );
}
