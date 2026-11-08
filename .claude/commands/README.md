# `.claude/commands/` — 项目专用斜杠命令

将 Misskey 开发中反复使用的工作流按 `.claude/commands/<name>.md` 的格式存放，通过 `/command-name` 调用。

本文件不维护已实现命令的列表，以免过时。各 `<name>.md` 的文件头（`description`）负责说明命令用途。

当前保留的命令均来自 ECC（[everything-claude-code](https://github.com/affaan-m/everything-claude-code)），采用 MIT 许可证。Misskey 专用斜杠命令已整合到 `.claude/skills/` 下的技能中。MIT 来源见 [.claude/THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md)。

## 设计原则

- Misskey 专用工作流原则上整合进 `.claude/skills/`，通过描述自动建立索引；斜杠命令需要用户输入 `/name` 才会启动。
- 现有 `superpowers`、`pr-review-toolkit` 等插件提供的斜杠命令已能满足需求时，不新增命令。

## 添加新命令（仅限技能无法表达的情况）

- 文件头至少包含 `description`。接受参数时提供 `argument-hint`，并尽量指定 `allowed-tools`，减少权限提示。
- 涉及超过 2 分钟的构建时，不使用内联 `!\`<cmd>\``，应在正文中指定调用 Bash 工具时的 `timeout`。
- 主要参考文件的链接使用相对于当前命令 Markdown 文件的路径，避免依赖开发者个人主目录的绝对路径。
