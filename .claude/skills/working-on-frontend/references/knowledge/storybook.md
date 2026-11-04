# Storybook（*.stories.impl.ts）规范

共享 Mk 组件应在**同目录**配套 `Mk<Name>.stories.impl.ts`。

## 位置与命名

- **后缀固定为 .stories.impl.ts**。`.stories.ts` 由 `packages/frontend/.storybook/generate.tsx` 生成，禁止手动编辑或提交。
- 与组件放在同一层，包括 global 等子目录。
- 开头需要 TypeScript 注释形式的 SPDX 头。

## 单个示例：Default

简单组件使用此模式即可。下方 MkColoredTag 是**虚构的示例组件**，真实实现可参考 MkButton.stories.impl.ts。

```ts
/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable import/no-default-export */
import type { StoryObj } from '@storybook/vue3';
import MkColoredTag from './MkColoredTag.vue';

export const Default = {
	render(args) {
		return {
			components: { MkColoredTag },
			setup() {
				return { args };
			},
			template: '<MkColoredTag v-bind="args">标签</MkColoredTag>',
		};
	},
	args: {
		variant: 'info',
	},
	parameters: {
		layout: 'centered',
	},
} satisfies StoryObj<typeof MkColoredTag>;
```

- 两个 eslint-disable 是 Storybook 约定，处理 render 返回类型和默认导出规则。
- `satisfies StoryObj<typeof MkColoredTag>` 用于保留 args 类型补全。

## 多个示例：不同变体

参考 [MkButton.stories.impl.ts](../../../../../packages/frontend/src/components/MkButton.stories.impl.ts)。
存在 variant、size 或状态差异时，基于 Default 展开并派生：

```ts
export const Default = {
	render(args) {
		return {
			components: { MkColoredTag },
			setup() {
				return { args };
			},
			template: '<MkColoredTag v-bind="args">标签</MkColoredTag>',
		};
	},
	args: {
		variant: 'info',
	},
	parameters: {
		layout: 'centered',
	},
} satisfies StoryObj<typeof MkColoredTag>;

export const Warn = {
	...Default,
	args: { ...Default.args, variant: 'warn' },
} satisfies StoryObj<typeof MkColoredTag>;

export const Danger = {
	...Default,
	args: { ...Default.args, variant: 'danger' },
} satisfies StoryObj<typeof MkColoredTag>;

export const Disabled = {
	...Default,
	args: { ...Default.args, disabled: true },
} satisfies StoryObj<typeof MkColoredTag>;
```

## 使用 action 展示事件

通过 `storybook/actions` 的 action，将点击等事件展示在 Actions 面板中：

```ts
import { action } from 'storybook/actions';
// ...
export const Default = {
	render(args) {
		return {
			components: { MkColoredTag },
			setup() {
				return { args };
			},
			computed: {
				props() {
					return { ...this.args };
				},
				events() {
					return {
						click: action('click'),
						close: action('close'),
					};
				},
			},
			template: '<MkColoredTag v-bind="props" v-on="events">标签</MkColoredTag>',
		};
	},
	args: {},
	parameters: { layout: 'centered' },
} satisfies StoryObj<typeof MkColoredTag>;
```

MkButton.stories.impl.ts 使用此模式。

## 使用 argTypes 调整控件

可将字符串联合类型显示为单选，将数值显示为范围控件，便于审查。这是 Storybook 标准功能，当前仓库的 .stories.impl.ts 尚未使用，不属于强制要求。

```ts
export const Default = {
	render(args) { /* ... */ },
	args: { variant: 'info' },
	argTypes: {
		variant: {
			control: 'inline-radio',
			options: ['info', 'warn', 'danger'],
		},
		disabled: {
			control: 'boolean',
		},
	},
	parameters: { layout: 'centered' },
} satisfies StoryObj<typeof MkColoredTag>;
```

## parameters.layout

| 值 | 用途 |
|---|---|
| centered | 按钮、标签、图标等小型独立组件 |
| fullscreen | 整页或完整面板 |
| padded（默认） | 需要周围留白的中型组件 |

layout 会明显影响展示效果。固定页头等依赖布局的组件应选择 fullscreen。

## 可变插槽内容

在 args 添加展示字符串，并在模板中通过 `{{ args.label }}` 使用：

```ts
export const Default = {
	render(args) {
		return {
			components: { MkColoredTag },
			setup() {
				return { args };
			},
			template: '<MkColoredTag v-bind="args">{{ args.label }}</MkColoredTag>',
		};
	},
	args: {
		label: '标签',
		variant: 'info',
	},
	parameters: { layout: 'centered' },
} satisfies StoryObj<typeof MkColoredTag>;
```

label 仅作为 Storybook 展示参数；组件原本通过插槽接受内容时，应保持插槽设计，不为此添加组件 prop。

## 验证

```bash
pnpm --filter frontend storybook-dev    # http://localhost:6006
pnpm --filter frontend build-storybook  # 静态构建
```

新组件未出现在侧栏时，常见原因是未进入 [generate.tsx](../../../../../packages/frontend/.storybook/generate.tsx) 的**允许列表**。全量 Vue glob 已被注释，当前通过 `globSync('src/components/global/Mk*.vue')`、`globSync('src/components/Mk[B-E]*.vue')` 等显式列举。

仅添加 .stories.impl.ts 可能仍不会显示；不在范围内时需在 generate.tsx 添加规则。同时检查后缀和 SPDX 头之后的语法。

Chromatic（`pnpm --filter frontend chromatic`）也会检查视觉回归。
