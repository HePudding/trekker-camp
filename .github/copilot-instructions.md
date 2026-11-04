# Misskey 的 Copilot 指南

本文件作为 GitHub Copilot 的仓库级指令。部分 Copilot 代码审查环境不会读取 `AGENTS.md`，因此本文件应独立提供审查和小范围实现判断所需的规范。

仓库是使用 pnpm workspace 的 Misskey 单体仓库。主要实现位于 `packages/backend`（NestJS / TypeORM）和 `packages/frontend`（Vue 3）。可参考根目录 `AGENTS.md` 获取详细指南，但不得省略本文件要求，仅提供指向它的链接。

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

  `packages/misskey-js` 是 MIT 许可证子包，不统一添加 AGPL 头，应遵循该子包的 `package.json`、`LICENSE` 和已有文件头。
  CI 和技能均通过 `scripts/check-spdx.mjs` 判断 SPDX 是否合格，代码审查无需重复人工检查。
  CI 使用 `--ci` 检查 SPDX 行是否存在，默认模式还会检查 `.vue` 和 `.html` 的注释格式。

- **语言 YAML 只允许编辑 `locales/zh-CN.yml`，以及用于上游同步的 `locales/ja-JP.yml`**。旅人营地的产品文案源语言为简体中文；其余语言文件由上游维护，禁止手动修改。
- **禁止修改已合并迁移**。不得修改 `packages/backend/migration/{timestamp}-*.js` 中已进入 `develop` 或 `master` 的文件。结构变更必须使用新时间戳创建文件，并同时实现 `up()` 和 `down()`。
- **禁止提交密钥或凭据**，包括 `.config/*.yml` 中的生产配置、`.env`、API 令牌及私钥。

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
2. 修改后端 `meta`、`paramDef` 或 `res` 后，执行 `pnpm build-misskey-js-with-types`，并提交 `packages/misskey-js/src/autogen/` 的差异。
3. 修改实体或迁移后，确保 `pnpm --filter backend check-migrations` 通过且待执行 DDL 为 0，新迁移已实现 `up()` 和 `down()`。
4. `node scripts/check-spdx.mjs` 返回 `SPDX: OK`。
5. 用户未明确要求时，不编辑 `CHANGELOG.md`；对用户有影响的修改，在交接中提供一行候选条目。
6. 检查已提交、未提交和未跟踪的语言 YAML 改动仅包含 `locales/zh-CN.yml` 或用于上游同步的 `locales/ja-JP.yml`，使用 `node scripts/check-locales.mjs`。

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

- 后端 API、迁移和 TypeORM 修改查看 `packages/backend`。
- 前端 Vue 组件和页面修改查看 `packages/frontend`。
- `AGENTS.md` 中的相对链接以仓库根目录为起点。

**补充：**`AGENTS.md` 是更详细的规范来源，由 Codex 和 Claude Code 读取。Copilot 代码审查以本文件为主要入口；环境同时读取两者时，可将 `AGENTS.md` 作为补充。
