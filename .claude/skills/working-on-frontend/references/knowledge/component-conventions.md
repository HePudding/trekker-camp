# Vue 单文件组件规范、模板与无障碍清单

用于新增或编辑 Misskey Vue 3 组件。

## 目录

- [基本风格](#基本风格)
- [script 与 style 规范](#script-与-style-规范)
- [模板](#模板)
- [无障碍清单](#无障碍清单)

## 基本风格

使用组合式 API 与 `<script setup lang="ts">`，不新增选项式 API。
需要模块作用域类型、常量或工具函数时，可以额外使用普通 TypeScript script 块，例如 [MkInput.vue](../../../../../apps/misskey/packages/frontend/src/components/MkInput.vue) 的 SupportedTypes。
样式使用 SCSS CSS Modules。

```vue
<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <div :class="$style.root">
    <!-- ... -->
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
// ...
</script>

<style lang="scss" module>
.root {
  /* ... */
}
</style>
```

## script 与 style 规范

| 项目 | 规范 | 新代码禁止 |
|---|---|---|
| script | lang="ts" 与 setup，顺序不限 | 无 lang、选项式 API |
| Props | 纯类型 defineProps | 运行时对象 |
| Emits | 纯类型 defineEmits | 运行时数组 |
| 泛型 | generic 属性；复杂导出类型可用双 script | — |
| style | lang="scss" module，通过 $style 引用 | 只有 scoped |
| CSS | 主题 --MI_THEME-*、通用 --MI-* | 硬编码颜色 |
| 全局类 | 复用 _button、_panel、_selectable、_buttonPrimary | — |
| 图标 | Tabler Icons 类 | 内联 SVG 或其他图标集 |

样式详情见 [scss-modules.md](scss-modules.md)。

## 模板

### 插槽与简单属性

以下是合成示例，真实简单组件参考 [MkInfo.vue](../../../../../apps/misskey/packages/frontend/src/components/MkInfo.vue)。

```vue
<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { [$style.warn]: variant === 'warn' }]" class="_selectable">
	<i v-if="variant === 'warn'" class="ti ti-alert-triangle" :class="$style.icon"></i>
	<i v-else class="ti ti-info-circle" :class="$style.icon"></i>
	<div><slot></slot></div>
</div>
</template>

<script lang="ts" setup>
const props = withDefaults(defineProps<{
	variant?: 'info' | 'warn';
}>(), {
	variant: 'info',
});
</script>

<style lang="scss" module>
.root {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 12px 14px;
	font-size: 90%;
	background: var(--MI_THEME-infoBg);
	color: var(--MI_THEME-infoFg);
	border-radius: var(--MI-radius);

	&.warn {
		background: var(--MI_THEME-infoWarnBg);
		color: var(--MI_THEME-infoWarnFg);
	}
}

.icon {
	margin-right: 4px;
}
</style>
```

- withDefaults 保持纯类型 Props 的同时设置默认值。
- _selectable 允许选择正文，见 [样式规范](scss-modules.md)。
- 使用 Tabler Icons 类，通过 v-if 切换变体图标是常用模式。

### 泛型与双 script

参考 [MkInput.vue](../../../../../apps/misskey/packages/frontend/src/components/MkInput.vue)。
类型计算或导出类型放入普通 script，实例逻辑放入 setup：

```vue
<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<button
		v-for="item in items"
		:key="String(item.value)"
		class="_button"
		:class="[$style.item, { [$style.active]: item.value === modelValue }]"
		@click="select(item.value)"
	>
		{{ item.label }}
	</button>
</div>
</template>

<script lang="ts">
// 模块作用域：仅放类型、常量、纯函数，可在 setup 中访问。
export type ChoiceItem<T> = {
	value: T;
	label: string;
};
</script>

<script lang="ts" setup generic="T extends string | number">
const props = defineProps<{
	modelValue: T;
	items: ChoiceItem<T>[];
}>();

const emit = defineEmits<{
	(ev: 'update:modelValue', value: T): void;
}>();

function select(value: T) {
	emit('update:modelValue', value);
}
</script>
```

- generic 约束 v-model 为 string 或 number。
- setup 中无法 export type，因此需要独立块。
- MkSelect 等导出复杂类型的组件常用此方式。

### defineModel 与 v-model

参考 [MkSelect.vue](../../../../../apps/misskey/packages/frontend/src/components/MkSelect.vue)、[MkRadios.vue](../../../../../apps/misskey/packages/frontend/src/components/MkRadios.vue)。
defineModel 可替代手动声明 modelValue 和 update:modelValue：

```vue
<template>
<label :class="[$style.root, { [$style.disabled]: disabled }]">
	<input
		v-model="checked"
		type="checkbox"
		:class="$style.input"
		:disabled="disabled"
	>
	<span :class="$style.label"><slot></slot></span>
</label>
</template>

<script lang="ts" setup>
const checked = defineModel<boolean>({ required: true });

const props = defineProps<{
	disabled?: boolean;
}>();
</script>
```

- 自动创建对应属性和事件，返回 Ref，修改 value 时触发更新。
- defineModel('foo') 对应 v-model:foo。
- 新文件原则上使用 defineModel；手写模式主要保留在旧代码中。

### 事件与具名插槽

以下合成示例将点击处理交给调用方，适用于确认界面等。
[MkButton.vue](../../../../../apps/misskey/packages/frontend/src/components/MkButton.vue) 本身仅发出携带 PointerEvent 的 click 事件，结构与此示例不同。

```vue
<template>
<div :class="$style.root" class="_panel">
	<div :class="$style.header">
		<slot name="header">{{ i18n.ts.confirm }}</slot>
	</div>
	<div :class="$style.body">
		<slot></slot>
	</div>
	<div :class="$style.footer">
		<button class="_button" :class="$style.cancel" @click="emit('cancel')">
			{{ i18n.ts.cancel }}
		</button>
		<button class="_button _buttonPrimary" :class="$style.ok" @click="emit('ok')">
			{{ i18n.ts.ok }}
		</button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { i18n } from '@/i18n.js';

const emit = defineEmits<{
	(ev: 'ok'): void;
	(ev: 'cancel'): void;
}>();
</script>
```

- 具名与默认插槽可同时使用。
- _panel、_button、_buttonPrimary 是全局类，无需重复实现样式。
- 组件仅发出 ok 等事件，实际 os.confirm 由调用方控制，便于测试与替换。

## 无障碍清单

新增和修改组件均需遵守。

### 可点击元素

优先使用原生按钮：

```vue
<button class="_button" :class="$style.action" :disabled="disabled" @click="onClick">
	{{ i18n.ts.save }}
</button>
```

- _button 重置背景、边框和光标，不提供额外焦点环或波纹；波纹按钮使用 MkButton。
- 原生 button 提供键盘、禁用和浏览器焦点行为，通常无需重复添加 ARIA。
- 表单中不希望提交时显式设置 type="button"。

必须使用 div 时，提供 role、tabindex、Enter、Space 支持，并传递禁用状态：

```vue
<div
	role="button"
	tabindex="0"
	:aria-disabled="disabled"
	:class="$style.fakeButton"
	@click="onClick"
	@keydown.enter="onClick"
	@keydown.space.prevent="onClick"
>
	<slot></slot>
</div>
```

| 属性或事件 | 用途 |
|---|---|
| role="button" | 屏幕阅读器识别为按钮 |
| tabindex="0" | 键盘可聚焦 |
| keydown.enter | Enter 激活 |
| keydown.space.prevent | Space 激活并阻止滚动 |
| aria-disabled | 向辅助技术传递禁用状态 |

最常见遗漏是只处理 click，未支持 Enter。

原则上不把不跳转的 a 当作按钮。导航使用 [MkA.vue](../../../../../apps/misskey/packages/frontend/src/components/global/MkA.vue)，操作使用 button，避免无障碍和 SEO 问题。

### 表单标签

通过 for/id 关联或包裹：

```vue
<!-- ✅ 通过 for / id 关联 -->
<label :for="id">{{ i18n.ts.username }}</label>
<input :id="id" v-model="username" type="text">

<!-- ✅ 包裹输入框（无需 id） -->
<label>
	{{ i18n.ts.username }}
	<input v-model="username" type="text">
</label>
```

[MkInput.vue](../../../../../apps/misskey/packages/frontend/src/components/MkInput.vue)、[MkSwitch.vue](../../../../../apps/misskey/packages/frontend/src/components/MkSwitch.vue) 等通过插槽接受标签，可自然满足要求。

不显示标签的图标按钮使用 aria-label：

```vue
<button class="_button" :aria-label="i18n.ts.close" @click="emit('close')">
	<i class="ti ti-x"></i>
</button>
```

aria-label 也必须国际化。当前仓库使用较少；title 主要提供悬停提示，不足以替代屏幕阅读器标签。新图标按钮应按无障碍最佳实践添加 aria-label。

### 禁用状态

原生 button 的 disabled 会阻止点击，div role="button" 则需在处理函数中主动返回：

```ts
function onClick() {
	if (props.disabled) return; // ← 缺少此判断时，禁用状态仍会触发
	// ...
}
```

### 键盘操作

- Tab 能到达全部可操作元素，不随意使用 tabindex="-1"。
- 弹窗需要焦点限制，[MkModal.vue](../../../../../apps/misskey/packages/frontend/src/components/MkModal.vue) 已内置处理。
- 列表考虑方向键。Space/Enter 打开菜单可参考 MkSelect 的 @keydown.space.enter。

### 参考组件

| 模式 | 组件 |
|---|---|
| 标准按钮 | [MkButton.vue](../../../../../apps/misskey/packages/frontend/src/components/MkButton.vue) |
| 自定义无障碍控件 | [MkSwitch.vue](../../../../../apps/misskey/packages/frontend/src/components/MkSwitch.vue) |
| 输入框与标签插槽 | [MkInput.vue](../../../../../apps/misskey/packages/frontend/src/components/MkInput.vue) |
| 支持键盘的选择控件 | [MkSelect.vue](../../../../../apps/misskey/packages/frontend/src/components/MkSelect.vue) |

### 常见问题

- div click 缺少 role、tabindex 或键盘事件。
- 图标按钮缺少 aria-label，Tabler 图标自身不提供语义。
- 只改变禁用样式，未设置 aria-disabled 或阻止事件。
- 使用 outline:none 去掉焦点环后未提供替代。
