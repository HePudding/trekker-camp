# 旅人营地 · 社区应用

本站基于 Misskey 定制的社区应用，包含前后端、SDK、语言资源和应用构建脚本。项目定位和许可说明见[仓库首页](../../README.md)。

## 目录

| 目录 | 用途 |
| --- | --- |
| `packages/backend/` | NestJS 后端、API、数据实体和迁移 |
| `packages/frontend/` | Vue 社区界面和 Storybook |
| `packages/frontend-shared/` | 前端共享逻辑和主题 |
| `packages/frontend-embed/` | 嵌入式界面 |
| `packages/misskey-js/` | 随本站 API 维护的 SDK 与类型 |
| `packages/i18n/`、`locales/` | 语言资源与类型生成 |
| `packages-private/` | 开发和 CI 工具 |

## 开发与构建

在仓库根目录运行 `pnpm dev`、`pnpm build`、`pnpm start` 或 `pnpm migrate`。这些根脚本调用本应用的脚本。使用 `pnpm --filter <包名> <命令>` 可操作内部包。

应用构建产物位于本目录的 `built/` 及各包的 `built/`。本地配置、运行数据和独立素材位于仓库根目录，按[环境指南](../../SETUP.zh-CN.md)与[素材指南](../../ASSETS.md)准备。

团队流程见[开发指南](../../DEVELOPMENT.md)，AI 修改遵循 [AGENTS.md](../../AGENTS.md)。本应用按营地需求维护，不征集外部贡献。
