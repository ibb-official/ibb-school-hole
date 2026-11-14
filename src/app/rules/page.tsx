import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "社区公约与免责声明",
};

export default function RulesPage() {
  return (
    <div className="docs-layout">
      <aside className="surface-card docs-toc" aria-label="文档目录">
        <div className="sidebar-section-title" style={{ paddingLeft: 0 }}>
          公约目录
        </div>
        <nav className="docs-toc-list">
          <a href="#unofficial">一、非官方定位与免责声明</a>
          <a href="#privacy">二、师生隐私保护红线</a>
          <a href="#content">三、内容安全与禁止行为</a>
          <a href="#treehole">四、匿名树洞规则边界</a>
          <a href="#moderation">五、审核、举报与下架流程</a>
        </nav>
      </aside>

      <article className="surface-card docs-article">
        <h1>社区公约、隐私保护红线与非官方免责声明</h1>
        <p>
          欢迎查阅「校园论坛（ibb-school-hole）」社区规则。任何访问、注册与发帖行为均须严格遵守以下约定。
        </p>

        <h2 id="unofficial">一、非官方定位与免责声明</h2>
        <ul>
          <li>
            本站为<strong>学生自发协作维护的非官方校园交流与匿名树洞站点</strong>，不隶属于北京市第一六六中学，亦不代表任何校方机构或教育行政部门。
          </li>
          <li>
            站内所有帖子、匿名树洞投稿及楼层评论均仅代表发布者个人观点；请勿将本站任何内容视作学校正式通知、招生或学务公告依据。
          </li>
        </ul>

        <h2 id="privacy">二、师生隐私保护红线（绝对禁止）</h2>
        <ul>
          <li>
            <strong>禁止人肉与身份曝光</strong>：严禁公开或暗示曝光在校师生及工作人员的真实姓名（历史公开人物除外）、学号/工号、具体班级与座次、家庭住址等可识别个人身份的信息。
          </li>
          <li>
            <strong>禁止联系方式曝光或引流</strong>：严禁在注册用户名、帖子正文、评论区中发布任何个人手机号码、身份证号、微信号、QQ 号、电子邮箱或外部私聊引流信息。
          </li>
          <li>
            <strong>纯文本发帖与禁传人像</strong>：站内采用纯文本分段排版，一期不开放图片上传，杜绝包含学生正面肖像或敏感证件的照片流入公网。
          </li>
        </ul>

        <h2 id="content">三、内容安全与禁止行为</h2>
        <ul>
          <li>严禁校园欺凌、人身攻击、恶意造谣诽谤、地域/群体歧视及煽动对立言论。</li>
          <li>严禁代考代写、兼职刷单、培训商业引流、色情低俗、暴力血腥及一切违反中华人民共和国法律法规的内容。</li>
          <li>严禁利用脚本批量注册账号、恶意撞库爆破、刷屏屠版或尝试绕过安全限制。</li>
        </ul>

        <h2 id="treehole">四、匿名树洞规则边界</h2>
        <ul>
          <li>
            「匿名树洞」板块仅面向情绪倾诉、学习烦恼与校园生活分享，并非法外之地。
          </li>
          <li>
            在面向全网的公开页面与 JSON 接口中，匿名帖与匿名回复不会暴露作者用户名与真实用户 ID，而是通过{" "}
            <code className="mono">HMAC-SHA256(post_id + user_id)</code>{" "}
            生成仅限本帖内有效、跨帖互不关联的匿名代号（如 <code className="mono">洞主</code>、
            <code className="mono">匿名同学 #7B2A</code>）。
          </li>
          <li>
            当内容触发严重违规或违法举报时，站务后台可依据内部记录配合处置账号与清理内容。
          </li>
        </ul>

        <h2 id="moderation">五、审核、举报与下架流程</h2>
        <p>
          所有发帖与评论均须依次经过 <strong>L1 本地隐私与敏感词即时拦截</strong> 与{" "}
          <strong>L2 AI 内容语义审核</strong>（接入中）。内容上线后若被举报核实违规，将被立即隐藏或下架处理。
        </p>

        <div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/" className="btn btn-primary">
            返回论坛首页
          </Link>
          <Link href="/about" className="btn btn-secondary">
            查看技术与防爆破说明
          </Link>
        </div>
      </article>
    </div>
  );
}
