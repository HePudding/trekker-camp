# `.claude/skills/` — 项目专用技能

将 Misskey 中重复执行的任务编写为**自定义技能**，按 `.claude/skills/<name>/SKILL.md` 的格式存放，让 Claude 能顺利执行。

YAML 文件头（`name` 和 `description`）是 Claude 判断**是否自动调用技能**的唯一线索。`description` 应具体、全面地描述用途，并使用明确的触发措辞（例如“凡是……都应使用”“在任何……之前必须阅读”），便于发现技能。

本文件不维护已实现技能的列表，以免过时。各子目录中 `SKILL.md` 的文件头负责说明技能用途。

## 组织原则

遵循 Anthropic 官方的 [Agent Skills 最佳实践](https://platform.claude.com/docs/ja/agents-and-tools/agent-skills/best-practices)，采用以下结构：

- **SKILL.md 正文不超过 500 行**，理想情况下为 30–80 行的索引。
- 详细内容分别放入 `references/tasks/`（操作步骤）和 `references/knowledge/`（规范与背景知识），按需加载。
- 原则上仅使用**直接指向 references 的一层链接**；允许链接到其他技能或代理。
- 文件系统中的参考文件在读取前不占用上下文。

包含源自 ECC（everything-claude-code）的 MIT 技能时，在文件开头添加 SPDX 头，并在 [.claude/THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md) 第 1 节注明来源。

## 添加新技能

- 在 `.claude/skills/<name>/SKILL.md` 中编写 YAML 文件头（`name` 和 `description`）以及 Markdown 正文。
- 描述使用第三人称的“在……时使用”形式，覆盖主要关键词，并加入“必须在……之前阅读”等明确触发措辞。
- 不设置 `disable-model-invocation: true`，以便自动调用。
- 主要参考文件的链接使用相对于当前 Markdown 文件的路径，例如 `../../../../apps/misskey/packages/backend/...`。避免依赖开发者个人主目录的绝对路径。
- 拆分详细内容时，遵循 `references/tasks/`（步骤）和 `references/knowledge/`（知识）的分类。
- 建议通过官方 `/skill-creator` 技能的指南创建技能。

## 相关说明

- 技能通过各自的描述自动建立索引，因此本文件和 `AGENTS.md` 均不维护手写技能清单。以文件头的描述为唯一索引，避免清单过时。
- 可以使用 [/harness-audit](../commands/harness-audit.md) 评估技能本身的健康状况。
