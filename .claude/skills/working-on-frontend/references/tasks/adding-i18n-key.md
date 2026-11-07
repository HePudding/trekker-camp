# 添加或修改国际化键

添加或修改界面文案时遵循本流程。上游规则**仅允许手动编辑 apps/misskey/locales/ja-JP.yml**。

## 强制前提

- 禁止编辑其他语言文件，它们由 Crowdin 自动分发，手动修改会被覆盖，见 [apps/misskey/locales/README.md](../../../../../apps/misskey/locales/README.md) 和 [crowdin.yml](../../../../../crowdin.yml)。
- 不在单文件组件中硬编码界面字符串，统一通过 i18n.ts 引用。
- 重命名已有键会影响 Crowdin 翻译资产，应分为**新增 → 迁移 → 删除旧键**，详见[国际化用法](../knowledge/i18n-usage.md)。

## 1. 添加键

编辑 [apps/misskey/locales/ja-JP.yml](../../../../../apps/misskey/locales/ja-JP.yml)，保留层级并放在相关章节：

```yaml
# 顶层简单键
save: "保存"

# 嵌套分类（下划线前缀表示内部分类）
_settings:
  general: "常规"
  appearance: "外观"

# 带参数（简单占位符替换）
# 仅支持 {name} 形式，不支持 ICU MessageFormat 的 plural/select
greeting: "你好，{name}"
```

### 命名

- 简单键使用 lowerCamelCase，如 saveChanges、confirmDelete。
- 分类以下划线开头，如 _settings、_abuseUserReport。
- 在现有分类中按附近语义与功能分组排列，不强制字母排序；新分类可追加到末尾。
- 包含 HTML、冒号、单引号或 & 的值必须使用双引号，避免 YAML 解析失败。

ICU 替代方案、_lang_ 保留键和 Storybook 行为见[国际化用法](../knowledge/i18n-usage.md)。

## 2. 重新生成类型

apps/misskey/packages/i18n/build.ts 解析 ja-JP.yml，将接口写入 [apps/misskey/packages/i18n/src/autogen/locale.ts](../../../../../apps/misskey/packages/i18n/src/autogen/locale.ts)。

### 自动生成（推荐）

pnpm dev 运行时，i18n 的 nodemon/tsx 监听脚本自动检测 YAML 改动并生成。

### 手动生成

```bash
pnpm --filter i18n generate
```

实际执行 tsx scripts/generateLocaleInterface.ts。

未生成就引用新键，会出现 `Property '<newKey>' does not exist on type 'Locale'`。运行前端 lint 可发现，其他运行时警告见[故障排查](../knowledge/i18n-usage.md)。

## 3. 前端引用

```ts
import { i18n } from '@/i18n.js';
```

| 用途 | 写法 |
|---|---|
| 简单字符串 | i18n.ts.save |
| 嵌套 | i18n.ts._settings.general |
| 有参数 | i18n.tsx.greeting({ name: userName }) |
| Vue 模板 | {{ i18n.ts.save }} 或 {{ i18n.tsx.greeting({ name }) }} |

ts 提供有类型的字符串；tsx 仅为带参数的键提供函数，完成简单占位符替换，不支持 ICU MessageFormat。
HTML、computed、动态键和方括号访问见[用法指南](../knowledge/i18n-usage.md)。

## 4. 验证

```bash
# 重新生成国际化类型，再检查类型和 ESLint；lint 不会调用 generate，必须按顺序执行
pnpm --filter i18n generate
pnpm --filter i18n lint

# 检查前端中新键引用的类型
pnpm --filter frontend lint

# 检查其他语言 YAML 无差异，输出为空即通过
git diff --name-only develop -- 'apps/misskey/locales/*.yml' | grep -v '^apps/misskey/locales/ja-JP\.yml$'
```

grep 排除 ja-JP.yml 时必须先用 --name-only 获取文件名。直接过滤 diff 正文会让新增行通过，导致误判。

## 示例：添加删除确认

1. 在 apps/misskey/locales/ja-JP.yml 添加：

   ```yaml
   _notes:
     deleteConfirm: "要删除这条帖子吗？"
   ```

2. 运行 pnpm --filter i18n generate，或保持 pnpm dev 监听。
3. 在组件中使用：

   ```vue
   <script setup lang="ts">
   import { i18n } from '@/i18n.js';
   import * as os from '@/os.js';

   async function onDelete() {
     const { canceled } = await os.confirm({
       type: 'warning',
       text: i18n.ts._notes.deleteConfirm,
     });
     if (canceled) return;
     // 删除处理
   }
   </script>
   ```

## 参考

- [语言文件编辑规则](../../../../../apps/misskey/locales/README.md)
- [ja-JP.yml](../../../../../apps/misskey/locales/ja-JP.yml)
- [i18n 构建](../../../../../apps/misskey/packages/i18n/build.ts)
- [生成类型](../../../../../apps/misskey/packages/i18n/src/autogen/locale.ts)
- [前端 i18n](../../../../../apps/misskey/packages/frontend/src/i18n.ts)
