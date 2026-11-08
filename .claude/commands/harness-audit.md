---
description: 按七个类别确定性评估 Misskey 的 .claude/ 协作配置，包括技能、代理和命令。
argument-hint: "[repo|skills|commands|agents]"
---

<!--
SPDX-License-Identifier: MIT
SPDX-FileCopyrightText: 2026 Affaan Mustafa and everything-claude-code contributors

上游来源：https://github.com/affaan-m/everything-claude-code (v2.0.0-rc.1)
上游路径：commands/harness-audit.md
上游许可证：MIT — https://github.com/affaan-m/everything-claude-code/blob/main/LICENSE
项目声明：.claude/THIRD_PARTY_LICENSES.md，包含第三方列表与 MIT 全文。

于 2026-05-10 引入 Misskey .claude/。七类评分及输出约定来自 ECC（MIT）。
执行层已针对 Misskey 重写：使用仓库命令及 SPDX 检查器，加入 SPDX 覆盖、端点注册、迁移顺序和语言文件一致性等评估维度。
原版通过 scripts/harness-audit.js 自动评分。本版不依赖 ECC 运行时，由 Claude 读取文件并按相同标准评分。
-->

# /harness-audit — Misskey AI 协作配置审计

按七类评估 .claude/ 配置，并提出改进优先级。

## 用法

`/harness-audit [scope]`

scope 可选，支持 repo（默认）、skills、commands、agents。

## 评分类别（各 0–10 分）

| 编号 | 类别 | 依据 |
|---|---|---|
| 1 | 工具覆盖 | 技能、代理、命令数量，工作流缺口及重复 |
| 2 | 上下文效率 | description 冗余、技能长度、重复信息、CLAUDE.md 膨胀 |
| 3 | 质量检查 | 改动文件 lint、quality-gate、专项测试和类型检查、与 CI 一致性 |
| 4 | 知识持久化 | SKILL.md 与 references 同步程度；项目不使用 .claude/memory，自动记忆位于用户目录，因此默认从 5/10 起评 |
| 5 | 验证覆盖 | 前后端测试参考文档，以及端到端、联邦、Storybook、Playwright 指引 |
| 6 | 安全约束 | SPDX、迁移不可变、简中产品文案与上游语言同步规则、密钥检测 |
| 7 | 成本效率 | enabledPlugins 重复或过多、context-budget 是否完善、MCP 是否过量 |

## Misskey 专项检查

通过实际命令收集评分依据。前 3 项属于安全约束，第 4 项属于工具覆盖，第 5 项属于质量检查：

```bash
# 1. [Security Guardrails] SPDX 范围、CI 判断和 HTML 注释格式
node scripts/check-spdx.mjs
# → 退出码为 0（SPDX: OK）时满分，无需额外人工判断

# 2. [Security Guardrails] 产品文案仅改 zh-CN.yml；ja-JP.yml 仅用于上游同步
node scripts/check-locales.mjs
# → 检查通过时满分

# 3. [Security Guardrails] 迁移待执行 DDL 检查（TypeORM 架构构建器）
pnpm --filter backend check-migrations
# → 0 个错误（All migrations are clean.）时满分

# 4. [Tool Coverage] endpoint-list.ts 注册遗漏（新端点不在列表中）
#    endpoints/ 递归目录包含 400 多个文件，如 notes/create.ts、admin/announcements/create.ts。
#    endpoint-list.ts 使用 export * as 形式注册端点。
#    每个文件对应一行，比较递归 TypeScript 文件数与 export * as 行数。
#    排除非端点的 *.test.ts 测试文件。
endpoint_files=$(find apps/misskey/packages/backend/src/server/api/endpoints -type f -name '*.ts' ! -name '*.test.ts' | wc -l)
list_entries=$(grep -cE "^export \* as " apps/misskey/packages/backend/src/server/api/endpoint-list.ts)
echo "endpoints (recursive): $endpoint_files / endpoint-list.ts entries: $list_entries"
# 数量相同则满分；有差异时定位遗漏：
comm -23 \
  <(find apps/misskey/packages/backend/src/server/api/endpoints -type f -name '*.ts' ! -name '*.test.ts' \
    | sed -E 's|.*/endpoints/||;s|\.ts$||' | sort -u) \
  <(grep -oE "^export \* as '[^']+'" apps/misskey/packages/backend/src/server/api/endpoint-list.ts \
    | sed -E "s/^export \* as '([^']+)'/\1/" | sort -u)
# 输出为未注册端点，无输出时满分。

# 5. [Quality Gates] 混入 console.log
grep -rn 'console\.\(log\|debug\)' apps/misskey/packages/backend/src apps/misskey/packages/frontend/src 2>/dev/null \
  | grep -v 'node_modules\|test\|.spec\.\|.test\.' | wc -l
# → 理想值为 0
```

## 输出要求

1. overall_score 和 max_score，repo 总分 70。
2. 每类得分及具体依据。
3. 失败项与文件路径。
4. 三项优先改进措施。
5. 建议下一步使用的技能或流程。

## 输出示例

```text
协作配置审计（repo）：52/70

工具覆盖：9/10（5 个技能、2 个代理、5 个命令，分布合理）
上下文效率：8/10（描述平均 3–5 行，无明显膨胀）
质量检查：7/10（有改动文件 lint 与 quality-gate，全范围检查可选）
知识持久化：5/10（项目未采用 memory，使用默认值）
验证覆盖：7/10（前后端测试文档齐全，部分 Storybook 缺失）
安全约束：8/10（1 处 SPDX 缺失，语言文件与迁移通过）
成本效率：8/10（已引入 context-budget，无项目 MCP）

失败项：
- 指定 Vue 文件缺少 SPDX 头。
- 后端有 3 处 console.log。

优先改进：
1. 修复缺少 SPDX 的文件。
2. 将后端调试输出改为 logger。
3. 对照实际用途清理 enabledPlugins 中未使用的插件。

下一步：
- 使用 quality-gate 运行 lint 与单元测试。
- 使用 context-budget 检查插件开销。
```

## 评分可靠性

- 相同提交、相同配置应得到相同评分。
- 描述冗余等启发式项目使用一致标准。
- 无需专用审计脚本，使用仓库 pnpm、git 命令和 SPDX 检查器。

## 与 ECC 原版的区别

原版依赖 ECC 仓库的 scripts/harness-audit.js。
本版加入 Misskey 专用规范，通过仓库原生命令取得依据，不依赖 ECC 运行时。
