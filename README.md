# 校园论坛 / 树洞（ibb-school-hole）

基于 **Next.js (App Router) + TypeScript** 规划构建的校园论坛与树洞交流站点，面向北京市第一六六中学同学（域名：`https://hole.bj166zx.cn`）。

生产环境沿用 `bj166-school-site` 与 `ibb-school-map` 的单主机架构，规划运行在公网 VPS `sofia-vps`（hostname `r-server89187-mls`，IP `108.165.233.143`），由同机的 `edge-caddy` 承担反向代理与 TLS 终结，配合 Cloudflare DNS 与 GitHub Actions 全自动 CI/CD 发布（镜像独立托管于 GHCR，容器端口、网络与持久化数据目录与 `bj166-web`、`ibb-school-map-web` 完全隔离）。

> **免责声明**：本站由同学协作维护，站内帖子、树洞投稿与评论仅代表发布者个人观点。站点性质、内容归属与维护者责任边界见 `/disclaimer` 页面。

---

## 架构与基础设施拓扑（规划）

```
       [ 公网访客浏览器 ]
               │
               ▼ (HTTPS 443 / 域名: hole.bj166zx.cn)
     [ Cloudflare DNS ] (灰云 DNS-Only，指向 sofia-vps: 108.165.233.143)
               │
               ▼
  [ 核心服务节点: sofia-vps ] ─── 网站运行主机 + 流量入口 (hostname r-server89187-mls)
               │ 运行: Docker edge-caddy (监听 80/443，管理证书，reverse_proxy 127.0.0.1:<HOLE_PORT>)
               │ 运行: Next.js Standalone 生产容器 ibb-school-hole-web (127.0.0.1:<HOLE_PORT>)
               │ 目录: /opt/ibb-school-hole/ (docker-compose.yml 及按需挂载的 data/，与其它站点完全隔离)
```

---

## 仓库结构

已完成一期全栈脚手架（Next.js App Router + TypeScript + SQLite WAL + 防爆破与隐私风控底座 + 现代锁定态前端），核心目录如下：

```
├── .github/
│   ├── CODEOWNERS              PR 自动请求全体协作者评审
│   └── workflows/
│       ├── ci.yml              GitHub Actions PR 校验（ESLint + 安全单测 + Next.js Build）
│       └── deploy.yml          GitHub Actions 构建镜像、推送 GHCR 与远程部署流水线
├── public/
│   └── logo-mark.svg           站点轻量矢量标识
├── src/
│   ├── app/                    首页、登录/注册/发帖（一期锁定态）、详情、社区公约、安全说明及 API 路由
│   ├── components/             导航栏、页脚与免责声明入口、状态看板、表单与主题切换组件
│   ├── data/                   7 大论坛板块（含匿名树洞）与举报原因枚举
│   └── lib/                    SQLite WAL 建表、scrypt/会话、防爆破限流、L1/L2 审核与树洞匿名隔离
├── tests/                      安全、防爆破、隐私过滤与匿名隔离集成测试
├── .dockerignore               Docker 构建排除规则（含本地库与运行数据排除）
├── .env.example                环境变量与一期总闸门模板
├── .gitignore                  Git 忽略规则（Node/Next.js/环境变量/本地数据库）
├── Dockerfile                  Next.js Standalone 多阶段硬化镜像定义
├── docker-compose.yml          sofia-vps 生产容器编排（独立端口、网络与 data 卷）
├── next.config.mjs             Next.js 运行时配置（output: 'standalone' + 安全响应头）
├── tsconfig.json
├── AGENTS.md                   服务器职责边界、内容风控红线与团队协作规范（AI/协作者必读）
├── CLAUDE.md                   项目交接说明与当前状态唯一入口
└── README.md                   项目说明与本地开发指引
```

### 开放前配置

- `FEATURE_AUTH_ENABLED` 与 `FEATURE_POSTING_ENABLED` 默认均为 `false`。生产开启账号功能前，须配置 Turnstile 站点密钥和服务端密钥；Altcha 尚未实现，不会被视为可用。
- 生产开启发帖和评论还需配置 AI 审核接口、审核服务名称及内容保存期限，并至少有一个活动的审核员或管理员。审核服务异常时，内容进入人工待审；举报在发帖暂停时仍可提交。
- 先配置注册，让审核员注册，再通过受控运维通道授予角色，最后开放发帖。角色管理及审核流程见 [审核操作说明](docs/moderation.md)，SQLite 备份与恢复见 [备份说明](docs/backup.md)。
- 生产密钥仅存于 `/opt/ibb-school-hole/.env` 和 GitHub Secrets；变量见 `.env.example`。部署工作流使用已核验的 `VM_SSH_FINGERPRINT` 校验生产主机身份。
- 注册目前只支持用户名与密码，不提供邮箱验证、密码找回或登录提醒。

---

## 本地开发（遵循 worktree 协作纪律）

请勿在仓库主目录（`_anchor` 空树分支）直接开发，所有修改均通过独立 worktree 与 Pull Request 完成：

```bash
# 1. 创建任务工作区
wt new 校园论坛 <任务slug>
cd ~/dev/.wt/校园论坛/<任务slug>

# 2. 在本机 $BUILD_SCRATCH_ROOT/校园论坛/<任务slug> 创建源码副本并安装依赖
#    不要在 worktree 内放置 node_modules、.next 或测试数据库。

# 3. 在构建区运行快速检查；完整构建与容器检查由 PR CI 运行
npm ci
npm run lint && npm run typecheck && npm test
```

---

## 团队自动化部署与协作（CI/CD）

本项目配置了完整的 GitHub Actions 流水线与评审机制：

- **PR 评审机制（CODEOWNERS）**：任何 PR 创建后会自动向 `@huihiya`、`@guaiqi1964-dev`、`@IGNGserver`、`@hxsx1016`、`@ljy111222` 发送评审请求，需经过校验与评审后合入 `main`。
- **PR 阶段（`.github/workflows/ci.yml`）**：当应用或配置代码变更时，自动运行 `npm ci`、`npm run lint` 与 `npm run build`。
- **main 分支（`.github/workflows/deploy.yml`）**：应用代码合入 `main` 后，自动执行：
  1. 通过 Docker Buildx 进行多阶段构建；
  2. 推送容器镜像到 GitHub Packages：`ghcr.io/ibb-official/ibb-school-hole:latest`；
  3. 通过受控 SSH Secret 直连部署目标 `sofia-vps`（执行 `deploy-hole`），触发受控部署与健康检查确认上线。
