# 添加或修改 Mk* Vue 组件

用于在 packages/frontend/src/components 下新增共享 Vue 3 单文件组件，或大幅修改已有组件。
对应审查代理为 [vue-component-reviewer](../../../../agents/vue-component-reviewer.md)。

## 强制前提（Critical）

1. **SPDX 头**：Vue 文件使用 HTML 注释，.stories.impl.ts 使用 TypeScript 注释；缺失会导致 spdx CI 失败。
2. **Mk 前缀**：共享组件包括子目录均需 Mk 前缀。页面专用组件放在 pages，无需前缀。
3. **仅编辑 locales/ja-JP.yml**：其他语言由 Crowdin 分发，手动修改会被覆盖，见 [添加国际化键](adding-i18n-key.md)。
4. **不硬编码界面字符串**：模板与 JavaScript 均通过 i18n.ts 或 i18n.tsx，见 [国际化用法](../knowledge/i18n-usage.md)。
5. **不直接调用浏览器对话框**：使用 os.alert、os.confirm、os.popup，见 [os API](../knowledge/os-api.md)。

## 文件位置

| 路径 | 用途 | 命名 |
|---|---|---|
| packages/frontend/src/components/Mk<Name>.vue | 普通共享组件 | Mk<Name>.vue |
| packages/frontend/src/components/global/Mk<Name>.vue | 由 components/index.ts 通过 app.component 全局注册，无需导入即可使用，如 MkA、MkAvatar、MkAcct | 子目录中仍需 Mk 前缀 |
| packages/frontend/src/components/grid/Mk<Name>.vue | 表格、网格组件 | 同上 |
| packages/frontend/src/pages/<Name>.vue | 单个页面专用、不复用的界面 | 无需 Mk 前缀 |

判断依据是是否可能被其他 Mk 组件导入：会复用则放 components，否则放 pages。
通常还需同目录添加 .stories.impl.ts，见 [Storybook](../knowledge/storybook.md)。

## SPDX 头

### Vue 文件：HTML 注释

```html
<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
```

不使用 TypeScript/JavaScript 的块注释，保持与已有单文件组件一致。

### Storybook 文件：TypeScript 注释

```ts
/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
```

## 最小模板

以下为合成示例，并非某个实际文件的副本。简单真实组件可参考 [MkInfo.vue](../../../../../packages/frontend/src/components/MkInfo.vue)。

```vue
<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, $style[`variant_${variant}`]]">
	<slot></slot>
	<button
		v-if="closable"
		class="_button"
		:class="$style.close"
		:aria-label="i18n.ts.close"
		@click="emit('close')"
	>
		<i class="ti ti-x"></i>
	</button>
</div>
</template>

<script lang="ts" setup>
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	variant?: 'info' | 'warn' | 'danger';
	closable?: boolean;
}>(), {
	variant: 'info',
});

const emit = defineEmits<{
	(ev: 'close'): void;
}>();
</script>

<style lang="scss" module>
.root {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 12px 14px;
	border-radius: var(--MI-radius);
}

.variant_info {
	background: var(--MI_THEME-infoBg);
	color: var(--MI_THEME-infoFg);
}

.variant_warn {
	background: var(--MI_THEME-infoWarnBg);
	color: var(--MI_THEME-infoWarnFg);
}

.variant_danger {
	background: var(--MI_THEME-error);
	color: var(--MI_THEME-fgOnAccent);
}

.close {
	margin-left: auto;
}
</style>
```

泛型、双 script、v-model、具名插槽等见 [组件规范](../knowledge/component-conventions.md)。

## script 与 style 规范

| 项目 | 规范 | 新代码禁止 |
|---|---|---|
| script | lang="ts" 与 setup，顺序不限 | 无 lang 或选项式 API |
| Props | 纯类型 defineProps | 运行时对象 |
| Emits | 纯类型 defineEmits | 运行时数组 |
| style | lang="scss" module，通过 $style 引用 | 只有 scoped、无 module |
| CSS 值 | --MI_THEME-*、--MI-* | 硬编码颜色 |
| 全局类 | 复用 _button、_panel、_selectable | — |
| 图标 | Tabler Icons 类 | 内联 SVG 或其他图标集 |

详情见 [组件规范](../knowledge/component-conventions.md)和 [SCSS Modules](../knowledge/scss-modules.md)。

## 国际化

无参数使用 i18n.ts，有参数使用 i18n.tsx。见 [用法](../knowledge/i18n-usage.md)；新增键见[操作步骤](adding-i18n-key.md)。

## os 辅助函数

使用 os.alert、os.confirm、os.popup、os.toast、os.popupMenu 等，见 [os API](../knowledge/os-api.md)。

## 无障碍最低要求

1. 可点击元素优先使用 `<button class="_button">`。必须使用 div 时，同时提供 role="button"、tabindex="0"、Enter 和 Space 键盘处理。
2. input、select、textarea 关联 label 或 aria-label。
3. disabled 与 aria-disabled 一致，处理函数内也提前返回。
4. 验证仅用键盘可完成操作，包括 Tab 移动焦点、Enter 确认。
5. 仅使用必要的 ARIA 属性。

完整清单及 MkButton、MkSwitch 示例见 [组件规范](../knowledge/component-conventions.md)。

## 配套 Storybook

共享 Mk 组件必须在同目录配套 Mk<Name>.stories.impl.ts，子目录也适用，见 [Storybook](../knowledge/storybook.md)。

## 验证流程

```bash
# 类型检查（vue-tsc）
pnpm --filter frontend typecheck

# ESLint（全部规范）
pnpm --filter frontend eslint

# 对单个文件运行 ESLint --fix
pnpm exec eslint --fix packages/frontend/src/components/Mk<Name>.vue

# 通过 Storybook 检查外观
pnpm --filter frontend storybook-dev    # localhost:6006

# Vitest 单元测试（存在组件测试时）
pnpm --filter frontend test
```

## 与已有组件保持一致

- 阅读一两个类似组件，沿用 primary、danger、small 等属性命名，以及 emit('close') 等事件模式。
- 复用 _button、_panel、_selectable、_gaps_m，减少自定义样式，见 [SCSS Modules](../knowledge/scss-modules.md)。
- 较大功能在 Storybook 覆盖 variant、size、disabled、loading。

## 参考代码

- [MkInfo.vue](../../../../../packages/frontend/src/components/MkInfo.vue)：简单组件。
- [MkButton.vue](../../../../../packages/frontend/src/components/MkButton.vue)：通用按钮与无障碍。
- [MkInput.vue](../../../../../packages/frontend/src/components/MkInput.vue)：泛型与双 script。
- [MkSelect.vue](../../../../../packages/frontend/src/components/MkSelect.vue)：defineModel 与具名插槽。
- [MkSwitch.vue](../../../../../packages/frontend/src/components/MkSwitch.vue)：自定义无障碍控件。
- [MkButton.stories.impl.ts](../../../../../packages/frontend/src/components/MkButton.stories.impl.ts)：多个 Storybook 示例。
- [os.ts](../../../../../packages/frontend/src/os.ts)：界面 API。
- [i18n.ts](../../../../../packages/frontend/src/i18n.ts)：国际化实现。
