# 旅人营地（trekker-camp）

面向星塔旅人（Stella Sora）简中玩家的第三方社区，基于 [Misskey](https://github.com/misskey-dev/misskey) 定制，由项目团队维护。默认开发分支为 `master`。

## 项目定位与支持范围

开发围绕旅人营地本站的交流体验、内容管理、文案和主题展开。本站采用本地社区模式。产品文案以简体中文为源语言，提供简体中文和繁体中文界面。

本项目不征集外部代码贡献，不主动提供第三方部署、配置和运维支持。公开文档记录本站及团队的维护流程，其他使用者可自行参考。

代码按各目录的适用许可证提供，主体沿用 [AGPL-3.0](LICENSE)，`misskey-js` 等独立包遵循各自声明。使用者依照适用许可证运行、修改和再分发代码的权利保持不变。本站运行版本的完整对应源码与构建脚本保持可获取。

独立授权的美术、字体和音频分别管理，不随公开代码分发；素材和品牌使用遵循各自授权。Misskey 的版权声明与第三方许可记录保留在对应文件中。

## 文档入口

| 文档 | 用途 |
| --- | --- |
| [本地开发环境](SETUP.zh-CN.md) | 团队环境、配置与启动 |
| [团队开发指南](DEVELOPMENT.md) | 开发约定、验证、审查与发布 |
| [素材管理](ASSETS.md) | 私有素材同步、加载与部署 |
| [维护方向](ROADMAP.md) | 产品范围与任务安排 |
| [安全说明](SECURITY.md) | 本站安全问题的报告与处理 |
| [AI 代理指南](AGENTS.md) | AI 工作规则与检查要求 |
| [社区应用](apps/misskey/README.md) | 应用内部目录与命令 |

## 仓库结构

| 目录 | 用途 |
| --- | --- |
| `apps/misskey/` | 社区应用：后端、前端、SDK、语言文件和构建脚本 |
| `apps/` | 独立应用目录，按本站需求添加 |
| `packages/` | 独立插件与共享包 |
| `scripts/` | 仓库检查、素材管理和源码打包 |
| `.config/` | 本地运行配置 |
| `private-assets/public/` | 独立授权的运行时素材，不进入公开 Git 或应用包 |

项目使用 pnpm workspace，共用根目录的 `pnpm-workspace.yaml` 和 `pnpm-lock.yaml`。新增应用或共享包须有明确的本站需求，目录约定见 [packages/README.md](packages/README.md)。

## 本地开发

先按[环境指南](SETUP.zh-CN.md)准备 Node、pnpm、数据库和应用配置，再在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm assets:pull
pnpm build
pnpm migrate
pnpm dev
```

没有素材库权限时使用 `pnpm assets:link`，以公开默认资源运行。日常开发使用 `pnpm dev`；交付前执行 `pnpm check:shipping` 和与改动相关的验证。
