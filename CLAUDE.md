# CLAUDE.md — 交接说明（供协作者与 AI 接手用）

> 本文件是本项目**当前状态与工作约定的唯一入口**。任何接手的人或 AI，先读完这一份再动手。
> 最后更新：2026-11-14（Asia/Shanghai）

---

## 一、这是什么

北京市第一六六中学的校园论坛 / 树洞网站项目（同学协作维护，规划域名 `hole.bj166zx.cn`）。技术栈沿用 `bj166-school-site` 与 `ibb-school-map` 方案：Next.js (App Router) + TypeScript + Docker (Standalone) + Caddy。

| 项 | 值 |
| --- | --- |
| 线上（规划） | https://hole.bj166zx.cn |
| 仓库 | https://github.com/ibb-official/ibb-school-hole |
| 参考项目 | https://github.com/ibb-official/bj166-school-site 、https://github.com/ibb-official/ibb-school-map |
| 本地工作区 | `~/dev/ibb/校园论坛`（`_anchor` 空树主目录）；开发一律走 `wt new 校园论坛 <slug>` |
| 生产机（规划） | `sofia-vps`（108.165.233.143，hostname `r-server89187-mls`），Docker + `edge-caddy` |
| 部署隔离边界 | 独立目录 `/opt/ibb-school-hole/`、独立本机端口 `127.0.0.1:<HOLE_PORT>`（禁止复用 `3000` 与 `3010`/`<MAP_PORT>`）、独立子网（如 `172.20.3.0/24`） |

**标识红线**：页面不出现「非官方 / 非正式 / 不代表官方」等成段防御性文案。品牌名旁只保留极小英文 `unofficial`，页脚只留一个不显眼的《免责声明》链接，完整声明统一放在 `/disclaimer`。

---

## 二、当前状态（2026-11-14）

| 维度 | 状态 |
| --- | --- |
| GitHub 仓库 | 已创建 `ibb-official/ibb-school-hole`（Public） |
| 协作者与评审 | 已配置 `.github/CODEOWNERS`（`@huihiya @guaiqi1964-dev @IGNGserver @hxsx1016 @ljy111222`） |
| CI/CD 流水线 | 已配置 `.github/workflows/ci.yml` 与 `.github/workflows/deploy.yml`（带 `paths` 过滤，应用代码落地后自动激活） |
| 规范文档 | 已完成 `AGENTS.md`、`CLAUDE.md`、`README.md` |
| 应用脚手架 | **已完成一期全栈代码与锁定态实现**（Next.js 15 + SQLite WAL + 防爆破限流 + L1 隐私过滤 + `Dockerfile` + `docker-compose.yml`；总闸门默认关闭，0 用户 0 帖子） |
| 二期接入待办 | 接入人机验证（Turnstile / Altcha）与 AI 审核接口后，方可在生产 `.env` 开启 `FEATURE_AUTH_ENABLED` / `FEATURE_POSTING_ENABLED` |
| 生产环境配置 | **待分配**：`<HOLE_PORT>`、`/opt/ibb-school-hole/`、Cloudflare DNS（`hole.bj166zx.cn` 灰云指向 `108.165.233.143`）、`edge-caddy` 站点块、`deploy-hole` 受控命令及仓库 SSH Deploy Secrets |

---

## 三、代码结构

```
├── .github/
│   ├── CODEOWNERS               PR 自动请求全体协作者评审
│   └── workflows/
│       ├── ci.yml               PR 阶段自动运行 lint、安全测试与 build
│       └── deploy.yml           main 分支构建 GHCR 镜像并部署至 sofia-vps
├── src/
│   ├── app/
│   │   ├── layout.tsx           全局布局、主题防闪烁、品牌 unofficial 标识与页脚
│   │   ├── page.tsx             论坛首页（板块筛选 / 检索 / 空白状态 / 运行看板）
│   │   ├── login/               登录页（一期按钮 disabled 锁止）
│   │   ├── register/            注册页（支持用户名+密码、选填邮箱，一期按钮 disabled 锁止）
│   │   ├── submit/              纯文本发帖页（含 L1 本地隐私实时预检，一期按钮 disabled 锁止）
│   │   ├── post/[id]/           帖子详情、楼层评论与锁定态回复框
│   │   ├── rules/               社区公约与隐私保护红线
│   │   ├── disclaimer/          站点性质、内容归属与维护者义务边界的完整声明
│   │   ├── about/               安全架构、防爆破与树洞防开盒说明
│   │   └── api/                 健康检查、状态、认证、帖子、评论、举报 Route Handlers
├── src/
│   ├── components/              导航栏、帖子卡片、空状态、系统状态看板、交互表单
│   ├── data/                    7 个论坛板块（含匿名树洞）与举报原因分类
│   └── lib/                     配置总闸门、SQLite WAL、scrypt/会话、CSRF/限流/反脚本、L1/L2 审核与 HMAC 匿名隔离
├── tests/                       安全、防爆破、隐私过滤与匿名隔离集成测试
├── public/                      logo-mark.svg 轻量矢量标识
├── .env.example                 环境变量模板
├── Dockerfile                   Next.js Standalone 多阶段硬化镜像定义（含 Alpine libstdc++ 支持）
├── docker-compose.yml           sofia-vps 生产容器编排（127.0.0.1 绑定、只读根文件、data 卷、172.20.3.0/24）
├── next.config.mjs              Next.js 运行时配置（output: 'standalone'、serverExternalPackages、安全头）
├── tsconfig.json
└── AGENTS.md                    服务器边界、风控红线与团队协作规范
```

