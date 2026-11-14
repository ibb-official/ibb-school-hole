# CLAUDE.md — 交接说明（供协作者与 AI 接手用）

> 本文件是本项目**当前状态与工作约定的唯一入口**。任何接手的人或 AI，先读完这一份再动手。
> 最后更新：2026-11-14（Asia/Shanghai）

---

## 一、这是什么

北京市第一六六中学**非官方**校园论坛 / 树洞网站项目（规划域名 `hole.bj166zx.cn`）。技术栈沿用 `bj166-school-site` 与 `ibb-school-map` 方案：Next.js (App Router) + TypeScript + Docker (Standalone) + Caddy。

| 项 | 值 |
| --- | --- |
| 线上（规划） | https://hole.bj166zx.cn |
| 仓库 | https://github.com/ibb-official/ibb-school-hole |
| 参考项目 | https://github.com/ibb-official/bj166-school-site 、https://github.com/ibb-official/ibb-school-map |
| 本地工作区 | `~/dev/ibb/校园论坛`（`_anchor` 空树主目录）；开发一律走 `wt new 校园论坛 <slug>` |
| 生产机（规划） | `sofia-vps`（108.165.233.143，hostname `r-server89187-mls`），Docker + `edge-caddy` |
| 部署隔离边界 | 独立目录 `/opt/ibb-school-hole/`、独立本机端口 `127.0.0.1:<HOLE_PORT>`（禁止复用 `3000` 与 `3010`/`<MAP_PORT>`）、独立子网（如 `172.20.3.0/24`） |

**定位红线**：本站是非官方校园论坛 / 树洞协作项目，不代表学校授权发布。页面必须常驻“非正式 / 非官方”标识与免责声明，并明确发帖仅代表发布者个人观点。

---

## 二、当前状态（2026-11-14）

| 维度 | 状态 |
| --- | --- |
| GitHub 仓库 | 已创建 `ibb-official/ibb-school-hole`（Public） |
| 协作者与评审 | 已配置 `.github/CODEOWNERS`（`@huihiya @guaiqi1964-dev @IGNGserver @hxsx1016 @ljy111222`） |
| CI/CD 流水线 | 已配置 `.github/workflows/ci.yml` 与 `.github/workflows/deploy.yml`（带 `paths` 过滤，应用代码落地后自动激活） |
| 规范文档 | 已完成 `AGENTS.md`、`CLAUDE.md`、`README.md` |
| 应用脚手架 | **待初始化**（尚未写入 `package.json`、`src/`、`Dockerfile`、`docker-compose.yml`） |
| 生产环境配置 | **待分配**：`<HOLE_PORT>`、`/opt/ibb-school-hole/`、Cloudflare DNS（`hole.bj166zx.cn` 灰云指向 `108.165.233.143`）、`edge-caddy` 站点块、`deploy-hole` 受控命令及仓库 SSH Deploy Secrets |

---

## 三、规划代码结构

后续初始化 Next.js 应用时，参考 `bj166-school-site` 与 `ibb-school-map` 保持结构清晰：

```
├── .github/
│   ├── CODEOWNERS               PR 自动请求全体协作者评审
│   └── workflows/
│       ├── ci.yml               PR 阶段自动运行 lint 与 build
│       └── deploy.yml           main 分支构建 GHCR 镜像并部署至 sofia-vps
├── src/
│   ├── app/
│   │   ├── layout.tsx           全局布局、元数据与非官方免责页眉/页脚
│   │   ├── page.tsx             论坛 / 树洞首页（分区筛选 / 帖子列表 / 检索）
│   │   ├── globals.css          全局样式（兼顾移动端阅读与触控交互）
│   │   ├── post/[id]/           帖子详情与互动页
│   │   ├── submit/              投稿 / 发帖入口（含风控与社区公约确认）
│   │   ├── rules/               社区公约、免责声明与隐私保护边界
│   │   └── ...                  关于本站 / 404 等页面
│   ├── components/              导航栏、页脚、帖子卡片、发帖/举报表单、筛选栏等
│   ├── lib/                     内容审核/脱敏校验、限流、存储适配器等通用模块
│   └── data/                    板块分类、社区公约、示例/静态内容等结构化数据
├── public/                      校徽/站点标识、轻量图标（WebP/SVG）
├── Dockerfile                   Next.js Standalone 多阶段镜像构建定义
├── docker-compose.yml           sofia-vps 生产容器编排（独立端口、网络与可选 data 卷）
├── next.config.mjs              Next.js 运行时配置（output: 'standalone'）
├── tsconfig.json
└── AGENTS.md                    服务器边界、风控红线与团队协作规范
```

---

## 四、内容、安全与数据规则（硬性，不可违反）

1. **非官方免责声明常驻**：页面顶部与底部必须明确提示“非学校官方网站 / 学生协作项目 / 内容仅代表发帖者个人观点”。
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
   - 建立基础页面、非官方免责声明、社区公约与核心帖子/风控数据 schema。
3. **落地上线前安全与审核清单**：
   - 完成 XSS 消毒、发帖限流、敏感词/隐私模式拦截、举报与下架通道及容器非 root/数据卷权限验证。
