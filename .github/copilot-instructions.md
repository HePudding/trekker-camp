# 旅人营地的 Copilot 指南

本文件作为 GitHub Copilot 的仓库级指令。部分 Copilot 代码审查环境不会读取 `AGENTS.md`，因此本文件应独立提供审查和小范围实现判断所需的规范。

仓库是使用 pnpm workspace 的 Misskey 单体仓库。主要实现位于 `apps/misskey/packages/backend`（NestJS / TypeORM）和 `apps/misskey/packages/frontend`（Vue 3）。可参考根目录 `AGENTS.md` 获取详细指南，但不得省略本文件要求，仅提供指向它的链接。

## 项目定位与支持范围

本项目由团队维护，不征集外部代码贡献。日常开发和 PR 目标为 `master`；产品文案以简体中文为源语言，默认不开展联邦工作。团队流程见根目录 `DEVELOPMENT.md`。

开发、测试和部署流程围绕旅人营地本站及团队需求维护。不主动提供第三方部署、配置和运维支持，不为其他实例增加通用配置或兼容层，除非用户明确要求。

使用者依照各目录适用许可证运行、修改和再分发代码的权利保持不变，不添加“禁止部署”“禁止商用”等许可限制。保持本站运行版本的完整对应源码和构建脚本可获取；独立素材按各自授权管理，缺少私有素材时仍保持公开代码可构建、运行及必要的显示回退。

## VPS 部署工作流

本站使用 `scripts/deploy.sh` 提供的 `camp` CLI，支持 Ubuntu 22.04 / 24.04 / 26.04 LTS。`camp update` 同步代码与素材、备份数据库、迁移并验证健康状态；`camp self-update` 独立更新 CLI，`camp version` 显示 CLI 提交号。部署授权仍需由用户明确提供。

首次配置使用仓库随附的 Misskey Docker 示例模板，初始化调用 `pnpm run init`，Web 使用镜像默认 `migrateandstart` 入口。更新在备份后独立执行官方迁移，再启动应用；已有实例配置和数据保持原位。

`--dir` 是代码目录，未指定时使用 CLI 保存的 `deployment-dir`，自更新保留该记录；首次安装可用 `--data-dir` 指定数据根目录，后续从代码目录 `.config/data-dir` 读取。配置、数据库、上传文件、私有素材和备份按实际数据路径管理，旧安装沿用原路径。路径标记和 Compose 挂载的修改不承担数据迁移。CLI 管理的素材通过 `camp update` 发布，独立 rsync 发布使用独立挂载目录。

CLI 更新成套包含 `deploy.sh` 与 `backup.sh`，下载或校验失败应保留旧命令。R2 定时备份保持每天北京时间 04:00，使用部署共用锁，采集后恢复应用再上传。修改部署脚本、Compose、Caddy 时执行 `bash scripts/check-deploy.sh`；`node scripts/check-shipping.mjs` 会自动调用同一入口，Windows 使用默认 WSL 发行版。完整运行与恢复步骤见 `DEPLOY.zh-CN.md`。

GitHub 认证使用限定私有素材仓库读取的细粒度 PAT，访问成功后保存在数据目录 `.config/github-token`（root `0600`），重开终端和 CLI 自更新后继续使用；环境变量可提供替换值，认证失败保留旧文件。CLI 不依赖 `gh`，不输出凭据内容。

## 严格禁止的操作

违反要求会导致 CI 失败或生产事故。

### 代码与数据

- **必须包含 SPDX 头**：在受 AGPL-3.0-only 管辖且纳入 SPDX CI 检查的目录中，新增 `.ts`、`.js`、`.cjs`、`.mjs`、`.scss`、`.vue`、`.html` 文件时必须在开头添加。
  适用范围见 `scripts/check-spdx.mjs`。

  ```text
  /*
   * SPDX-FileCopyrightText: syuilo and misskey-project
   * SPDX-License-Identifier: AGPL-3.0-only
   */
  ```

  新增 `.vue` 和 `.html` 文件使用 HTML 注释：

  ```text
  <!--
  SPDX-FileCopyrightText: syuilo and misskey-project
  SPDX-License-Identifier: AGPL-3.0-only
  -->
  ```

  `apps/misskey/packages/misskey-js` 是 MIT 许可证子包，不统一添加 AGPL 头，应遵循该子包的 `package.json`、`LICENSE` 和已有文件头。
  CI 和技能均通过 `scripts/check-spdx.mjs` 判断 SPDX 是否合格，代码审查无需重复人工检查。
  CI 使用 `--ci` 检查 SPDX 行是否存在，默认模式还会检查 `.vue` 和 `.html` 的注释格式。

