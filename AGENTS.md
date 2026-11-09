# 旅人营地 (trekker-camp) – AI 代理指南

本仓库是 [misskey-dev/misskey](https://github.com/misskey-dev/misskey) 的 fork，面向 **星塔旅人（Stella Sora）简中第三方社区**。默认开发分支是 **`master`**。

本文件供 AI 编码助手（Claude Code / OpenAI Codex / GitHub Copilot / 小筑等）使用，包含强制规则和最低检查要求。读取路径与上游相同：

- **Claude Code**：根目录 `CLAUDE.md` → `@AGENTS.md`；细节在 `.claude/skills/`。
- **OpenAI Codex**：直接读取本文件；`.agents/skills/` 指向 `.claude/skills/`。
- **GitHub Copilot**：`.github/copilot-instructions.md`。

团队开发指南见 [DEVELOPMENT.md](DEVELOPMENT.md)和 [SETUP.zh-CN.md](SETUP.zh-CN.md)（本仓库环境搭建）。

## 旅人营地覆盖规则（优先于下文上游规则）

1. **产品文案源语言是简体中文 `apps/misskey/locales/zh-CN.yml`**
   - AI 和开发者可以、也应当编辑 `apps/misskey/locales/zh-CN.yml`。
   - 禁止手动编辑其他语言 YAML（`en-US.yml`、`zh-TW.yml` 等；`ja-JP.yml` 仅用于上游同步），避免与上游或 Crowdin 同步相互覆盖。
   - 合入上游文案时，先合并 `ja-JP.yml`（上游源语言），再将旅人营地需要的键写入 `zh-CN.yml`。
   - 前端新增国际化键时，写入 `zh-CN.yml`，并通过实例配置或默认语言设置保证运行时默认使用简体中文。
2. **默认不开展 Federation / ActivityPub / 联邦相关工作**
   - 除非主人明确要求，不修改 AP 载荷、联邦测试或远程互动相关代码。
   - 联邦代码按现有状态保留，仅在明确任务涉及时处理。
3. **不要主动扩大产品范围**
   - 本项目由团队维护，不征集外部代码贡献；Issue 和 PR 用于团队记录与审查，无需为已有明确任务另建 Issue。
   - 只实现主人指定的功能，以及面向“营地 / 旅人”的用户体验、文案和主题修改。
   - 开发、测试和部署流程围绕本站及团队需求维护。不主动提供第三方部署、配置和运维支持，不为其他实例增加通用配置或兼容层，除非主人明确要求。
   - 保留使用者依照适用许可证运行、修改和再分发代码的权利；不添加“禁止部署”“禁止商用”等许可限制。保持本站运行版本的完整对应源码和构建脚本可获取，独立素材按各自授权管理。
4. **破坏性操作需确认**
   - 除非主人明确要求，不部署生产、不强制推送共享分支、不删除数据、不关闭 Issue，也不代发评论。
5. **交付分支**
   - PR 和直接推送默认以 `master` 为目标；本仓库不使用 `develop` 作为日常开发主线。
6. **独立授权美术单独管理**
   - 开发和部署约定见 [ASSETS.md](ASSETS.md)。网页素材放在 `private-assets/public/`，原稿与授权记录放在 `public/` 外；两个目录及素材链接均不提交到公开仓库。
   - 团队素材库是 `HePudding/trekker-camp-assets`（Private，`master`）。首次准备团队开发环境用 `pnpm assets:pull`，以后按需快进同步；它会保留未提交素材和开发分支。无素材库权限时可用 `pnpm assets:link` 创建空目录。`pnpm dev` 离线建立或复用链接，通过 `/client-assets/camp/` 加载。多个 worktree 可通过 `CAMP_ASSETS_DIR` 共用已有的 `public` 目录。
   - 保持素材运行时加载，不将其 import、内嵌或复制进 JS/CSS 包、公开资源目录及镜像。程序代码、样式和构建脚本保持公开；没有私有素材时仍可构建、运行并使用默认资源或回退。
   - Docker 使用 `compose.assets.yml` 只读挂载素材。不要将整个素材仓库（含原稿、授权记录或 `.git`）暴露为静态目录。
   - 不强制添加忽略的素材或链接，不创建指向私有素材库的 Git 子模块。修改素材机制、忽略规则或部署挂载时运行 `pnpm assets:test`；交付流程自动执行 `assets:check`。
   - 素材与代码分别提交。素材库的 `master` 更新在配置服务器后会自动同步 `public/`，未经授权不推送素材库 `master`。素材库的 Agent 规则与授权记录分别位于其 `AGENTS.md` 和 `RIGHTS.md`；不将 SSH 凭据加入任何仓库。

7. **本站 VPS 使用部署 CLI**
   - 运维入口和存储布局见 [DEPLOY.zh-CN.md](DEPLOY.zh-CN.md)。终端中直接运行 `camp` 打开交互菜单；Agent 自动化使用子命令。首次部署用 `camp install`，应用与素材更新用 `camp update`，CLI 自身更新用 `camp self-update`，版本用 `camp version` 查看。
   - 首次配置使用仓库随附的 Misskey Docker 示例模板，初始化调用 `pnpm run init`，Web 使用镜像默认 `migrateandstart` 入口；更新先备份、独立执行官方迁移，再启动并检查健康状态。保留已有实例配置和数据。
   - 启停使用 `camp start`、`camp stop`、`camp restart`；开机自启使用 `camp autostart on/off`，状态由 `camp status` 显示。保留数据目录中的 `.config/compose.autostart.yml`，启停和自启设置与更新、备份共用锁；不要通过停用整个 Docker 服务来关闭本站自启。
   - `--dir` 指定代码目录，未指定时使用 CLI 保存的 `deployment-dir`；自更新保留该记录。首次安装的 `--data-dir` 指定数据根目录，后续命令读取代码目录 `.config/data-dir`。保留已有数据位置，禁止通过修改路径标记或 Compose 挂载来代替数据迁移。
   - 私有素材使用仅限该仓库读取的细粒度 PAT；CLI 在访问成功后保存到数据目录 `.config/github-token`（root `0600`），环境变量可提供替换值。保留已保存的 PAT，不依赖 `gh`，不输出凭据内容。
   - 获得生产部署授权后，使用 CLI 完成素材同步、迁移前备份和健康检查；按 `camp status` 显示的实际路径操作。CLI 管理的素材工作副本由 `camp update` 更新，独立 rsync 发布使用独立挂载目录。
   - R2 备份使用同一数据根目录，每天北京时间 04:00 执行。CLI 更新需成套交付 `deploy.sh` 与 `backup.sh`，保留备份与更新共用锁、失败恢复和旧安装路径兼容。
   - 修改部署脚本、Compose 或 Caddy 时运行 `bash scripts/check-deploy.sh`；该入口由部署 CI 和 `node scripts/check-shipping.mjs` 共用，Windows 交付检查通过默认 WSL 发行版执行。公开 CI 使用临时数据和测试凭据。

下文保留上游 Misskey 的通用禁止事项与检查清单。发生冲突时，**以本节为准**。

---

## 严格禁止的操作

违反以下要求会导致 CI 失败、生产事故或共享环境损坏，必须遵守。

### 代码与数据

1. **禁止向受 AGPL 管辖的目录添加缺少 SPDX 头的新文件**
   - 适用类型：新增的 `.ts`、`.js`、`.cjs`、`.mjs`、`.vue`、`.scss`、`.html` 文件。
   - 适用范围和判断逻辑由 [scripts/check-spdx.mjs](scripts/check-spdx.mjs) 统一管理。
   - 执行一次 `node scripts/check-spdx.mjs`，缺失时使用 `--fix` 补齐。得到 `SPDX: OK` 后无需额外人工检查。
   - `apps/misskey/packages/misskey-js` 是 MIT 许可证子包，不应统一添加 AGPL 头；遵循该子包的 `package.json`、`LICENSE` 和已有文件头。

2. **禁止手动编辑 `apps/misskey/locales/zh-CN.yml` 和用于上游同步的 `apps/misskey/locales/ja-JP.yml` 之外的语言 YAML**
   - 旅人营地的产品文案源文件是 **`zh-CN.yml`**，AI 可以编辑。
   - `ja-JP.yml` 保留为上游 Misskey 的同步入口；本 fork 默认关闭 Crowdin 流程。
   - 禁止手动编辑 `en-US.yml`、`zh-TW.yml` 等其他语言，避免同步覆盖和无关差异。
   - 上游依据见 [apps/misskey/locales/README.md](apps/misskey/locales/README.md) 和 [crowdin.yml](crowdin.yml)；本仓库以“旅人营地覆盖规则”为准。

3. **禁止修改已合并的迁移文件**
   - 适用范围：`apps/misskey/packages/backend/migration/{unixMs}-{name}.js` 中已合并到 `develop` 或 `master` 的文件。
   - 改写历史会导致生产环境严重的数据不一致。
   - 需要修改数据库结构时，使用新时间戳创建迁移文件（`node -e "console.log(Date.now())"`）。
   - 新迁移必须同时实现 `up()` 和 `down()`，并通过 `pnpm --filter backend check-migrations`，使用 TypeORM 架构构建器检查待执行 DDL。

### Git 与仓库操作

4. 禁止向 `main`、`develop`、`master` 执行 `git push --force` 或 `--force-with-lease`，以免覆盖他人工作。
5. 禁止使用 `git commit --no-verify` 跳过钩子。
6. 禁止用 `git commit --amend` 改写已合并或已推送的提交。
7. 禁止用 `git reset --hard` 或 `git branch -D` 破坏他人的分支。
8. 未经用户许可，禁止修改 `git config`，尤其是 `user.name`、`user.email`、`commit.gpgsign`。

### Issue、PR 与外部发送

9. 未经用户明确要求，禁止合并或关闭 PR，或执行强制推送。
10. 未经用户明确要求，禁止向 GitHub 评论、Slack、邮件等外部服务发送信息。
11. 禁止向仓库提交密钥或凭据，包括 `.config/*.yml` 中的生产配置、`.env` 文件、API 令牌和私钥。
12. 禁止通过普通 Issue 或 PR 报告漏洞；漏洞报告规则见 `creating-issues-and-prs` 技能。

### 技能调用

无论已执行哪些上游技能、掌握多少先验知识或记忆，以下要求均适用。

13. 编辑或添加 `apps/misskey/packages/backend/` 下的文件前，必须阅读 `working-on-backend` 技能。
14. 编辑或添加 `apps/misskey/packages/frontend/` 下的文件前，必须阅读 `working-on-frontend` 技能。
    - 技能与参考文档统一以 `zh-CN.yml` 为产品文案源语言，`ja-JP.yml` 仅用于上游同步。
15. 提交、创建 PR 或将工作交还用户前，必须阅读 `shipping-misskey-change` 技能。
16. 创建 Issue 或 PR 前，必须阅读 `creating-issues-and-prs` 技能，包括漏洞报告规则。

---

## 交付前的最低检查

所有代理都必须阅读 [shipping-misskey-change 技能](.claude/skills/shipping-misskey-change/SKILL.md)。即使当前环境无法使用技能，也必须执行以下检查：

1. **lint 与测试**：最后从所属包根目录，对受 ESLint 检查的改动文件运行一次 `eslint --quiet`；实现改动需运行最相关的测试。整个包或仓库的 lint 及更大范围测试为可选项。
2. **后端 API 修改**：执行 `pnpm build-misskey-js-with-types`，将 `apps/misskey/packages/misskey-js/src/autogen/` 的差异一并提交。
3. **实体或迁移修改**：`pnpm --filter backend check-migrations` 通过且待执行 DDL 为 0；新迁移已同时实现 `up()` 和 `down()`。
4. **SPDX**：`node scripts/check-spdx.mjs` 返回 `SPDX: OK`。
5. **语言文件安全**：改动集合中只允许出现 `apps/misskey/locales/zh-CN.yml`，以及仅用于上游同步的 `apps/misskey/locales/ja-JP.yml`；不混入其他语言 YAML 的差异。
6. **[CHANGELOG](.claude/skills/shipping-misskey-change/references/tasks/changelog-update.md)**：用户未明确要求时不编辑。存在用户可感知的修改时，在交接中提供一行候选条目。
7. **素材分发**：`pnpm assets:check` 通过，确认私有素材和本地链接没有进入 Git 索引；该项已纳入 `node scripts/check-shipping.mjs`。

### 验证命令

根据改动范围优先选择最相关的命令。

| 用途 | 命令 |
| --- | --- |
| 全仓库 lint（可选） | `pnpm lint` |
| 后端单元测试 | `pnpm --filter backend test` |
| 后端端到端测试 | `pnpm --filter backend test:e2e` |
| 后端联邦测试 | `pnpm --filter backend test:fed` |
| 前端单元测试 | `pnpm --filter frontend test` |
| 迁移差异检查（待执行 DDL） | `pnpm --filter backend check-migrations` |
| 重新生成 misskey-js（API 修改后必需） | `pnpm build-misskey-js-with-types` |
| 全量构建 | `pnpm build` |
| 开发服务器（前后端监听模式） | `pnpm dev` |

**注意：**运行后端测试（`test`、`test:e2e`、`test:fed`）前，需要 `.config/test.yml`。可运行 `ncp .github/misskey/test.yml .config/test.yml` 或 `cp .github/misskey/test.yml .config/test.yml` 创建。
