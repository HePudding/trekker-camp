# 旅人营地 · 本地开发环境

仓库：https://github.com/HePudding/trekker-camp  
默认分支：`master`（对齐上游 Misskey 正式版线）  
版本锚点（以仓库文件为准）：`.node-version` → Node **26.12.1**，`package.json#packageManager` → **pnpm@12.14.0**（当前 `2026.10.1` / nasubi）。

依赖中间件：**PostgreSQL**、**Redis**、**FFmpeg**。Meilisearch 可选（搜相关功能/测试才需要）。

## 方式 A：本机 + Docker 只跑数据库

适合已经装好 Node / pnpm / FFmpeg 的机器。

```bash
git clone https://github.com/HePudding/trekker-camp.git
cd trekker-camp
git checkout master

# Node 26.12.x + 启用 corepack 以匹配 packageManager
corepack enable
corepack prepare pnpm@12.14.0 --activate

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

`pnpm dev` 会 watch 后端并透过 Vite HMR 跑前端；行为与生产构建不完全一致，属正常。

### 测试用配置

```bash
cp .github/misskey/test.yml .config/test.yml
docker compose -f packages/backend/test/compose.yml up   # 需完整 checkout
pnpm --filter backend test
```

## 方式 B：Devcontainer（VS Code / Cursor）

仓库自带 `.devcontainer/`。用 Dev Containers 打开项目后会跑 `init.sh`：`pnpm install` → 拷配置 → `build` → `migrate`。

注意：上游 `devcontainer.json` 里写死的 Node / pnpm **偏旧**（例如 Node 22 + pnpm 10），和当前 `.node-version` / `packageManager` 可能不一致。若 postCreate 失败，优先把 feature 版本改成与 `.node-version`、`package.json#packageManager` 一致，或改用方式 A。

Windows：请在 **WSL** 里 clone；Git for Windows 的换行会把仓库弄坏。

## 常用命令

| 用途 | 命令 |
| --- | --- |
| 开发服 | `pnpm dev` |
| 全量构建 | `pnpm build` |
| 迁移 | `pnpm migrate` |
| lint | `pnpm lint` |
| 前端单测 | `pnpm --filter frontend test` |
| 后端单测 | `pnpm --filter backend test` |
| API 变更后重生 misskey-js | `pnpm build-misskey-js-with-types` |

## 文案与 AI

- 简中文案改 `locales/zh-CN.yml`（见 [locales/README.md](locales/README.md)）
- AI 硬规矩：[AGENTS.md](AGENTS.md)；改 frontend / backend 前读读 `.claude/skills/` 对应 skill
- 营地固定使用本地社区模式：联邦 / ActivityPub、远程账号解析与互动、中继和跨站迁移均已停用，界面隐藏对应入口。后台设置无法重新开启联邦；已有数据保留。

## 和生产相关的提醒

- 首次启动后 **不要改** `default.yml` 里的对外 `url`（实例身份绑定）
- 不要提交 `.config/default.yml`、密钥、`.env` 生产值
- 部署、删库、force-push 共享分支前先跟人确认
