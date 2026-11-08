# 国际化用法、语言文件维护与故障排查

本页说明 i18n.ts、i18n.tsx 的选择、语言文件维护，以及常见类型错误和运行时警告。

## 目录

- [基本用法](#基本用法)
- [实现模式](#实现模式)
- [语言文件维护](#语言文件维护)
- [故障排查](#故障排查)
- [限制与补充](#限制与补充)

## 基本用法

文案必须通过 [i18n.ts](../../../../../apps/misskey/packages/frontend/src/i18n.ts) 引用。
无参数使用 ts 属性，有参数使用 tsx 函数。无参数键通过 tsx 调用会报类型错误；带参数键通过 ts 引用可能不报错，却将占位符原样显示。

无参数：

  ```ts
  os.toast(i18n.ts.removed);
  ```

有参数：

  ```ts
  os.alert({ type: 'info', text: i18n.tsx.unfollowConfirm({ name: user.username }) });
  ```

包含 {name} 等占位符的键应使用 tsx；直接使用 ts 会跳过格式化。

**优先复用已有键**。新增前先搜索 zh-CN.yml，检查 deleteAreYouSure({ x }) 等通用文案是否可用。新增步骤见[添加国际化键](../tasks/adding-i18n-key.md)。其他语言按上游同步规则维护，不手动编辑。

```vue
<script lang="ts" setup>
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';

const props = defineProps<{ name: string }>();

async function onDelete() {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: i18n.tsx.driveFileDeleteConfirm({ name: props.name }), // 有参数
	});
	if (canceled) return;
	os.toast(i18n.ts.removed); // 无参数
}
</script>
```

| 用途 | 写法 |
|---|---|
| 简单字符串 | i18n.ts.save |
| 嵌套 | i18n.ts._settings.general |
| 一个参数 | i18n.tsx.unfollowConfirm({ name }) |
| 多个参数 | i18n.tsx.monthAndDay({ month, day }) |
| Vue 模板 | {{ i18n.ts.save }} 或 {{ i18n.tsx.unfollowConfirm({ name }) }} |

## 实现模式

### 嵌入 HTML

语言值可包含 b、br、strong 等标签，在界面通过 v-html 或 Mfm 渲染：

```yaml
# apps/misskey/locales/zh-CN.yml
poweredByMisskeyDescription: "{name} 是开源平台 <b>Misskey</b> 的一个服务器。"

# apps/misskey/locales/zh-CN.yml (改行 + br)
driveAboutTip: "网盘保存之前上传的文件。<br>\n发帖时可重复使用。<br>\n<b>删除文件会影响引用它的帖子。</b>"
```

调用：

```vue
<div v-html="i18n.tsx.poweredByMisskeyDescription({ name: 'Misskey' })" />
```

- 包含 HTML 的值使用双引号。
- 使用 v-html 前检查 XSS 风险，参数仅允许安全静态字符串或经过转义的值，不直接传入用户输入。

### 响应式引用与动态键

随时间等状态切换键时，通过 computed 和方括号动态选择，参考 [MkPoll.vue](../../../../../apps/misskey/packages/frontend/src/components/MkPoll.vue)：

```ts
const timer = computed(() => i18n.tsx._poll[
  remaining.value >= 86400 ? 'remainingDays' :
  remaining.value >= 3600 ? 'remainingHours' :
  remaining.value >= 60  ? 'remainingMinutes' : 'remainingSeconds'
]({
  s: Math.floor(remaining.value % 60),
  m: Math.floor(remaining.value / 60) % 60,
  h: Math.floor(remaining.value / 3600) % 24,
  d: Math.floor(remaining.value / 86400),
}));
```

对应 YAML：

```yaml
_poll:
  remainingDays: "距离结束还有 {d} 天 {h} 小时"      # {d} {h}
  remainingHours: "距离结束还有 {h} 小时 {m} 分钟"     # {h} {m}
  remainingMinutes: "距离结束还有 {m} 分 {s} 秒"     # {m} {s}
  remainingSeconds: "距离结束还有 {s} 秒"          # {s}
```

各键可使用不同参数。调用方用同一对象传入全部候选键所需参数的并集，各键自行读取需要的字段。

### 非法标识符键

数字开头等不适合点号访问的键使用方括号，参考 [MkSignin.totp.vue](../../../../../apps/misskey/packages/frontend/src/components/MkSignin.totp.vue)：

```vue
<div :class="$style.totpDescription">{{ i18n.ts['2fa'] }}</div>
```

新键遵循 lowerCamelCase 可避免此问题。

### 嵌套与参数

```vue
{{ i18n.tsx._uploader.maxFileSizeIsX({ x: maxSize + 'MB' }) }}
{{ i18n.tsx._auth.shareAccess({ name: appName }) }}
```

### 将已翻译字符串作为参数

参考 [MkSignupDialog.rules.vue](../../../../../apps/misskey/packages/frontend/src/components/MkSignupDialog.rules.vue)：

```ts
i18n.tsx.iHaveReadXCarefullyAndAgree({ x: i18n.ts.serverRules })
```

### 按有无参数切换

```vue
{{ name ? i18n.tsx._auth.shareAccess({ name }) : i18n.ts._auth.shareAccessAsk }}
```

## 语言文件维护

营地产品文案以 `apps/misskey/locales/zh-CN.yml` 为源语言。`ja-JP.yml` 保留为上游同步入口，其他语言 YAML 不手动编辑。本项目默认关闭 Crowdin 流程。

新增键前先搜索已有文案。调整键名时同步迁移调用位置，检查简体中文显示与繁体中文缺失时的简中回退；避免为文案改写无谓更换已有键名。删除旧键前确认代码中已无引用。

执行 `node scripts/check-locales.mjs` 检查语言文件改动。发现误改时仅撤回本次引入的内容，保留用户已有工作。

详细规则见[语言文件说明](../../../../../apps/misskey/locales/README.md)。

## 故障排查

### Property '<key>' does not exist on type 'Locale'

```
apps/misskey/packages/frontend/src/components/MkXxx.vue
> i18n.ts.newKey
  Property 'newKey' does not exist on type 'Locale'.
```

原因是 YAML 添加了键，但 autogen/locale.ts 未重新生成。

- pnpm dev 会监听生成，保存后重新检查类型。
- 手动执行 pnpm --filter i18n generate。
- 通过前端 lint 检查。

实现见 [generateLocaleInterface.ts](../../../../../apps/misskey/packages/i18n/scripts/generateLocaleInterface.ts)，参数提取正则为 /\{(\w+)\}/g。

### ts 与 tsx 混用

无参数键通过 tsx 调用：

```
i18n.tsx.save({...})
> Property 'save' does not exist on type 'Tsx<Locale>'.
```

带参数键通过 ts 引用，界面会显示未替换占位符：

```vue
{{ i18n.ts.unfollowConfirm }}
<!-- 界面显示“取消关注 {name} 吗？”，其中 {name} 未被替换 -->
```

[共享 i18n 实现](../../../../../apps/misskey/packages/frontend-shared/js/i18n.ts)的 Tsx<T> 仅将 ParameterizedString<P> 键暴露为函数。
按 YAML 中是否存在占位符选择：

| 值 | 正确调用 |
|---|---|
| 保存 | i18n.ts.save |
| 包含 {name} 的取消关注确认 | i18n.tsx.unfollowConfirm({ name }) |

### Unexpected locale key: <key>

开发模式 Proxy 检测到访问不存在的键。补充 zh-CN.yml 中的键或修复拼写，见[共享 i18n 实现](../../../../../apps/misskey/packages/frontend-shared/js/i18n.ts)。

### Missing locale parameters: <param> at <key>

调用参数名与 YAML 不一致，或参数对象缺少值。实现使用 Object.hasOwn 检查。
统一参数名；修改 YAML 参数时，搜索并同步全部前端调用。

### YAMLException

生成或开发监听中出现 YAML 解析错误，常见原因是特殊字符未正确引用。
包含标签、冒号、引号、&、*、竖线或 # 等时，将整个值置于双引号中。

```yaml
# 正确：包含 HTML 标签
poweredByMisskeyDescription: "{name} 是 <b>Misskey</b> 平台的一个服务器。"

# 正确：包含冒号、单引号和尖括号的 URL 说明
objectStorageBaseUrlDesc: "用于引用的 URL。使用 CDN 或代理时填写其 URL；S3: 'https://<bucket>.s3.amazonaws.com'；GCS: 'https://storage.googleapis.com/<bucket>'。"

# 正确：通过转义嵌入换行
driveAboutTip: "网盘保存之前上传的文件。<br>\n发帖时可将文件作为附件使用。"
```

也可使用块标量；HTML 与参数混用时通常采用双引号加换行转义。

### 覆盖 _lang_

_lang_ 是语言自称的保留键，位于 [生成接口](../../../../../apps/misskey/packages/i18n/src/autogen/locale.ts)开头。新增功能应使用其他键名。

### 修改后界面没有更新

原因可能是只运行了前端 watch，i18n 未监听；或浏览器缓存了 apps/misskey/built/_frontend_dist_/locales/*.json。
使用根目录 pnpm dev 启动前后端及 i18n 监听。仍无变化时清除浏览器缓存，或手动运行 pnpm --filter i18n build。

## 限制与补充

### 不支持 ICU MessageFormat

[生成器](../../../../../apps/misskey/packages/i18n/scripts/generateLocaleInterface.ts)仅识别 /\{(\w+)\}/g，即简单 {paramName} 替换。

以下 ICU 写法会作为普通字符串显示：

```yaml
# 错误：ICU plural 会原样显示
items: "{count, plural, one {1 个} other {{count} 个}}"

# NG: ICU select
gender: "{gender, select, male {他} female {她} other {对方}}"
```

可按数量拆分键：

```yaml
# OK
withNFiles: "{n} 个文件"
withOneFile: "1 个文件"
```

```ts
const text = files.length === 1
  ? i18n.ts.withOneFile
  : i18n.tsx.withNFiles({ n: files.length });
```

时间等连续状态使用上文 MkPoll 动态键模式。

### 保留键 _lang_

位于每个语言文件顶层开头，存放该语言的自称：

```yaml
# apps/misskey/locales/zh-CN.yml (顶层开头)
_lang_: "简体中文"
```

用于语言选择下拉框，不用于新增业务文案。

### Storybook

Storybook 使用独立打包流程，通过 [preload-locale.ts](../../../../../apps/misskey/packages/frontend/.storybook/preload-locale.ts) 将 zh-CN 数据写入同目录 locale.ts。

- 预加载简体中文文案；其他语言的显示在应用中验证。
- 新增键后若预加载尚未执行，需重启 Storybook 或先构建 i18n。
- 示例中调用方式相同，如 i18n.tsx._dialog.charactersBelow({ current: 0, min: 2 })。

### 后端国际化

国际化主要用于前端及部分服务端渲染错误页。后端通常不直接导入 i18n；API 错误使用未本地化的 ApiError 消息，再由前端翻译。

### 换行

双引号值中的 \n 会变为实际换行。块标量也可用，但混合 HTML 和参数时通常使用双引号转义。
Vue 展示时需配置 white-space: pre-wrap 等样式。
