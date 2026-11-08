# 按明确要求更新 CHANGELOG.md 的 Unreleased 部分

仅在用户明确要求编辑 CHANGELOG 时阅读本格式参考。
普通实现和修复不编辑此文件。

## 章节结构

`## Unreleased` 下包含**三个子章节**：

- `### General` — 通用或跨模块修改
- `### Client` — `apps/misskey/packages/frontend` 相关
- `### Server` — `apps/misskey/packages/backend` 相关

## 条目格式

在对应子章节中按 `- <Prefix>: <概述>` 添加条目。前缀首字母大写。

```text
- Enhance: 改善帖子详情中的可见范围显示
- Fix: 修复通知延迟约 10 秒的问题
- Feat: 添加新功能
```

| 前缀 | 用途 |
|---|---|
| `Feat:` | 添加新功能 |
| `Enhance:` | 改善已有功能 |
| `Fix:` | 修复缺陷 |
| `Note:` | 需要告知用户的事项，如设置重置、新增配置项或不兼容的行为变更 |

`Note:` 用于说明更新后用户应了解的事项，例如 `- Note: 更新后声音设置将被重置`。将其作为对应子章节中的条目。有些历史版本会在 `## <version>` 下单独设置 `### Note` 子章节，两种格式都存在。新增时遵循附近已有条目的格式。

## 禁止修改的范围

- 不修改 `## Unreleased` 之外的历史发布章节。
- 保留 `## Unreleased` 标题和三个空子章节的骨架；发布脚本依赖此结构。

## 手动编写步骤

1. 打开 `CHANGELOG.md`，找到 `## Unreleased`。
2. 检查目标子章节（`### General`、`### Client` 或 `### Server`）：
   - **空章节，仅有占位符**：标题下只有单独的 `-` 行，用完整条目替换。
   - **已有条目**：在现有条目末尾追加。
3. 不调整原有顺序，方便审查差异。
4. 用 `git diff CHANGELOG.md` 检查仅增加了一条记录。

## 示例

| 输入意图 | 结果 |
|---|---|
| server，`Fix: 修复通知延迟的问题` | 在 `### Server` 末尾追加 `- Fix: 修复通知延迟的问题` |
| client，`Enhance: 改善帖子显示` | 在 `### Client` 末尾追加 `- Enhance: 改善帖子显示` |
| general，`Feat: 添加新功能` | 将 `### General` 中的占位符 `-` 替换为 `- Feat: 添加新功能` |

## 与提交消息格式的区别

CHANGELOG 和提交消息各有格式：

- CHANGELOG：`- Enhance: 改善帖子显示`，使用首字母大写的英文前缀、冒号和说明正文。上游正文使用日语。
- 提交消息：`enhance(frontend): improve note display`，使用小写前缀、范围、冒号和英文正文。详情见 [DEVELOPMENT.md](../../../../../DEVELOPMENT.md)。

在同一个 PR 中更新两者时，应分别遵循对应格式。
