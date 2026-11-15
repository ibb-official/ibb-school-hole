# 校园论坛（ibb-school-hole）· 项目规范与架构守则

> 本文件是所有参与本仓库的协作者与 AI 智能体必须遵守的系统架构规范与操作纪律。
> 设备级通用 Git 规范见 `~/.qoder/coder-rules/global-rules.md`。

Collaboration: collaborative
Baseline: main
Default branch: main
Release: Docker / GitHub Packages (GHCR) -> sofia-vps 生产自动化部署
Validation: npm run lint && npm run build & Dockerfile 容器化检查
Worktree: `~/项目/.wt/校园论坛/<slug>`

---

## ⚠️ 生产主机职责与边界规范（严禁混淆！）

本项目沿用 `bj166-school-site` 与 `ibb-school-map` 的**单主机部署**模式：应用容器、反向代理与 TLS 终结全部落在同一台公网 VPS 上，不经过内网穿透中转。

### 生产主机 `sofia-vps` (hostname `r-server89187-mls`，公网 IP: 108.165.233.143)
- **唯一角色**：**站点的运行服务器与流量入口**（与 `bj166-school-site`、`ibb-school-map` 共享主机，但容器、端口、目录、网络与持久化数据必须完全隔离）。
- **规划组件（首次上线前由 `IGNGserver` 分配并固定）**：
  - `Docker` & `docker compose`：运行 Next.js Standalone 生产容器 `ibb-school-hole-web`：
    - 仅绑定本机回环地址 `127.0.0.1:<HOLE_PORT>:3000`（**禁止复用已被 `bj166-web` 占用的 `3000` 端口及 `ibb-school-map-web` 占用的 `3010` / `<MAP_PORT>` 端口**）。
    - 使用独立 Docker 网络 `ibb-school-hole_default` 与独立子网（如 `172.20.3.0/24`，禁止复用 `bj166-site_default` / `172.20.1.0/24` 或 `ibb-school-map_default` / `172.20.2.0/24`）。
    - 若论坛采用持久化存储（如 SQLite / 附件目录），仅将 `/opt/ibb-school-hole/data/` 挂载到容器对应数据目录，其余根文件系统保持最小权限加固（`read_only: true` + `cap_drop: ALL` + `no-new-privileges: true` + 资源限额）。
  - `edge-caddy`（Docker Caddy，监听 80/443）：负责 `hole.bj166zx.cn` 的反向代理与证书签发，规则为 `reverse_proxy 127.0.0.1:<HOLE_PORT>`（不得影响 `bj166zx.cn`、`www.bj166zx.cn` 与 `map.bj166zx.cn` 现有规则）。
- **应用部署目录**：`/opt/ibb-school-hole/`（存放独立的 `docker-compose.yml`、生产环境变量 `.env` 及可选的 `data/` 持久化目录；严禁混入 `/opt/bj166-site/` 或 `/opt/ibb-school-map/`）。
- **日常运维（由生产机维护者执行）**：
  - 查看站点运行状态：`docker ps` / `docker logs -f ibb-school-hole-web`
  - 检查本地健康响应：`curl -I http://127.0.0.1:<HOLE_PORT>`
  - 重载反向代理：`docker exec edge-caddy caddy reload --config /etc/caddy/Caddyfile`
- **【严禁操作】**：
  - ❌ **禁止把 `ibb-school-hole-web` 的监听端口绑定到公网（`0.0.0.0`）**，对外只能经 `edge-caddy` 的 443；容器端口映射必须保持 `127.0.0.1:<HOLE_PORT>:3000`。
  - ❌ **禁止占用或覆盖 `bj166-web`（`127.0.0.1:3000`、`/opt/bj166-site/`、`bj166-site_default`）或 `ibb-school-map-web`（`127.0.0.1:3010` / `<MAP_PORT>`、`/opt/ibb-school-map/`、`ibb-school-map_default`）的端口、目录、网络与配置**。
  - ❌ **禁止把本站点的业务代码、构建产物或论坛数据放到其它主机上运行**；`los-vps2`、`debian-web2`（已于 2026-10-30 销毁）与其它 VPS 均不是部署目标。
  - ❌ **禁止改动 `sofia-vps` 上共用的 `new-api` / 账号池、`bj166-site` 或 `ibb-school-map` 相关配置文件**。
  - ❌ **禁止把任何运行时数据库、用户投稿/发帖备份、会话密钥（`.env`）或上传附件提交到本仓库（本仓库为 Public 公开仓库）**。

---

## 网络链路与流量拓扑

```
[ 客户端浏览器 ]
       │
       ▼ (HTTPS 443 / 域名: hole.bj166zx.cn)
[ Cloudflare DNS ] (灰云 DNS-Only，指向 sofia-vps: 108.165.233.143)
       │
       ▼
[ sofia-vps (应用服务器 + 流量入口) ]
       │ 运行: edge-caddy (监听 80/443 / TLS 证书终结)
       │ Caddyfile 规则: hole.bj166zx.cn -> reverse_proxy 127.0.0.1:<HOLE_PORT>
       │ 运行: Next.js Standalone 生产容器 ibb-school-hole-web (127.0.0.1:<HOLE_PORT>)
       │ 持久化挂载 (按需): /opt/ibb-school-hole/data/
```

