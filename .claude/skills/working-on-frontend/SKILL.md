---
name: working-on-frontend
description: 编辑或添加 apps/misskey/packages/frontend/ 下的代码，或修改 apps/misskey/locales/zh-CN.yml 中面向前端的界面文案时必须使用。涵盖 Vue 3 组件、国际化、SCSS Modules、Storybook、无障碍及独立授权美术的运行时加载。本仓库语言规则以 AGENTS.md 为准；使用过其他技能后进入前端实现阶段仍须阅读。
---

# working-on-frontend

编辑 `apps/misskey/packages/frontend/`（Misskey Web 客户端）时，首先阅读本技能。这里汇集 Vue 3 单文件组件、SCSS Modules、国际化、`os.*`、Storybook 和无障碍的**操作步骤**与**背景知识**。

SKILL.md 本身仅作为参考文件索引。具体步骤和规范应按需读取对应文件。

**使用过其他技能也不能免除本要求。** 即使已调用 `brainstorming`、`writing-plans` 或其他上游技能，进入涉及 `apps/misskey/packages/frontend/` 的实现阶段时，仍须调用本技能。

## 按任务组织的工作流（tasks）

每份文件包含完整任务清单。

- 添加或修改 `Mk*` Vue 组件 → [references/tasks/adding-mk-component.md](references/tasks/adding-mk-component.md)
- 添加或修改国际化键（编辑 `apps/misskey/locales/zh-CN.yml`）→ [references/tasks/adding-i18n-key.md](references/tasks/adding-i18n-key.md)

## 通用知识（knowledge）

营地独立授权美术的目录、运行时 URL、缺图回退、团队同步和 worktree 用法见 [ASSETS.md](../../../ASSETS.md)。涉及图片、字体或音频时先按该约定定位素材，阅读素材库的 `RIGHTS.md`。团队环境首次用 `pnpm assets:pull` 取得私有素材，之后按需同步；遇到本地修改或开发分支保留现场。`pnpm dev` 离线复用链接，无素材库权限时可用 `assets:link` 创建空目录。私有素材通过 `/client-assets/camp/` 加载，保留无素材环境下的默认资源或回退，避免进入前端构建产物。

编辑单文件组件时需要遵守的通用规范，新建和修改组件均适用。

- `<script setup>`、纯类型 `defineProps`、`defineEmits`、泛型组件、v-model 联动等组件规范 → [references/knowledge/component-conventions.md](references/knowledge/component-conventions.md)
- `i18n.ts.<key>` 与 `i18n.tsx.<key>(...)` 的选择、嵌入 HTML 标签、动态键及重命名已有键 → [references/knowledge/i18n-usage.md](references/knowledge/i18n-usage.md)
- SCSS Modules、`--MI_THEME-*` 与 `--MI-*` CSS 变量、全局工具类（如 `_button`）→ [references/knowledge/scss-modules.md](references/knowledge/scss-modules.md)
- `os.alert`、`os.confirm`、`os.popup` 等界面辅助函数（禁止直接调用浏览器原生 `alert()`）→ [references/knowledge/os-api.md](references/knowledge/os-api.md)
- 配套 `*.stories.impl.ts` 规则，以及多示例、argTypes、layout 和 action 模式 → [references/knowledge/storybook.md](references/knowledge/storybook.md)
- 前端 Vitest、Playwright 端到端测试的编写方法和前置条件 → [references/knowledge/frontend-testing.md](references/knowledge/frontend-testing.md)

## 必须完成的最终检查

提交前端修改或创建 PR 前，必须遵循 [shipping-misskey-change](../shipping-misskey-change/SKILL.md) 的最终检查清单。

添加或修改 `.vue` 文件后，可在此阶段通过 Task 启动 [vue-component-reviewer](../../agents/vue-component-reviewer.md) 代理。它从审查角度检查本技能的规范，帮助发现命名、国际化、SCSS 变量、无障碍及配套 Storybook 示例的问题。