- **语言 YAML 只允许编辑 `apps/misskey/locales/zh-CN.yml`，以及用于上游同步的 `apps/misskey/locales/ja-JP.yml`**。旅人营地的产品文案源语言为简体中文；其余语言文件由上游维护，禁止手动修改。
- **禁止修改已合并迁移**。不得修改 `apps/misskey/packages/backend/migration/{timestamp}-*.js` 中已进入 `develop` 或 `master` 的文件。结构变更必须使用新时间戳创建文件，并同时实现 `up()` 和 `down()`。
- **禁止提交密钥或凭据**，包括 `.config/*.yml` 中的生产配置、`.env`、API 令牌及私钥。
- **独立授权美术单独管理**：素材放在 `private-assets/public/`，原稿、授权记录和素材仓库的 `.git/` 留在 `public/` 外。`pnpm assets:link`（`pnpm dev` 自动执行）将其连接到 `/client-assets/camp/`；多个 worktree 可用 `CAMP_ASSETS_DIR` 指定已有素材目录。通过 URL 加载，保持无私有素材时的默认资源或回退，不 import、内嵌或打包进公开镜像。Docker 使用 `compose.assets.yml` 只读挂载。禁止强制提交素材、链接或私有素材子模块；详细开发与部署步骤见根目录 `ASSETS.md`。
- **团队素材同步**：私有仓库为 `HePudding/trekker-camp-assets`，默认分支 `master`。首次准备团队环境使用 `pnpm assets:pull`，之后按需快进更新；有未提交素材、开发分支或分叉历史时保留现场。`pnpm dev` 不联网拉取素材。素材在私有仓库独立提交和审查，配置服务器后其 `master` 更新会自动发布 `public/`，未经授权不推送该分支。

### Git 与仓库操作

- 禁止向 `main`、`develop`、`master` 执行 `git push --force` 或 `--force-with-lease`。
- 禁止使用 `git commit --no-verify` 跳过钩子。
- 禁止用 `git commit --amend` 改写已合并或已推送的提交。
- 禁止用 `git reset --hard` 或 `git branch -D` 破坏他人分支。
- 未经用户许可，禁止修改 `git config`，尤其是 `user.name`、`user.email`、`commit.gpgsign`。

### Issue、PR 与外部发送

- 未经用户明确要求，禁止合并或关闭 PR，或执行强制推送。
- 未经用户明确要求，禁止向 GitHub 评论、Slack、邮件等外部服务发送信息。

## 交付前的最低检查

1. 最后从所属包根目录，对受 ESLint 检查的改动文件运行一次 `eslint --quiet`；实现改动需运行最相关的测试。全包或全仓库 lint 及更大范围测试为可选项。
2. 修改后端 `meta`、`paramDef` 或 `res` 后，执行 `pnpm build-misskey-js-with-types`，并提交 `apps/misskey/packages/misskey-js/src/autogen/` 的差异。
3. 修改实体或迁移后，确保 `pnpm --filter backend check-migrations` 通过且待执行 DDL 为 0，新迁移已实现 `up()` 和 `down()`。
4. `node scripts/check-spdx.mjs` 返回 `SPDX: OK`。
5. 用户未明确要求时，不编辑 `CHANGELOG.md`；对用户有影响的修改，在交接中提供一行候选条目。
6. 检查已提交、未提交和未跟踪的语言 YAML 改动仅包含 `apps/misskey/locales/zh-CN.yml` 或用于上游同步的 `apps/misskey/locales/ja-JP.yml`，使用 `node scripts/check-locales.mjs`。
7. `pnpm assets:check` 通过，确认私有素材和链接未被 Git 跟踪；`node scripts/check-shipping.mjs` 已集成。修改素材机制、忽略规则或部署挂载时运行 `pnpm assets:test`。
8. 部署相关改动通过 `bash scripts/check-deploy.sh`，包括 CLI 自更新失败保留旧版本、自定义存储、旧路径兼容、迁移前备份和 R2 失败恢复。

## 验证命令

- 全量构建：`pnpm build`
- 全量 lint 和类型检查（可选）：`pnpm lint`
- 后端单元测试：`pnpm --filter backend test`
- 后端端到端测试：`pnpm --filter backend test:e2e`
- 后端联邦测试：`pnpm --filter backend test:fed`
- 前端测试：`pnpm --filter frontend test`
- 迁移差异检查：`pnpm --filter backend check-migrations`
- 重新生成 misskey-js（API 修改后必需）：`pnpm build-misskey-js-with-types`

**注意：**运行后端 `test`、`test:e2e`、`test:fed` 前，需要 `.config/test.yml`。尚未创建时，先执行 `ncp .github/misskey/test.yml .config/test.yml` 或 `cp .github/misskey/test.yml .config/test.yml`。各测试脚本内部会调用 `cross-env NODE_ENV=test pnpm compile-config`，完成复制后无需单独执行 compile-config。

根据修改范围优先选择最相关的命令，必要时扩大到全量检查。

## 编辑提示

- 后端 API、迁移和 TypeORM 修改查看 `apps/misskey/packages/backend`。
- 前端 Vue 组件和页面修改查看 `apps/misskey/packages/frontend`。
- `AGENTS.md` 中的相对链接以仓库根目录为起点。

**补充：**`AGENTS.md` 是更详细的规范来源，由 Codex 和 Claude Code 读取。Copilot 代码审查以本文件为主要入口；环境同时读取两者时，可将 `AGENTS.md` 作为补充。
