---
name: context-budget
description: 按代理、技能、MCP、规则和 CLAUDE.md 展示 Claude Code 会话的上下文消耗，识别膨胀与重复组件，提出节省建议。用户询问“上下文消耗”“context budget”“context audit”“令牌占用明细”或“还能添加 MCP 吗”等时使用。
---

<!--
SPDX-License-Identifier: MIT
SPDX-FileCopyrightText: 2026 Affaan Mustafa and everything-claude-code contributors

上游来源：https://github.com/affaan-m/everything-claude-code (v2.0.0-rc.1)
上游路径：skills/context-budget/SKILL.md
上游文件头来源：ECC
上游许可证：MIT — https://github.com/affaan-m/everything-claude-code/blob/main/LICENSE
项目声明：.claude/THIRD_PARTY_LICENSES.md，包含第三方组件列表及 MIT 全文。

于 2026-05-10 作为独立副本引入 Misskey .claude/，不依赖 ECC 插件运行时。描述已本地化，并补充 Misskey 专用说明；正文继续使用 MIT 许可证。

Misskey 自有技能和代理较少，MCP、CLAUDE.md 及插件通常占据较多上下文。
-->

# 上下文预算

分析会话加载的代理、技能、规则、MCP 服务器和 CLAUDE.md 的令牌开销，提出释放上下文的具体方法。

## 使用场景

- 会话变慢或输出质量下降。
- 最近添加了大量技能、代理或 MCP。
- 需要了解上下文剩余空间。
- 添加组件前检查容量。
- 用户明确提出上下文预算或令牌明细请求。本仓库没有同名斜杠命令，本技能按名称与描述自动匹配；命令列表见 [.claude/commands/](../../commands/)。

## 第 1 阶段：盘点

扫描各组件并估算令牌。

**代理（.claude/agents/*.md）**

- 统计行数与令牌，按单词数 × 1.3 估算。
- 提取 description 长度。
- 标记超过 200 行的代理，以及 description 超过 30 个单词的文件头。

**技能（.claude/skills/*/SKILL.md）**

- 计算各 SKILL.md 的令牌。
- 标记超过 400 行的文件。
- 排除 .agents/skills 等重复副本。

**规则（根目录 AGENTS.md 与 .claude/ 的 @ 导入文件）**

- 按文件估算令牌。
- 标记超过 100 行的文件。
- 检查同一语言模块中的重复内容。

**MCP（.mcp.json 或当前有效配置）**

- 统计服务器和工具总数。
- 每个工具的架构约按 500 令牌估算。
- 标记超过 20 个工具的服务器，以及仅包装 gh、git、npm 等 CLI 的服务器。

**CLAUDE.md（项目级与用户级）**

- 按文件估算令牌。
- 合计超过 300 行时标记。

## 第 2 阶段：分类

| 类别 | 判断依据 | 行动 |
|---|---|---|
| 始终需要 | CLAUDE.md 引用、支撑有效命令或匹配当前项目 | 保留 |
| 偶尔需要 | 依赖特定领域、未被 CLAUDE.md 引用 | 考虑按需启用 |
| 很少需要 | 无命令引用、重复或用途不明确 | 删除或延迟加载 |

## 第 3 阶段：识别问题

- **代理描述过长**：超过 30 个单词，且每次 Task 调用都会加载。
- **代理正文过长**：超过 200 行，增加每次调用的上下文。
- **重复组件**：技能与代理重复，或规则与 CLAUDE.md 重复。
- **MCP 过多**：超过 10 个服务器，或可由 CLI 替代。
- **CLAUDE.md 膨胀**：冗余解释、过时章节或应拆入规则的指令。

## 第 4 阶段：报告

报告包含：

- 总估算开销：约 XX,XXX 令牌。
- 当前模型及上下文窗口，例如 Claude Opus 4.7（1M）、Claude Sonnet（200K）。
- 可用上下文：约 XXX,XXX 令牌及比例。
- 按代理、技能、规则、MCP 工具、CLAUDE.md 列出数量和令牌表格。
- 按可节省令牌降序列出问题。
- 三项优先优化及各自节省量。
- 总潜在节省量及其占当前开销的比例。

详细模式额外列出逐文件明细、最重文件的逐行占用、重复行对照，以及各 MCP 工具的架构大小。

## 示例

### 基本审计

用户要求查看上下文消耗时，可报告：
16 个代理占 12,400 令牌，28 个技能占 6,200，87 个 MCP 工具占 43,500，2 个 CLAUDE.md 占 1,200。
发现 3 个过重代理及 3 个可由 CLI 替代的 MCP；移除这些 MCP 可节省 27,500 令牌，约为开销的 47%。

### 详细模式

除总表外，列出 planner.md 等文件的行数和令牌数，例如 213 行、1,840 令牌，并展示 MCP 工具大小与规则重复行对照。

### 添加前检查

当前占用 33%；再添加 5 个服务器、约 50 个工具会增加 25,000 令牌，达到 45%。
建议先移除两个可由 CLI 替代的服务器，将占用维持在 40% 以下。

## 最佳实践

- 说明文本按单词数 × 1.3，代码按字符数 ÷ 4 估算。
- MCP 通常最值得优化：每个工具约 500 令牌，30 个工具的服务器可能超过全部技能。
- 代理描述常驻加载，即使代理未被调用。
- 详细模式用于调试，日常保持简洁。
- 新增代理、技能或 MCP 后执行审计，及早发现占用增长。

## Misskey 专用说明

- 项目没有显式注册 MCP（无 .mcp.json），主要开销来自 CLAUDE.md 和官方插件的技能、代理描述。
- ECC 插件存在于用户级 installed_plugins.json，即使项目未在 enabledPlugins 启用，也可能在系统提醒中出现 200 多个技能。单个描述较短，但应通过本技能检查总占用。
