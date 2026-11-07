# SCSS Modules、CSS 变量与工具类

本页说明 Misskey 的 SCSS 规范，包括 style module、主题与通用变量，以及全局工具类。

## CSS 变量

新样式**必须通过变量设置**。直接硬编码 #fff、rgb、rgba 会被 vue-component-reviewer 记为 Major。

### --MI_THEME-*：主题相关

颜色随浅色、深色或自定义主题变化，在 apps/misskey/packages/frontend-shared/themes/_dark.json5 等文件中定义。

| 变量 | 用途 |
|---|---|
| --MI_THEME-bg | 页面背景 |
| --MI_THEME-panel | 卡片、面板背景 |
| --MI_THEME-panelHighlight | 高亮面板 |
| --MI_THEME-fg | 正文文字 |
| --MI_THEME-fgHighlighted | 高亮文字 |
| --MI_THEME-fgOnPanel | 面板文字 |
| --MI_THEME-fgOnAccent | 强调色背景上的文字，通常偏白 |
| --MI_THEME-accent | 主强调色，用于链接和激活状态 |
| --MI_THEME-accentedBg | 浅强调色背景 |
| --MI_THEME-divider | 分隔线 |
| --MI_THEME-error | 错误色 |
| --MI_THEME-warn、--MI_THEME-infoWarnBg、--MI_THEME-infoWarnFg | 警告 |
| --MI_THEME-infoBg、--MI_THEME-infoFg | 信息提示 |
| --MI_THEME-buttonBg、--MI_THEME-buttonHoverBg | 按钮背景 |
| --MI_THEME-inputBorder、--MI_THEME-inputBorderHover | 表单边框 |
| --MI_THEME-focus | 焦点边框 |
| --MI_THEME-link | 链接 |
| --MI_THEME-mention、--MI_THEME-hashtag | 提及和话题标签 |

完整列表见 apps/misskey/packages/frontend-shared/themes/_light.json5。

### --MI-*：与主题无关的通用常量

| 变量 | 用途 |
|---|---|
| --MI-radius | 标准圆角，12px |
| --MI-margin | 标准大间距，16px，移动端为 10px |
| --MI-marginHalf | 标准间距的一半 |
| --MI-modalBgFilter | 弹窗背景滤镜 |

使用 `var(--MI-radius)` 保持全局一致，避免未来调整圆角时逐项修改硬编码。

### 允许的常量

- transparent、currentColor、none 等 CSS 关键词。
- 仅改变透明度时，通过 `color-mix(in srgb, var(--MI_THEME-fg) 50%, transparent)` 合成。
- 尚未提供变量的图标尺寸等数值常量，例如 font-size: 14px。

## 全局工具类

定义位于 [apps/misskey/packages/frontend/src/style.scss](../../../../../apps/misskey/packages/frontend/src/style.scss)，可与模块类配合使用。全局类直接写入 `class="_button"`，模块类通过 `:class="$style.root"` 绑定。

以下为常用示例，实际定义可能变化。可通过 `grep -nE '^\._' apps/misskey/packages/frontend/src/style.scss` 列出当前类名。

| 类 | 含义 |
|---|---|
| _button | 无装饰可点击基础样式，仅 appearance、光标和禁用光标重置；不含焦点环或波纹。用于 button 或 a，需要波纹时使用 MkButton |
| _buttonPrimary | _button 加强调色背景，用于确认操作 |
| _buttonGradate | _button 加渐变背景 |
| _panel | 面板背景、圆角和 overflow:clip，不含阴影 |
| _selectable | 允许选择文本；默认仅正文可选择 |
| _selectableAtomic | 子元素整体作为一个选择单位 |
| _noSelect | 禁止选择文本 |
| _nowrap | white-space: nowrap |
| _help | 强调色与帮助光标 |
| _textButton | 强调色文字按钮，悬停下划线 |
| _link | 强调文本链接 |
| _gaps | 垂直 flex，间距为 --MI-margin |
| _gaps_m、_gaps_s | 垂直 flex，间距分别为 21px、10px |
| _margin | 标准 margin，等于 --MI-margin |
| _shadow | 标准阴影 |
| _popup | 弹出层背景、圆角和 contain，不含阴影 |
| _acrylic | 半透明与背景模糊 |

用法：

```vue
<template>
<button class="_button _buttonPrimary" :class="$style.action" @click="onClick">
	{{ i18n.ts.save }}
</button>
</template>

<style lang="scss" module>
.action {
	padding: 8px 24px;
	/* 复用 _buttonPrimary 的背景与焦点样式，不重复声明 */
}
</style>
```

## style module 的特殊语法

### :global：跳出模块作用域

模块类名在构建时会被哈希化。仅在需要对外部库或子组件的特定类设置样式时使用：

```scss
.root {
	:global(.someThirdPartyClass) {
		color: var(--MI_THEME-fg);
	}
}
```

通常很少需要。

### :deep：访问子组件内部

```scss
.root :deep(.child-internal-class) {
	color: var(--MI_THEME-accent);
}
```

尽量直接修改子组件，避免频繁使用。

## 命名

- 模块类通常使用 camelCase，如 root、inputCore、headerText。
- 无需使用 BEM 的 block__element--modifier；CSS Modules 已避免命名冲突。
- 状态修饰使用嵌套的 &.active、&.disabled。

## 常见审查问题

- 硬编码 #fff、#000、rgba：改用主题变量或 color-mix。
- 使用 scoped 而未使用 module：改为 `<style lang="scss" module>` 并通过 $style 引用。
- 自行设置面板圆角和内边距：检查是否可复用 _panel。
- 重写按钮基础样式：以 _button 为基础。
