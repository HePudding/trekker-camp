---
name: working-on-frontend
description: 编辑或添加 packages/frontend/ 下的代码，或修改 locales/ja-JP.yml 中面向前端的界面文案时必须使用，包括 Vue 3 单文件组件（Mk* 组件）、国际化键（i18n.ts.<key> / i18n.tsx.<key>()）、SCSS Modules、主题与 CSS 变量、os.* 界面辅助函数和 Storybook 示例。涵盖 <script setup lang="ts"> 规范、纯类型 defineProps、仅编辑 ja-JP.yml 的上游语言文件规则（其他语言由 Crowdin 管理，禁止手改）及无障碍要求。修改前端或界面语言文件前必须阅读，以避免 CI 失败、翻译丢失及审查退回。即使此前已使用 brainstorming、writing-plans 或其他上游技能，实现时仍须调用。
---

# working-on-frontend

编辑 `packages/frontend/`（Misskey Web 客户端）时，首先阅读本技能。这里汇集 Vue 3 单文件组件、SCSS Modules、国际化、`os.*`、Storybook 和无障碍的**操作步骤**与**背景知识**。

SKILL.md 本身仅作为参考文件索引。具体步骤和规范应按需读取对应文件。

**使用过其他技能也不能免除本要求。** 即使已调用 `brainstorming`、`writing-plans` 或其他上游技能，进入涉及 `packages/frontend/` 的实现阶段时，仍须调用本技能。

## 按任务组织的工作流（tasks）

每份文件包含完整任务清单。

- 添加或修改 `Mk*` Vue 组件 → [references/tasks/adding-mk-component.md](references/tasks/adding-mk-component.md)
- 添加或修改国际化键（编辑 `locales/ja-JP.yml`）→ [references/tasks/adding-i18n-key.md](references/tasks/adding-i18n-key.md)

## 通用知识（knowledge）

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
