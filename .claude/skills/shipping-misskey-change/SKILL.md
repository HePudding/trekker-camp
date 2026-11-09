---
name: shipping-misskey-change
description: 在每次 Misskey 修改完成时使用，适用于提交、创建 PR、合并或交还工作之前。按修改范围选择验证，执行已修改文件的 lint 和仓库安全检查，记录 PASS/FAIL/BASELINE/SKIPPED，避免处理无关失败。
---

# shipping-misskey-change

提交、创建 PR、合并 Misskey 修改，或将未提交的工作交还用户之前，必须执行本流程。
规范以 [AGENTS.md](../../../AGENTS.md) 为准，此处仅定义执行方法。

## 1. 验证级别

| 级别 | 条件 | 执行内容 |
| --- | --- | --- |
| 1（必需） | 修改了包内受 ESLint 检查的文件 | 最后对仍存在的已修改文件运行一次 `eslint --quiet` |
| 2 | 修改了实现或行为 | 运行最相关的单元测试；涉及类型、生成文件或数据库时，执行对应专项验证 |
| 3（可选） | 用户明确要求、改动广泛或排查需要 | 对整个包或仓库运行 lint、构建或更大范围的测试 |

纯文档修改等没有适用文件时，将级别 1 记为 `SKIPPED`。
级别 3 中原有的失败记为 `BASELINE`，说明其与本次修改的关系，不将其记为成功。

### 自动检查

在仓库根目录执行一次：

```bash
node scripts/check-shipping.mjs
```

需要指定合入基线时，使用 `--base <ref>` 或 `MISSKEY_BASE_REF`。

脚本完成以下独立检查，并以退出码 0（通过）、1（违规）、2（检查无法执行）汇总结果：

- 以 NUL 分隔安全枚举已提交、未提交和未跟踪的改动，仅对改动文件从所属包根目录运行 `eslint --quiet`。
- 部署脚本、Compose、Caddy 或部署 CI 改动时，执行与 CI 共用的 `bash scripts/check-deploy.sh`；Windows 自动通过默认 WSL 发行版执行，需在该环境提供 Bash、Python 3、Git LFS 和 ShellCheck。工具缺失会报告检查错误。
- SPDX 检查失败时，仅对本地改动中缺失的头运行 `check-spdx.mjs --fix`，然后重新执行常规检查。
- 无论 SPDX 结果如何，都检查语言 YAML 改动：允许产品文案源 `apps/misskey/locales/zh-CN.yml` 和上游同步源 `apps/misskey/locales/ja-JP.yml`，其余语言禁止修改。
- 检查 `private-assets` 和 `apps/misskey/packages/frontend/assets/camp` 的 Git 排除规则，拒绝已进入索引的素材、链接和私有素材子仓库。也可单独运行 `pnpm assets:check`。

语言检查与 GitHub Actions 的 `Locale safety` 共用 `scripts/check-locales.mjs`；也可单独运行 `node scripts/check-locales.mjs --base <ref>`。

得到 `SPDX: OK` 后无需重复检查。
其他常设规则遵循 AGENTS.md。

## 2. 按修改类型检查

- VPS CLI：覆盖成套自更新及失败保留旧命令、自定义数据目录和旧安装兼容、更新前备份、迁移与健康检查、R2 备份及北京时间调度。`check-shipping.mjs` 已调用 `check-deploy.sh`，通过后无需重复执行；真实 Caddy 与 Restic 镜像测试由部署 CI 分别运行。运维路径按 [DEPLOY.zh-CN.md](../../../DEPLOY.zh-CN.md) 和 `camp status` 确认，获得部署授权后使用 `camp update` 完成应用和素材发布。
- 素材脚本、Git/Docker 忽略规则、源码打包或素材部署挂载：运行 `pnpm assets:test`。Docker 不可用时明确记录镜像排除测试为 `SKIPPED`；开发与部署约定见 [ASSETS.md](../../../ASSETS.md)。
- 私有素材库中的修改：分别遵循其 `AGENTS.md` 进行素材验证和提交，主仓库检查保持通过。不要向主仓库添加素材、链接或私有仓库文件；配置服务器后，素材库的 `master` 推送会触发自动发布。
- 后端 API 的 `meta`、`paramDef` 或 `res`：执行 `pnpm build-misskey-js-with-types`。
  步骤见 [regenerate-misskey-js.md](references/tasks/regenerate-misskey-js.md)。
- 实体或迁移：执行 `pnpm --filter backend check-migrations`。
  新迁移同时实现 `up()` 和 `down()`，不修改已合并迁移。
- 后端 API 端点：运行 [misskey-api-reviewer](../../agents/misskey-api-reviewer.md)。
- 前端 `.vue`：运行 [vue-component-reviewer](../../agents/vue-component-reviewer.md)。

## 3. 交接

简要列出执行项目的 `PASS / FAIL / BASELINE / SKIPPED` 状态。
失败时说明与本次修改的关系；未执行时说明原因。
用户未要求时，不提交、不创建 PR，也不向外部发送信息。
