# 旅人营地 · 本地开发环境

本指南记录旅人营地本站及团队的开发流程，其他使用者可自行参考。本项目不主动提供第三方部署、配置和运维支持；代码仍可依照适用许可证使用，详见 [项目定位与支持范围](README.md#项目定位与支持范围)。

- 仓库：[HePudding/trekker-camp](https://github.com/HePudding/trekker-camp)
- 默认分支：`master`（本站日常开发与交付目标）
- 版本锚点（以仓库文件为准）：`.node-version` → Node **26.13.1**，`package.json#packageManager` → **pnpm@12.17.0**（当前 `2026.11.0` / nasubi）。

依赖中间件：**PostgreSQL**、**Redis**、**FFmpeg**。Meilisearch 可选（搜索功能和相关测试需要时启用）。

## 方式 A：本机 + Docker 只跑数据库

适合已经装好 Node / pnpm / FFmpeg 的机器。

```bash
git clone https://github.com/HePudding/trekker-camp.git
cd trekker-camp
git checkout master

# 使用 .node-version 指定的 Node，并安装匹配 packageManager 的 pnpm
npm install -g pnpm@12.17.0

# 只起 Postgres + Redis（不要用这个 compose 起 Misskey 本体）
cp .config/docker_example.env .config/docker.env   # 按需改密码
docker compose -f compose.local-db.yml up -d

# 应用配置
mkdir -p .config
cp .config/example.yml .config/default.yml
# 编辑 .config/default.yml：url / port / db / redis 指向本机
# compose.local-db 默认映射 5432 与 6379；db 账号以 docker.env 为准

pnpm install --frozen-lockfile
pnpm build
pnpm migrate
pnpm dev
```

浏览器打开 `http://localhost:3000`（或你在 `default.yml` 里写的 `url` / `port`）。

`pnpm dev` 会 watch 后端并透过 Vite HMR 跑前端；生产行为应使用生产构建验证。

团队成员先运行 `pnpm assets:pull` 从 `HePudding/trekker-camp-assets` 私有仓库取得素材。营地美术独立存放在 `private-assets/public/`，`pnpm dev` 会自动将其连接到 `/client-assets/camp/`，离线也可使用。该目录不进入公开 Git 仓库、源码包和 Docker 镜像。团队协作、多个 worktree 共用素材和自动部署步骤见 [素材开发与部署](ASSETS.md)。

### 测试用配置

```bash
cp .github/misskey/test.yml .config/test.yml
docker compose -f apps/misskey/packages/backend/test/compose.yml up   # 需完整 checkout
pnpm --filter backend test
```

## 方式 B：Devcontainer（VS Code / Cursor）

仓库自带 `.devcontainer/`。用 Dev Containers 打开项目后会跑 `init.sh`：`pnpm install` → 拷配置 → `build` → `migrate`。

Devcontainer 使用仓库要求的 Node 版本，初始化时按 `package.json#packageManager` 安装 pnpm。

使用 Devcontainer 的 Windows 环境建议在 **WSL** 中克隆仓库。直接在 Windows 开发时按仓库 `.gitattributes` 保持换行格式。

## 常用命令

| 用途 | 命令 |
| --- | --- |
| 开发服 | `pnpm dev` |
| 连接本地美术素材 | `pnpm assets:link` |
| 首次拉取或更新团队素材 | `pnpm assets:pull` |
| 检查素材未进入 Git | `pnpm assets:check` |
| 验证素材开发与分发流程 | `pnpm assets:test` |
| 全量构建 | `pnpm build` |
| 迁移 | `pnpm migrate` |
| lint | `pnpm lint` |
| 前端单测 | `pnpm --filter frontend test` |
| 后端单测 | `pnpm --filter backend test` |
| API 变更后重生 misskey-js | `pnpm build-misskey-js-with-types` |

团队日常开发与交付见 [DEVELOPMENT.md](DEVELOPMENT.md)。

手机／邮箱验证注册、注册方式与邮箱限制开关、密码找回及阿里云号码认证配置见 [AUTH.zh-CN.md](AUTH.zh-CN.md)。

## 文案与 AI

- 简中文案改 `apps/misskey/locales/zh-CN.yml`（见 [apps/misskey/locales/README.md](apps/misskey/locales/README.md)）
- AI 硬规矩：[AGENTS.md](AGENTS.md)；改 frontend / backend 前读读 `.claude/skills/` 对应 skill
- 营地固定使用本地社区模式：联邦 / ActivityPub、远程账号解析与互动、中继和跨站迁移均已停用，界面隐藏对应入口。后台设置无法重新开启联邦；已有数据保留。

## 和生产相关的提醒

- 首次启动后 **不要改** `default.yml` 里的对外 `url`（实例身份绑定）
- 不要提交 `.config/default.yml`、密钥、`.env` 生产值
- 部署、删库、force-push 共享分支前先跟人确认
