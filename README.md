# 旅人营地

面向星塔旅人简中社区的 pnpm monorepo。

| 目录 | 用途 |
| --- | --- |
| `apps/misskey/` | 社区应用，包含后端、前端、SDK、语言文件和应用构建脚本 |
| `apps/<name>/` | 独立应用，例如落地页 `apps/landing/` |
| `packages/<name>/` | 可被多个应用引用的独立插件与共享包 |
| `scripts/` | 仓库检查、私有素材管理和源码打包 |
| `.config/` | 本地运行配置 |
| `private-assets/public/` | 独立授权的运行时素材，不进入 Git 或应用包 |

## 开发社区

在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm assets:pull
pnpm dev
```

没有团队素材库权限时，使用 `pnpm assets:link`。运行环境与配置见 [SETUP.zh-CN.md](SETUP.zh-CN.md)，素材约定见 [ASSETS.md](ASSETS.md)。

根目录的 `pnpm dev`、`pnpm build`、`pnpm start`、`pnpm migrate`、`pnpm test` 和 `pnpm lint` 操作 Misskey。包名过滤仍可使用，例如 `pnpm --filter frontend test`。应用构建产物位于 `apps/misskey/built/` 及各内部包的 `built/`。

`pnpm build:all` 构建 `apps/*` 和 `packages/*` 中提供 build 脚本的项目。所有项目共用根目录的 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml`。

## 添加落地页与插件

在 `apps/landing/` 创建包含独立 `package.json` 的落地页应用；在 `packages/<name>/` 创建插件包。两个目录模式已注册到工作区，新增项目后在根目录运行 `pnpm install`。

应用通过依赖项 `"@trekker-camp/<name>": "workspace:*"` 引用插件。插件用自己的 `package.json` 声明 `name`、`exports`、构建脚本与许可证；内部依赖使用 `workspace:*`，运行 `pnpm --filter <包名> build` 可单独构建。需要独立分发时，用 `pnpm --filter <包名> pack` 生成包，并明确包含所需产物的 `files`。未准备发布的项目设置 `private: true`。

落地页与插件尚未创建，目录约定允许按实际需求添加。Misskey 内部包保持在 `apps/misskey/packages/`，共享插件不依赖应用内部源码。

## 检查与部署

```sh
pnpm check:shipping
pnpm assets:test
docker compose -f compose.yml -f compose.assets.yml up -d --build
```

Docker 构建上下文为仓库根目录。`.config/`、`files/`、`db/`、`redis/` 与 `private-assets/` 保留在根目录，现有数据挂载源路径保持有效。源码压缩包包含工作区配置及应用源码。

社区说明见 [apps/misskey/README.md](apps/misskey/README.md)。开发规则见 [AGENTS.md](AGENTS.md)，许可见 [LICENSE](LICENSE) 和各独立包声明。
