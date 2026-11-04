---
description: 按顺序运行 Misskey lint、类型检查和快速测试的可选全范围质量验证。
argument-hint: "[repo|backend|frontend|<path/to/file.ts>]"
---

<!--
SPDX-License-Identifier: MIT
SPDX-FileCopyrightText: 2026 Affaan Mustafa and everything-claude-code contributors

上游来源：https://github.com/affaan-m/everything-claude-code (v2.0.0-rc.1)
上游路径：commands/quality-gate.md
上游许可证：MIT — https://github.com/affaan-m/everything-claude-code/blob/main/LICENSE
项目声明：.claude/THIRD_PARTY_LICENSES.md，包含第三方列表与 MIT 全文。

于 2026-05-10 引入 Misskey .claude/。lint、类型检查、测试的流水线概念来自 ECC（MIT），具体实现固定使用 Misskey 的 pnpm、tsc、ESLint、Vitest，移除了 Prettier/Biome 格式化阶段及通用语言检测。
较重的 test:e2e 和 test:fed 按改动或用户明确要求单独执行。
-->

# /quality-gate — Misskey 全范围质量验证

`/quality-gate [scope]`

需要了解整个包或仓库状态时可选使用。
交付必需的改动文件 lint 由 [shipping-misskey-change](../skills/shipping-misskey-change/SKILL.md) 负责。

## 范围

- repo（默认）：全部工作区 lint，以及前后端单元测试。
- backend：仅后端。
- frontend：仅前端。
- path/to/file.ts：仅对指定文件运行 ESLint --quiet。

## 流程

### 全仓库

[后端](../../packages/backend/package.json)与[前端](../../packages/frontend/package.json)的 lint 内部执行 typecheck && eslint。
根目录 pnpm lint 使用 `pnpm --no-bail -r lint && pnpm check-dts`，前半段失败时会跳过 check-dts。
因此将以下四条命令作为独立调用，收集全部结果：

```bash
pnpm --no-bail -r lint
pnpm check-dts
pnpm --filter backend test
pnpm --filter frontend test
```

仅在需要单独查看类型检查结果时执行：

```bash
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
```

通常读取 lint 输出即可，无需重复运行。

### 后端

lint 已包含类型检查，因此运行：

```bash
pnpm --filter backend lint
pnpm --filter backend test
```

仅需要独立 tsc 输出时，额外运行后端 typecheck。

### 前端

同样避免重复类型检查：

```bash
pnpm --filter frontend lint
pnpm --filter frontend test
```

仅需要独立 vue-tsc 输出时，额外运行前端 typecheck。

### 单文件

将仓库相对路径转换为包内路径，从对应包根目录运行：

```bash
(cd packages/backend && pnpm exec eslint --quiet -- src/path/to/file.ts)
(cd packages/frontend && pnpm exec eslint --quiet -- src/path/to/component.vue)
```

## 输出

保留每条命令退出码，以 PASS、FAIL、BASELINE、SKIPPED 汇总。
仅当相同失败在基线版本也复现，且已确认与本次修改无关时，使用 BASELINE。

```text
质量检查（repo）：
Lint：PASS
后端单元测试：BASELINE（基线版本存在相同失败）
前端单元测试：PASS
其他测试：SKIPPED（不在 repo 范围内）
```

某项失败后继续其他独立检查。BASELINE 不记为 PASS；未运行项注明 SKIPPED 和原因。

## 相关内容

- [交付检查技能](../skills/shipping-misskey-change/SKILL.md)
- [重新生成 misskey-js](../skills/shipping-misskey-change/references/tasks/regenerate-misskey-js.md)
- [Copilot 验证命令](../../.github/copilot-instructions.md)

## 与 ECC 原版的区别

- 固定为 Misskey 流程，不自动判断语言。
- 无格式化阶段，改动文件使用 ESLint --quiet。
- 不自动添加端到端、联邦或 Playwright 测试，按改动或明确要求单独执行。
