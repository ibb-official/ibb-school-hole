import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "免责声明",
};

export default function DisclaimerPage() {
  return (
    <div className="docs-layout">
      <aside className="surface-card docs-toc" aria-label="声明目录">
        <div className="sidebar-section-title" style={{ paddingLeft: 0 }}>
          声明目录
        </div>
        <nav className="docs-toc-list">
          <a href="#nature">一、站点性质</a>
          <a href="#content-ownership">二、内容与观点归属</a>
          <a href="#duty-boundary">三、维护者的义务边界</a>
          <a href="#moderation">四、内容管理方式与处置</a>
          <a href="#privacy">五、隐私、匿名与个人信息</a>
          <a href="#ip">六、知识产权</a>
          <a href="#third-party">七、第三方链接与服务可用性</a>
          <a href="#minors">八、未成年人使用</a>
          <a href="#changes">九、声明变更与生效</a>
        </nav>
      </aside>

      <article className="surface-card docs-article">
        <h1>免责声明</h1>
        <p className="mono" style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
          生效日期：2026-11-15
        </p>
        <p>
          本页说明「校园论坛」的站点性质、内容归属与维护者责任边界，是本站在此类事项上的完整说明。请在使用前完整阅读。
        </p>

        <h2 id="nature">一、站点性质</h2>
        <ul>
          <li>
            本站为同学自发搭建与维护的校园交流与匿名树洞站点，不是北京市第一六六中学的官方网站，也未获得学校或任何教育行政部门的授权、委托或认可。
          </li>
          <li>
            本站不以学校名义发布通知、公告、招生、学务等信息。站内出现校名、校徽等标识，仅用于说明交流范围与服务对象。
          </li>
          <li>
            本站的域名、服务器与运营费用由维护者自行承担，与学校不存在隶属、财务或管理关系。
          </li>
        </ul>

        <h2 id="content-ownership">二、内容与观点归属</h2>
        <ul>
          <li>
            站内主题帖、评论与匿名树洞投稿均由发布者自行发布，仅代表发布者个人观点。
          </li>
          <li>
            发布者的观点、陈述与立场<strong>不代表本站维护者、管理员或其他用户</strong>。维护者不背书、不认可、不担保其真实性、准确性与完整性。
          </li>
          <li>
            站内可能存在错误、过时、片面或令人不适的内容。读者应自行判断；涉及校务、招生、学籍等事项，请以学校及主管部门的正式渠道为准。
          </li>
        </ul>

        <h2 id="duty-boundary">三、维护者的义务边界</h2>
        <ul>
          <li>
            维护者仅承担法律规定的必要义务：提供发布场所、维持基本运行，并在发现或被告知违法违规内容后，以合理速度采取处置措施。
          </li>
          <li>
            内容监管以技术手段为主，属于抽样式、技术性管理，不构成对全部内容的事先审查，也不保证所有违规内容都会被拦截。
          </li>
          <li>
            用户发布的内容由发布者自行负责。维护者不是内容的作者、编辑、担保人或共同发布者，不对用户言论作出认可或担保，不对因使用或依赖站内内容产生的损失承担责任；法律强制规定由维护者承担的除外。
          </li>
          <li>
            维护者不对服务的绝对连续、无差错或数据永久留存作出承诺。因不可抗力、网络故障、第三方服务中断、设备损坏等导致的服务中断或数据丢失，维护者不承担赔偿责任。
          </li>
        </ul>

        <h2 id="moderation">四、内容管理方式与处置</h2>
        <ul>
          <li>
            内容管理分为三层：L1 本地隐私与敏感词规则即时拦截、L2 AI 语义审核（接入后生效）、举报受理与人工复核。
          </li>
          <li>
            对违规内容，维护者可采取隐藏、删除、限制发言、封禁账号等措施，无需事先通知。
          </li>
          <li>处置仅针对内容与账号，不代表对相关事实、当事人或观点作出认定。</li>
          <li>
            对处置有异议的，可向维护者提出复核请求；维护者会在合理时间内处理，但不保证结果符合预期。
          </li>
        </ul>

        <h2 id="privacy">五、隐私、匿名与个人信息</h2>
        <ul>
          <li>
            本站不主动收集与提供服务无关的个人信息。口令以随机盐 <code className="mono">scrypt</code> 慢哈希存储；访问 IP 经{" "}
            <code className="mono">HMAC</code> 脱敏后仅用于限流与安全审计。
          </li>
          <li>
            严禁在站内发布他人真实姓名、学号/工号、班级座次、联系方式、住址、肖像等可识别个人身份的信息，一经发现按违规处理。
          </li>
          <li>
            匿名树洞通过服务端密钥派生帖内代号，跨帖不可关联。但<strong>匿名不等于绝对不可追溯</strong>：在处理严重违规、响应违法举报或依法配合有权机关时，维护者可依据内部记录定位并处置账号。请勿在匿名内容中主动泄露自身或他人身份信息。
          </li>
        </ul>

        <h2 id="ip">六、知识产权</h2>
        <ul>
          <li>
            用户发布内容的著作权归发布者所有。发布即授予本站非独占、免费、可转授的许可，用于展示、存储、排版及必要的技术处理。
          </li>
          <li>
            转载他人作品应获得授权并注明来源。权利人认为站内内容侵犯其权利的，可提出删除请求，维护者核实后处理。
          </li>
          <li>本站界面、代码等原创部分的使用遵循仓库所示许可。</li>
        </ul>

        <h2 id="third-party">七、第三方链接与服务可用性</h2>
        <ul>
          <li>
            站内指向主站、3D 地图、GitHub 等外部链接，其内容、可用性与隐私做法由相应运营方负责，本站不作担保。
          </li>
          <li>
            本站可能因维护、升级、故障或不可抗力暂停服务。维护者会尽力缩短中断时间，但不承担因中断产生的损失。
          </li>
        </ul>

        <h2 id="minors">八、未成年人使用</h2>
        <ul>
          <li>本站面向中学在校同学，使用者中可能包含未成年人。</li>
          <li>建议在监护人知情的前提下使用；监护人可要求删除涉及其被监护人的不当内容。</li>
          <li>站内禁止发布任何涉及未成年人隐私、肖像或可能造成伤害的内容。</li>
        </ul>

        <h2 id="changes">九、声明变更与生效</h2>
        <ul>
          <li>
            本声明可能随功能与规则调整更新。更新后仅在本页发布并标注日期，不另行个别通知；继续使用本站即视为接受更新后的内容。
          </li>
          <li>不同意本声明的，请停止使用本站。</li>
          <li>本声明自 2026 年 11 月 15 日起生效。</li>
        </ul>

        <div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/" className="btn btn-primary">
            返回论坛首页
          </Link>
          <Link href="/rules" className="btn btn-secondary">
            查看社区公约
          </Link>
        </div>
      </article>
    </div>
  );
}
