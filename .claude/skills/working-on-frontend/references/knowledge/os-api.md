# os.* 界面辅助函数

[packages/frontend/src/os.ts](../../../../../packages/frontend/src/os.ts) 提供界面操作 API。
**禁止直接调用 `window.alert()`、`window.confirm()`、`window.prompt()`**，它们与 Misskey 的主题、无障碍和弹窗层不一致。

## 主要 API

| 函数 | 用途 |
|---|---|
| `os.alert({ type?, title?, text? })` | 单向提示，所有字段可选 |
| `os.confirm({ type, title?, text? })` | 确认对话框，type 必需，返回 canceled |
| `os.toast(message)` | 临时通知 |
| `os.popup(component, props, handlers)` | 任意组件的异步弹窗 |
| `os.popupMenu(items, anchor?)` | 上下文菜单 |
| `os.contextMenu(items, ev)` | 右键菜单 |
| `os.form(title, fields)` | 表单对话框 |
| `os.apiWithDialog(endpoint, data)` | API 调用及错误对话框 |
| `os.success()`、`os.waiting()` | 成功、加载状态 |

## 示例

### os.alert：单向通知

```ts
await os.alert({
	type: 'info',
	text: i18n.ts.savedSuccessfully,
});
```

type 可为 info、warning、error、question、success、waiting。

### os.confirm：确认

```ts
const { canceled } = await os.confirm({
	type: 'warning',
	text: i18n.ts._notes.deleteConfirm,
});
if (canceled) return;
// 删除处理
```

常见模式是 canceled 为 true 时不执行后续操作。

### os.toast：临时通知

```ts
os.toast(i18n.ts.deleted);
```

适合无需等待结果的成功反馈。

### os.popup：任意组件

```ts
const { dispose } = os.popup(MkUserSelectDialog, {
	includeSelf: false,
}, {
	ok: (user) => {
		// ...
		dispose();
	},
	cancel: () => {
		dispose();
	},
});
```

通过 os.popup 传入组件、props 和事件处理器打开自定义对话框，使用 dispose 关闭。

### os.apiWithDialog：API 与自动错误提示

```ts
const result = await os.apiWithDialog('notes/create', {
	text: 'hello',
});
// 成功时：result 为 API 响应
// 失败时：自动显示错误对话框，但 Promise 仍拒绝，await 调用需要 try/catch
```

普通 misskeyApi 调用需要自行显示错误；apiWithDialog 在失败时自动调用错误提示。但它返回的仍是原 Promise，失败时仍会拒绝，见 [os.ts](../../../../../packages/frontend/src/os.ts) 的 `return promise`。await 调用仍需要 try/catch；若仅需在显示错误后停止后续操作，可在 catch 中不再抛出。

## 原生对话框的问题

- alert 不跟随深色或自定义主题。
- confirm 的键盘操作、焦点限制和国际化与 Misskey 规范不一致。
- prompt 的输入界面也存在相同问题。
- Firefox、Safari、Chrome 的外观不同。
- vue-component-reviewer 会报告此类调用。

使用 os.alert、os.confirm、os.form 或 os.popup。

## 参考文件

- [os.ts](../../../../../packages/frontend/src/os.ts)：全部 API 实现。
- `MkDialog.vue`：alert 和 confirm 复用的组件。
- `MkFormDialog.vue` 等表单对话框组件。
