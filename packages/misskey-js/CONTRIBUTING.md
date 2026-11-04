# 贡献指南

**[✨ 原英文版的中文译文](docs/CONTRIBUTING.en.md)**

感谢关注本项目！本文汇集参与贡献所需的信息。

## 实现之前

添加功能或修复缺陷前，请先在 Issue 等渠道提交设计和方案供审查；没有对应 Issue 时请创建。省略此步骤可能导致实现完成后 PR 无法合并。

开始实现时，将对应 Issue 指派给自己；若无权限，请其他成员协助。明确认领有助于避免重复工作。

## Issue

创建前请检查：

- 搜索是否已有相同内容，避免重复。
- Issue 仅用于需求、建议和问题报告。
- 提问请使用 [GitHub Discussions](https://github.com/misskey-dev/misskey/discussions) 或 [Discord](https://discord.gg/Wp8gVStHW3)。

<a id="PRの作成"></a>

## 创建 PR

创建前请检查：

- 尽可能在标题中添加类型前缀，如 fix、refactor、feat、enhance、perf、chore。
- 保持合适粒度，避免一个 PR 混合多类修改或关注点。
- 若解决已有 Issue，在正文中引用。
- 在 [`CHANGELOG.md`](/CHANGELOG.md) 追加修改概述；重构等不影响用户的修改可省略。
- 检查是否需要新增或更新文档。
- 新增功能或修复缺陷时，尽可能添加测试。
- 提前确认测试与 lint 通过，可运行 `npm run test` 和 `npm run lint`。
- 运行 `npm run api` 更新 API 报告，有差异时一并提交。详情见 [API Extractor](#api-extractor)。

感谢配合 🤗

## 工具

### eslint

项目使用 [eslint](https://eslint.org/) 检查和整理代码格式。CI 会自动检查，不符合规则的代码会导致失败。

### Jest

项目使用 [Jest](https://jestjs.io/) 测试框架，测试位于 [`/test` 目录](/test)。

CI 对每个提交和 PR 自动运行测试。本地执行 `npm run test`。

### tsd

项目使用 [tsd](https://github.com/SamVerschueren/tsd) 验证类型是否符合预期，补充 Jest 的运行时测试。类型测试位于 [`/test-d` 目录](/test-d)。

CI 对每个提交和 PR 自动执行。本地运行 `npm run test`。

### API Extractor

项目使用 [API Extractor](https://api-extractor.com/) 生成 API 报告。报告相当于 API 快照，包含库对外导出的函数和类型定义。运行 `npm run api` 会在 [`/etc` 目录](/etc) 生成当前报告。

公开 API 变化时，报告随之变化。比较 develop 分支和 PR 分支的报告，可以发现意外的破坏性修改并评估影响。每次提交和 PR 的 CI 也会重新生成报告，与已有报告比较；有差异则检查失败。

创建 PR 时，请运行 `npm run api` 并提交报告差异。这样既能表明变更是有意的，也便于审查影响范围。

### Codecov

项目使用 [Codecov](https://about.codecov.io/) 统计测试覆盖率，即测试覆盖代码的程度。

CI 自动完成统计，无需额外操作。结果见[覆盖率页面](https://codecov.io/gh/misskey-dev/misskey.js)。

各 PR 分支也会自动统计，由 Codecov 机器人评论包含目标分支差异的报告，便于了解合并后覆盖率的增减。

## 提交者须知

请阅读[创建 PR](#创建-pr)，并参考下文审查角度。

## 审查者须知

- 除了需要修改的地方，也请积极评论优点，这有助于提高贡献者的参与动力。

## 审查角度

- **安全**：合并是否引入漏洞？
- **性能**：是否造成意外性能下降？是否有更高效的方式？
- **测试**：是否覆盖预期行为？是否有遗漏？是否检查异常情况？
