---
name: creating-issues-and-prs
description: 用户要求为旅人营地创建 Issue 或 PR 时使用，遵循团队维护范围、模板、发布授权及私密安全报告规则。
---

# 团队 Issue 与 Pull Request

本仓库由旅人营地团队维护，不征集外部贡献。Issue 和 PR 用于记录任务与审查改动，开发约定见 [DEVELOPMENT.md](../../../DEVELOPMENT.md)。

## 授权与范围

用户明确要求创建后，完成必要的实现和验证，按授权创建。已有明确需求时无需另建 Issue，也无需反复请求同一授权。用户未要求时不创建、不评论、不合并或关闭。

目标仓库为 `HePudding/trekker-camp`，PR 默认合入 `master`。先查看现有记录，避免重复。安全问题按 [SECURITY.md](../../../SECURITY.md) 私下处理，不通过公开 Issue、PR 或评论披露；AI 不自行提交安全报告。

## Issue

使用 [.github/ISSUE_TEMPLATE](../../../.github/ISSUE_TEMPLATE) 中适用的模板。记录具体问题、使用场景和验收条件，必要时补充已脱敏的复现资料。团队其他事项可使用空白 Issue，保持简洁。

## Pull Request

- 先完成 [shipping-misskey-change](../shipping-misskey-change/SKILL.md) 中适用的检查。
- 使用 [.github/pull_request_template.md](../../../.github/pull_request_template.md)，发布准备可使用对应发布模板。
- 说明具体问题、最终行为及实际验证结果；关联已有任务即可。
- 保持改动范围集中，不混入未获授权的其他工作。
- 用户未要求时不编辑 CHANGELOG；有用户可感知变化时在交接中提供候选条目。
- 创建 PR、合并和生产部署分别遵循用户授权。