---

## 四、内容、安全与数据规则（硬性，不可违反）

1. **标识与免责声明收敛**：页面不得出现成段防御性文案；品牌名旁仅保留极小 `unofficial`，页脚仅保留《免责声明》链接，完整文本只在 `/disclaimer` 维护。
2. **严禁人肉与师生隐私曝光**：教师与学生真实姓名、学号/工号、班级座次、个人联系方式（电话、邮箱、微信、QQ）、住址及含学生正面肖像或可识别身份的照片一律不得收录或公开发布。
3. **内容安全与反滥用底线**：发帖/投稿与评论功能须具备审核与快速下架机制、敏感词与隐私规则拦截、限流防刷、XSS/CSRF 防护；严禁校园欺凌、人身攻击、造谣诽谤及违法违规内容。
4. **Public 仓库数据零泄漏**：严禁将本地数据库（`*.db`、`*.sqlite*`、`/data/`）、真实用户发言记录、IP 日志、管理员口令或 `.env` 提交到仓库。
5. **生产安全隔离**：不将容器端口暴露到 `0.0.0.0`，不复用 `3000`（`bj166-web`）或 `3010`/`<MAP_PORT>`（`ibb-school-map-web`），不改动 `sofia-vps` 上其它站点的配置。

---

## 五、部署与提交流程

1. **创建任务 worktree**：
   ```bash
   wt new 校园论坛 <任务slug>
   cd ~/dev/.wt/校园论坛/<任务slug>
   ```
2. **本地校验**（应用初始化后，遵循设备级规范第 5c 节，在本机盘 `$HOME/.build/校园论坛/<任务slug>` 执行构建校验）：
   ```bash
   npm run lint && npm run build
   ```
3. **提交与 PR**：
   - 推送任务分支：`git push -u origin agent/<任务slug>`
   - 创建 PR：`gh pr create`（必须写明改动范围、验证命令与真实结果）
   - 等待 `CI (PR Validation)` 通过且经 `CODEOWNERS` 中协作者评审后合并（不直推 `main`）。
4. **生产发布链路**：
   - 代码合入 `main` → GitHub Actions 构建镜像推送至 `ghcr.io/ibb-official/ibb-school-hole:latest` → SSH 至 `sofia-vps`（校验 hostname 为 `r-server89187-mls`）执行 `deploy-hole` → 更新容器并健康检查。
   - **安全边界**：不向协作者分发服务器公钥，不开放 root，不把临时排查命令长期塞进 `deploy.yml`。

---

## 六、待办（按优先级）

1. **确定基础设施与域名接入**（由 `IGNGserver` 完成）：
   - 在 `sofia-vps` 分配未占用的本地端口 `<HOLE_PORT>`（避开 `3000` 与 `3010`/`<MAP_PORT>`）、独立 Docker 子网（如 `172.20.3.0/24`）、`/opt/ibb-school-hole/` 目录及 `deploy-hole` 受控命令；
   - 在 Cloudflare DNS 配置 `hole.bj166zx.cn`（灰云 DNS-Only 指向 `108.165.233.143`），并在 `edge-caddy` 中添加站点块；
   - 在 GitHub 仓库配置 Deploy Secrets（`VM_SSH_HOST`、`VM_SSH_PORT`、`VM_SSH_USER`、`VM_SSH_KEY`）与 GHCR 拉取凭据。
2. **明确论坛形态与初始化 Next.js 应用骨架**（单独走 PR）：
   - 确定首期架构（例如审核制投稿流 / SQLite 持久化论坛 + 管理端或轻量 API），初始化 `package.json`、`tsconfig.json`、`eslint.config.mjs`、`next.config.mjs`、`Dockerfile`、`docker-compose.yml`；
   - 建立基础页面、免责声明页、社区公约与核心帖子/风控数据 schema。
3. **落地上线前安全与审核清单**：
   - 完成 XSS 消毒、发帖限流、敏感词/隐私模式拦截、举报与下架通道及容器非 root/数据卷权限验证。
