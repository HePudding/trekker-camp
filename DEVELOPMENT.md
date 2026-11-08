# 旅人营地 · 团队开发指南

本仓库由项目团队维护，开发任务围绕星塔旅人简中第三方社区的实际需求安排，不征集外部代码贡献。本文记录团队成员和 AI 助手的工作约定。

## 开发入口

- [本地环境](SETUP.zh-CN.md)：依赖、配置、启动和测试数据库。
- [素材管理](ASSETS.md)：团队素材同步、运行时加载和部署挂载。
- [AI 工作规则](AGENTS.md)：改动范围、授权边界与最低检查。
- [维护方向](ROADMAP.md)：本站的产品范围。
- [安全问题](SECURITY.md)：非公开报告与处理。

## 工作范围与协作

以项目负责人确认的需求为准，只完成当前任务所需的实现。产品文案使用简体中文，围绕“营地 / 旅人”的交流体验维护。默认不开展联邦、ActivityPub 或其他实例的兼容工作。

Issue 用于团队记录已确认的问题和任务；已有明确任务时可直接实现，无需额外创建 Issue。PR 用于审查团队改动，目标分支为 `master`。代码公开与许可证约定见 [README](README.md#项目定位与支持范围)。

提交或 PR 说明使用简体中文描述问题、改动后的行为和验证结果；提交标题可使用 `fix`、`feat`、`docs`、`refactor`、`chore` 等类型前缀。引用已有任务时说明关联，保持改动范围集中。沟通围绕事实和代码，尊重隐私，不发布令牌、配置密钥或用户数据。

AI 仅在用户要求时提交、创建 Issue 或 PR、向外发送消息；合并、生产部署、数据删除和强制推送也须获得相应授权。

## 验证与交付

在仓库根目录执行 `pnpm check:shipping`，检查改动文件的 ESLint、SPDX、语言文件和素材分发安全。按实现范围运行相关测试：

```sh
pnpm --filter frontend test
pnpm --filter misskey-js test
pnpm --filter backend test
pnpm --filter backend test:e2e
```

后端测试前按[环境指南](SETUP.zh-CN.md#测试用配置)准备 `.config/test.yml` 和独立测试数据库。测试会使用测试数据，不连接生产数据库。仅执行当前改动需要的测试。

- API 定义变化：运行 `pnpm build-misskey-js-with-types`，一并提交 `apps/misskey/packages/misskey-js/src/autogen/` 的差异。
- 实体或迁移变化：运行 `pnpm --filter backend check-migrations`，待执行 DDL 为 0；新迁移同时实现 `up()` 和 `down()`。
- 素材机制、忽略规则或部署挂载变化：运行 `pnpm assets:test`。
- 产品文案：只编辑 `apps/misskey/locales/zh-CN.yml`。`ja-JP.yml` 仅用于同步上游，其他语言 YAML 不手动修改。
- 用户未要求时不修改 `CHANGELOG.md`；用户可感知的修改在交接中附一行候选条目。

具体检查见 [shipping-misskey-change](.claude/skills/shipping-misskey-change/SKILL.md)。交接说明实际通过、失败和跳过的检查。

## 发布与部署

团队以 `master` 为日常开发和交付目标。发布范围、版本号与部署时间由项目负责人确定。部署前核对代码版本、数据库迁移、素材版本与备份，使用本站现有配置；素材流程见 [ASSETS.md](ASSETS.md#docker-部署)。

合并代码和部署是分别授权的操作。未授权生产部署时，完成代码与验证后交付结果。

## 技术约定

以下保留基于 Misskey 实现的开发知识，供维护现有应用使用。

## Vue

Misskey 使用 Vue 3 作为前端框架。

- 使用 TypeScript。
- **新组件使用组合式 API，配合 `<script setup lang="ts">` 和组合式 API。**
- 修改旧组件时按当前任务需要调整，避免无关重构。

## Tabler Icons

生产构建会删除未使用的图标。

**动态设置图标时，请勿使用 `ti-${someVal}` 这样仅动态替换图标名的方式。**
必须在源码中包含 `ti-xxx` 形式的完整类名。

## nirax

nirax 是 Misskey 自有的前端路由系统，**深受 vue-router 影响，建议先了解 vue-router。**

### 路由定义

路由定义为以下结构的对象数组：

```ts
{
	name?: string;
	path: string;
	component: Component;
	query?: Record<string, string>;
	loginRequired?: boolean;
	hash?: string;
	children?: RouteDef[];
}
```

> [!WARNING]
> 路由按定义顺序匹配。例如先定义 `/foo/:id` 再定义 `/foo/bar`，后者将永远不会匹配。

### 多路由器

nirax 支持同时存在多个路由器，可使应用内窗口使用独立于浏览器的路由，这是它与 vue-router 的主要区别。

## Storybook

Misskey 使用 [Storybook](https://storybook.js.org/) 开发界面。

### 配置与运行

配置：

```bash
pnpm --filter misskey-js build
```

运行：

```bash
pnpm --filter frontend storybook-dev
```

### 使用方法

新建组件（如 `MyComponent.vue`）后，`.storybook/generate.js` 自动生成 `MyComponent.stories.ts`。
创建 `MyComponent.stories.impl.ts` 可覆盖默认示例：

```ts
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { StoryObj } from '@storybook/vue3';
import MyComponent from './MyComponent.vue';
export const Default = {
	render(args) {
		return {
			components: {
				MyComponent,
			},
			setup() {
				return {
					args,
				};
			},
			computed: {
				props() {
					return {
						...this.args,
					};
				},
			},
			template: '<MyComponent v-bind="props" />',
		};
	},
	args: {
		foo: 'bar',
	},
	parameters: {
		layout: 'centered',
	},
} satisfies StoryObj<typeof MyComponent>;
```

若要退出自动生成，在 `MyComponent.stories.impl.ts` 中添加：

```ts
import MyComponent from './MyComponent.vue';
void MyComponent;
```

创建 `MyComponent.stories.meta.ts` 可覆盖组件元数据：

```ts
export const argTypes = {
	scale: {
		control: {
			type: 'range',
			min: 1,
			max: 4,
		},
	},
};
```

也可以通过 msw 模拟 API 请求，在 `MyComponent.stories.msw.ts` 定义处理器：

```ts
import { HttpResponse, http } from 'msw';
export const handlers = [
	http.post('/api/notes/timeline', ({ request }) => {
		return HttpResponse.json([]);
	}),
];
```

新增、修改或删除这些文件后，记得重新运行 `.storybook/generate.js`。

## Nest

### 服务循环依赖

#### forwardRef

先尝试 `forwardRef`：

```typescript
export class FooService {
	constructor(
		@Inject(forwardRef(() => BarService))
		private barService: BarService
	) {
	}
}
```

#### OnModuleInit

若无效，使用 `OnModuleInit`：

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BarService } from '@/core/BarService';

@Injectable()
export class FooService implements OnModuleInit {
	private barService: BarService // 从构造函数移至此处

	constructor(
		private moduleRef: ModuleRef,
	) {
	}

	async onModuleInit() {
		this.barService = this.moduleRef.get(BarService.name);
	}

	public async niceMethod() {
		return await this.barService.incredibleMethod({ hoge: 'fuga' });
	}
}
```

##### 服务单元测试

测试中需要调用 `onModuleInit`：

```typescript
// import ...

describe('test', () => {
	let app: TestingModule;
	let fooService: FooService; // 用于测试用例
	let barService: BarService; // 用于测试用例

	beforeEach(async () => {
		app = await Test.createTestingModule({
			imports: ...,
			providers: [
				FooService,
				{ // 创建模拟对象，按需使用
					provide: BarService,
					useFactory: () => ({
						incredibleMethod: jest.fn(),
					}),
				},
				{ // 注册提供者
					provide: BarService.name,
					useExisting: BarService,
				},
			],
		})
			.useMocker(...
			.compile();

		fooService = app.get<FooService>(FooService);
		barService = app.get<BarService>(BarService) as jest.Mocked<BarService>;

		// 执行 onModuleInit
		await fooService.onModuleInit();
	});

	test('nice', () => {
		await fooService.niceMethod();

		expect(barService.incredibleMethod).toHaveBeenCalled();
		expect(barService.incredibleMethod.mock.lastCall![0])
			.toEqual({ hoge: 'fuga' });
	});
})
```

## 开发注意事项

### Misskey 领域概念使用 `Mi` 前缀

类似 Google Map、Google Earth、Google Drive 的命名方式，代码中为 Misskey 特有的领域概念添加 `Mi` 前缀，便于区分其他领域的概念并避免名称冲突。

仅对临时局部变量，在上下文明确属于 Misskey 且没有名称冲突风险时，可以省略 `Mi`。

### Misskey.js 类型生成

```bash
pnpm build-misskey-js-with-types
```

### 解决 pnpm-lock.yaml 冲突

运行 `pnpm` 即可修复。

### INSERT 操作使用 insert

插入时使用 `insert`，避免使用 `save`。

### SQL 占位符

使用查询构建器时，占位符不得重复。例如：

``` ts
query.andWhere(new Brackets(qb => {
	for (const type of ps.fileType) {
		qb.orWhere(`:type = ANY(note.attachedFileTypes)`, { type: type });
	}
}));
```

循环重复使用 `type` 会导致问题，应为每个值生成独立占位符：

```ts
query.andWhere(new Brackets(qb => {
	for (const type of ps.fileType) {
		const i = ps.fileType.indexOf(type);
		qb.orWhere(`:type${i} = ANY(note.attachedFileTypes)`, { [`type${i}`]: type });
	}
}));
```

### TypeORM 的非空判断

```ts
const foo = await Foos.findOne({
	bar: Not(null)
});
```

上述查询无法按预期判断 `bar` 非空。应使用：

```ts
const foo = await Foos.findOne({
	bar: Not(IsNull())
});
```

### SQL 中的 `null`

参数可能为 `null` 时，应分别构建 SQL。例如：

``` ts
query.where('file.folderId = :folderId', { folderId: ps.folderId });
```

当 `ps.folderId` 为 `null` 时，查询会变成 `file.folderId = null`，无法得到预期结果。应使用：

``` ts
if (ps.folderId) {
	query.where('file.folderId = :folderId', { folderId: ps.folderId });
} else {
	query.where('file.folderId IS NULL');
}
```

### SQL 中的空数组

`IN` 参数可能为空数组时，应分别处理。例如：

``` ts
const users = await Users.find({
	id: In(userIds)
});
```

当 `userIds` 为空时，会生成无效的 `user.id IN ()`。应使用：

``` ts
const users = userIds.length > 0 ? await Users.find({
	id: In(userIds)
}) : [];
```

### SQL 数组下标

SQL 数组下标**从 1 开始**。访问 `[a, b, c]` 的第一个元素时使用 `[1]`。

### IN 与 null

对可能包含 null 的列使用 IN 时，需通过 OR 等方式单独处理 null。

### 删除枚举值

删除枚举值前，必须删除所有使用该值的记录。若删除成本过高或无法删除，应保留该值。

### 创建迁移

使用新时间戳创建迁移，同时实现 `up()` 和 `down()`。不修改已合并的迁移；操作步骤见[创建迁移](.claude/skills/working-on-backend/references/tasks/creating-migration.md)。

### 对连接使用 `markRaw`

将 misskey.js 连接设置为 **Vue 组件的 data 选项**时，必须用 `markRaw` 包装，避免不必要的响应式转换导致 SDK 内部错误和性能问题。组合式 API 的响应式转换由开发者显式控制，不适用这一统一要求。

### 注意 JSON 导入

TypeScript 导入 JSON 后，tsc 会将其一同输出到 dist，可能意外覆盖文件。导入前确认文件允许被改写；需要避免改写时，使用 `fs.readFileSync` 等函数读取。

### 组件自身不设置 margin

组件自身设置 margin 容易导致问题，应由使用组件的一方控制外边距。

### 命名规则

通常作为一个单词使用的缩写，按普通单词处理。

- IP address：推荐 `ipAddress`、`IpAddress`；避免 `IPAddress`。
- User ID：推荐 `userId`、`UserId`；避免 `userID`、`UserID`。
- XML HTTP 请求：推荐 `xmlHttpRequest`、`XmlHttpRequest`；避免 `XMLHttpRequest`、`XMLHTTPRequest`。

### 提取函数的判断标准

复用性低且很短的处理，例如只调用一次、不到十行，提取函数可能降低可读性，应避免过度拆分。

调用范围有限时，将函数限定在该作用域内有时更清晰。但内部函数也会获得访问父作用域无关变量和参数的能力，应根据实际情况判断。

不推荐：

``` ts
function withBrankets(x) {
	return `(${x})`;
}

function formatPercent(x) {
	return `${x}%`;
}

function formatValue(x) {
	return withBrankets(formatPercent(x));
}

function showData(a, b) {
	console.log(formatValue(a));
	console.log(formatValue(b));
}
```

推荐：

``` ts
function formatValue(x) {
	return `(${x}%)`;
}

function showData(a, b) {
	console.log(formatValue(a));
	console.log(formatValue(b));
}
```

或：

``` ts
function showData(a, b) {
	function formatValue(x) {
		return `(${x}%)`;
	}

	console.log(formatValue(a));
	console.log(formatValue(b));
}
```

或：

``` ts
function showData(a, b) {
	console.log(`(${a}%)`);
	console.log(`(${b}%)`);
}
```

## 其他约定

### HTML 类名不使用 follow

该词可能被广告拦截器误拦截。

### 不使用 index 文件名

ESM 已移除目录导入；部分库还可能将名为 index 的文件误判为目录导入并报错。

## CSS 示例

### 提高 CSS 变量颜色亮度

``` css
color: hsl(from var(--MI_THEME-accent) h s calc(l + 10));
```

### 降低 CSS 变量颜色亮度

``` css
color: hsl(from var(--MI_THEME-accent) h s calc(l - 10));
```

### 为 CSS 变量颜色添加透明度

``` css
color: color(from var(--MI_THEME-accent) srgb r g b / 0.5);
```

## 设计理念

### 不拘泥于 DRY

重点在于恰当抽象。避免盲目或不必要的通用化；重复更自然时，应接受重复。

### 控制 Misskey 实现的复杂度

实现若已与 Misskey 特有上下文和关注点分离，其内部复杂度不会直接增加理解 Misskey 本身的难度。这与使用 Vue、AiScript 等库时无需同时理解其全部内部实现相似。

领域关注点分离后，思考 Misskey 实现时可忽略这些内部细节，降低认知负担。代码位于仓库内外、由本项目或第三方维护，对这种复杂度判断影响较小。

仓库内由团队维护的实现当然仍有维护成本，但从 Misskey 的核心设计看，它可以像外部库一样使用，只是恰好由同一批开发者维护、恰好放在同一仓库。

因此，尽量让实现独立于 Misskey 领域知识，可在新增功能时控制代码库复杂度。但也应避免为微小逻辑过度拆分，以免额外代码和认知成本超过收益。

### 编写便于 AI 理解的代码

AI 审查或辅助编码时，容易误解的代码可能引发幻觉。应避免此类写法，或通过注释解释。

便于 AI 理解的代码通常也更便于人类理解。