---

## 团队自动化部署（GitHub Actions）与协作流程

本项目采用 **PR 自动化校验 + CODEOWNERS 评审 + main 分支自动上线** 的协作模式，协作者无需关心服务器 SSH 凭据或手动运维：

1. **开发与 PR 提交流程（强制分支 + worktree）**：
   - 禁止在主目录（`~/项目/ibb/校园论坛`）或 `main` 分支直接修改、提交代码。
   - 使用 `wt new 校园论坛 <slug>` 在 `~/项目/.wt/校园论坛/<slug>` 创建独立分支与工作区开发。
   - 提交 Pull Request 后，`.github/CODEOWNERS` 会自动向全体协作者发出评审请求；`.github/workflows/ci.yml` 自动触发 `npm run lint` 与 `npm run build` 校验（应用代码就绪后生效）。
   - 验证通过并经协作者评审批准后，由维护者合并至 `main`。

2. **生产自动交付（main 分支触发）**：
   - 应用代码合入 `main` 后，自动触发 `.github/workflows/deploy.yml` 执行生产发布：
     1. **GitHub Runner** 构建 Next.js Docker 镜像（多阶段构建，Standalone 运行时）。
     2. 将最新镜像推送到 **GitHub Packages (`ghcr.io/ibb-official/ibb-school-hole:latest`)**。
     3. 通过本仓库预配置的 SSH Secret 直连 `sofia-vps`，执行受控部署命令 `deploy-hole`，在 `/opt/ibb-school-hole/` 拉取最新镜像、重启容器并执行本地健康检查（200 OK 确认上线）。
   - **首次上线前置条件**：需先由 `IGNGserver` 在 `sofia-vps` 分配未占用的 `<HOLE_PORT>`、独立 Docker 子网（如 `172.20.3.0/24`）、`/opt/ibb-school-hole/` 部署目录与 `deploy-hole` 受控命令；在 Cloudflare DNS 为 `hole.bj166zx.cn` 配置灰云 A 记录（`108.165.233.143`）及 `edge-caddy` 站点块；并在 GitHub 仓库 Secrets 中配置 `VM_SSH_HOST`、`VM_SSH_PORT`、`VM_SSH_USER`、`VM_SSH_KEY`。

3. **权限与边界**：
   - 生产机 `sofia-vps` 仅允许 GitHub Actions 受控通道直连部署，不向协作者分发个人 SSH 凭据，不开放 root，不解除部署密钥的最小权限命令限制。
   - 协作者完成功能开发或规则维护的标准出口是 **PR 校验通过并经评审合并**。

---

## 本地开发与代码规范

- **框架**：Next.js (App Router) + TypeScript + 原生 CSS / Tailwind（`output: 'standalone'`）。
- **领域与数据解耦**：论坛主题帖、树洞分区、评论/互动、内容审核与风控规则、站点公约与静态说明等模块分别集中在 `src/data/`、`src/lib/` 与 `src/components/`，存储实现与 UI 组件解耦，便于多人协作与测试。
- **静态资源规范**：站点图标、规范配图统一放入 `public/`；图片优先转为轻量 WebP/SVG，严禁提交超大未压缩原始文件或无关二进制大文件。
- **空间与构建约束**：本机遵循设备级规范第 5c 节，禁止将构建产物、依赖目录（`node_modules`、`.next`）或本地测试数据库留在项目卷；本地校验应在 `$HOME/.build/校园论坛/<slug>` 本机盘构建区运行，重型全仓构建与容器构建以 GitHub Actions CI 为准。
- **内容安全、隐私保护与校园树洞合规红线（高优先级）**：
  - **站点标识与免责声明**：页面**不得**出现“非官方 / 非正式 / 不代表官方”等成段防御性文案；仅在品牌名旁保留极小英文 `unofficial` 标识，页脚保留一个不显眼的《免责声明》文字链接。完整声明统一收敛到 `/disclaimer` 页面，禁止在其它页面重复；发布者观点归属、维护者义务边界与内容监管方式在该页统一说明。
  - **严禁人肉与师生隐私曝光**：严禁收录或允许默认公开展示师生真实姓名（历史公开人物除外）、学号/工号、班级座次、个人电话/微信号/QQ号/邮箱、家庭住址等隐私信息；严禁校园欺凌、人身攻击、造谣诽谤、色情低俗、商业引流广告与违法违规内容；**含学生正面肖像或可识别个人身份的照片一律不用**。
  - **审核与风控基线**：如支持匿名发帖、投稿或评论功能，必须同步实现**内容审核（先审后发或可即时隐藏/下架）、敏感词与隐私模式过滤、举报通道、防刷屏限流（Rate Limit）、XSS/HTML 转义消毒、CSRF 与输入长度校验**；若支持图片上传，必须校验真实文件类型与体积并剥离 EXIF 元数据。
  - **凭据与运行数据保密（Public 仓库特别约束）**：代码中严禁硬编码管理员口令、Session/JWT Secret、第三方 API key 或真实用户数据；相关密钥与生产配置仅通过 `/opt/ibb-school-hole/.env` 在运行时注入，且所有数据库与 `.env` 文件必须保持在 `.gitignore` 与 `.dockerignore` 内。
