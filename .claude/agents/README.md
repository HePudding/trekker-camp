# `.claude/agents/` — 项目专用子代理

将专注于 Misskey 特定领域的审查、调查代理按 `.claude/agents/<name>.md` 的格式存放。

YAML 文件头（`name`、`description` 和 `tools`）是 Claude 判断**是否自动调用代理**的唯一线索。`description` 应**简洁地描述影响调用判断的领域、路径、文件类型和专门检查项**，采用“动词 + 对象 + 触发条件”的形式。选择能区分其他审查代理的关键词，避免将正文检查清单全部列出。

本文件不维护已实现代理的列表，以免过时。各 `<name>.md` 的文件头负责说明代理用途。

## 与其他审查方式的分工

明确职责，避免增加重复审查：

- **本目录中的两个代理**：执行后端端点、Vue 单文件组件的 **Misskey 专用规则检查**，如遗漏 `endpoint-list` 注册、遗漏 `misskey-js` 重新生成、仅允许编辑 `ja-JP.yml`、配套 Storybook 示例等。限定在值得使用独立上下文扫描差异的领域。
- **`pr-review-toolkit` 插件**（code-reviewer、silent-failure-hunter 等）：审查与语言无关的通用代码质量、缺陷和设计，不检查 Misskey 专用规范。
- **`working-on-*` 技能的清单**：供**编写代码过程中**自查，承担实现指南的职责。

Misskey 专用规则由本目录代理检查，通用质量由 pr-review-toolkit 检查，实现过程由技能指导。

## 组织原则

- `tools` **不授予编辑权限**，不提供 Edit/Write。代理根据 PR 基线（`git merge-base origin/develop HEAD`）的差异自动提取审查对象。
- 以 `git merge-base origin/develop HEAD` 为差异基线，覆盖整个 PR 或分支。不要单独使用 `git diff HEAD`：它只包含未提交的差异，已提交的 PR 会得到空结果并导致误判。
- `description` 既用于调用判断，也会在每次启动 Task 工具时常驻加载，即使该代理未被调用。**仅保留不可替代、能准确触发调用的关键词**。通用或重复描述只会增加上下文开销。可通过 [/harness-audit](../commands/harness-audit.md) 和 [context-budget 技能](../skills/context-budget/SKILL.md) 检查。
- **规范以 `.claude/skills/*/references/` 为准**。代理检查清单是其派生副本，以便子代理无需读取技能也能独立执行。修改规范时，先修改参考文件，再同步代理；出现差异时以参考文件为准。

## 添加新代理

- 在 `.claude/agents/<name>.md` 中编写 YAML 文件头（`name`、`description`、`tools`）及 Markdown 正文。
- 描述应列出目标领域、主要检查项及触发条件。由于会常驻加载，应保持简洁，只保留有区分度的关键词。
- 专门用于审查时，将工具限制为 `tools: Read, Grep, Glob, Bash`，不授予 Edit/Write。**注意：Bash 能运行任意 shell 命令，权限很强**。审查中仅使用 `git diff`、`git ls-files`、`grep`、`sed` 等读取命令。正文示例和指令中不要包含写入、删除或网络发送操作；代理正文负责约束这些行为。
- 主要参考文件的链接使用相对于当前代理 Markdown 文件的路径，例如 `../../apps/misskey/packages/backend/...`，避免依赖贡献者个人主目录的绝对路径。
