# 第三方许可证（.claude/）

本文件记录 .claude/ 中引入的第三方组件及其许可证、来源。
Misskey 主体使用 AGPL-3.0-only，本目录部分文件使用 MIT。各文件开头也标有 SPDX 标识和来源注释。

最后更新：2026-05-11

## 1. everything-claude-code（ECC）

- 上游仓库：<https://github.com/affaan-m/everything-claude-code>
- 引入版本：v2.0.0-rc.1
- 许可证：**MIT**
- 版权：Copyright (c) 2026 Affaan Mustafa

### 引入文件

| .claude/ 内路径 | 上游路径 | 来源 | Misskey 中的修改 |
|---|---|---|---|
| skills/context-budget/SKILL.md | skills/context-budget/SKILL.md | ECC | 本地化描述，补充 Misskey 专用说明 |
| commands/harness-audit.md | commands/harness-audit.md | ECC | 使用仓库命令和 SPDX 检查器评分，加入 SPDX、端点注册、迁移和语言文件等维度 |
| commands/quality-gate.md | commands/quality-gate.md | ECC | 固定使用 pnpm、tsc、ESLint、Vitest，移除语言自动检测与 Prettier/Biome 阶段 |

### MIT 许可证原文

```
MIT License

Copyright (c) 2026 Affaan Mustafa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 上游许可证文件

<https://github.com/affaan-m/everything-claude-code/blob/main/LICENSE>

## 2. 与 AGPL 代码库的兼容性

Misskey 主体按 **AGPL-3.0-only** 分发，.claude/ 中的 MIT 文件继续保留 MIT 许可证。

- MIT 为宽松许可证，允许纳入 AGPL 等 copyleft 项目并重新分发。
- 本文件及各文件头保留版权声明、许可证全文、SPDX 和来源，满足 MIT 要求。
- 整体发行物按 AGPL-3.0-only 处理，.claude/ 下的 MIT 文件仍可单独识别。

[AGENTS.md](../AGENTS.md) 对 TypeScript、JavaScript、Vue、SCSS 的 SPDX 要求适用于 Misskey 主体代码，不适用于 .claude/ 中的 Markdown 和 shell 文件。

## 3. 引入新文件

1. 检查许可证兼容性：MIT、Apache-2.0、BSD 可用；GPL、AGPL 需讨论。
2. 在文件开头添加 SPDX 和来源注释。
3. 在本文件第 1 节表格增加记录。
4. 必要时新建章节并附许可证全文。
5. 确认技能、命令等目录 README 链接到本文件。[CLAUDE.md](../CLAUDE.md) 已将整个 .claude/ 目录列为 Claude Code 辅助内容；它仅导入 AGENTS.md，无需为此单独追加 AGENTS.md。
