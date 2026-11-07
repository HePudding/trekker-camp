# 贡献指南

:v: 感谢贡献 :v:

**ℹ️ 重要：**上游项目主要使用日语，**但你无需将 Issue 或 PR 翻译成日语。**
即使收到日语评论，也无需用日语回复。\
机器翻译成日语的准确度有限，使用原语言更便于理解，也方便读者选择自己偏好的翻译工具。

## Issue

创建前请检查：

- 搜索相似问题，避免重复创建。
- Issue 仅用于功能请求、建议和问题报告。
- 提问请使用 [GitHub Discussions](https://github.com/misskey-dev/misskey/discussions) 或 [Discord](https://discord.gg/Wp8gVStHW3)。

## 创建 PR

感谢提交 PR！创建前请检查：

- 尽可能在标题中使用类型前缀，例如 fix、refactor、feat、enhance、perf、chore。
- 保持合适粒度，避免一个 PR 混合多类修改或关注点。
- 若解决已有 Issue，在正文中引用。
- 在 [`CHANGELOG.md`](/CHANGELOG.md) 添加修改概述；重构等不影响用户的改动可省略。
- 检查是否需要新增或更新文档。
- 新增功能或修复缺陷时，尽可能添加测试。
- 提前确认测试和 lint 通过，可运行 `npm run test` 和 `npm run lint`。
- 运行 `npm run api` 更新 API 报告，有差异时一并提交。

感谢配合 🤗
