# 贡献指南

感谢你对参与 Misskey 开发感兴趣！本文提供贡献所需的信息。

> [!NOTE]
> 上游项目主要使用日语，**但你无需将 Issue 或 PR 翻译成日语。**
> 即使收到日语评论，也无需用日语回复。\
> 机器翻译成日语的准确度有限，使用原语言更便于理解，也方便读者选择自己偏好的翻译工具。

<a id="roadmap"></a>

## 路线图

见 [ROADMAP.md](./ROADMAP.md)。

## Issue

创建前请检查：

- 搜索相似问题，避免重复创建。
- Issue 用于功能请求、建议和缺陷跟踪。提问与故障排查请使用 [GitHub Discussions](https://github.com/misskey-dev/misskey/discussions) 或 [Discord](https://discord.gg/Wp8gVStHW3)。

> [!WARNING]
> 不要提前关闭即将解决的 Issue；实际解决问题的提交合并后才能关闭。

### 建议先讨论再实现

欢迎提出建议。添加功能或修复缺陷前，**先在 Issue 中审查设计和方案**；没有对应 Issue 时请创建。省略此步骤可能导致实现完成后 PR 无法合并。

此时还应明确 PR 的目标，并让团队成员了解。未明确工作范围的 PR 容易膨胀且难以审查。

开始实现时，将 Issue 指派给自己；没有权限时请有提交权限的成员协助。明确认领可避免重复工作。

有提交权限的成员请注意：最终决策前不要指派人员。

### Issue 分诊方式

有提交权限的成员可以：

- 关闭无法在最新稳定版复现的问题。
- 将问题合并到其他 Issue。
- 将问题拆分为多个 Issue。
- 原关闭理由不再适用时重新打开 Issue。

@syuilo 保留是否实现功能及如何实现的最终决定权，但并非每次都会行使。

## 常用分支

- **`master`** 跟踪最新发布版本，用于生产。
- **`develop`** 用于开发下一个版本；上游 PR 通常以此为目标。
- **`l10n_develop`** 专用于本地化管理。

## 创建 PR

感谢提交 PR！创建前请检查：

- 尽可能在标题中使用类型前缀，如 `fix`、`refactor`、`feat`、`enhance`、`perf`、`chore`。
- 保持合适粒度，避免一个 PR 混合多类修改或关注点。
- 若解决已有 Issue，在正文中引用。
- 在 [`CHANGELOG.md`](/CHANGELOG.md) 添加修改概述；重构等不影响用户的修改可省略。
- 检查是否需要新增或更新文档。
- 新增功能或修复缺陷时，尽可能添加测试。
- 提前确认测试和 lint 通过。可运行 `pnpm test` 和 `pnpm lint`，详情见[测试](#testing)。
- 涉及界面修改时，在正文中附上截图。

感谢配合 🤗

### ActivityPub 载荷修改的额外要求

*本节针对 misskey-dev 的实现。其他 fork 或实现可能采用不同方式；misskey-hub 文档不记录非 misskey-dev 的扩展。*

PR 修改 ActivityPub 载荷时，请向 [misskey-hub 文档](https://github.com/misskey-dev/misskey-hub-next/blob/master/content/ns.md)提交对应 PR。

新增 ActivityPub 扩展属性名应以 `_misskey_` 开头，例如 `_misskey_quote`。

`packages/backend/src/core/activitypub/type.ts` 中的扩展属性**必须声明为可选**，因为旧版 Misskey 或其他实现发送的载荷可能不含它。

扩展属性必须纳入 `packages/backend/src/core/activitypub/misc/contexts.ts` 的上下文定义，键为扩展属性名，值为短 IRI。

短 IRI 在 misskey-hub 文档中定义，通常为 `misskey:<扩展属性名>`，例如 `misskey:_misskey_quote`。

不应添加其他实现已经定义的属性，也不应向通用属性添加自定义变体值。

## 审查者指南

除了需要修改的地方，也请积极评论优点 💯

推荐阅读：

- https://blog.lacolaco.net/posts/1e2cf439b3c2/
- https://konifar-zatsu.hatenadiary.jp/entry/2024/11/05/192421

### 审查角度

- **范围**：目标是否明确？PR 粒度是否合适？
- **安全**：合并是否引入漏洞？
- **性能**：是否造成意外性能下降？是否存在更高效的方式？
- **测试**：是否覆盖预期行为？是否有遗漏？是否检查异常情况？

## 安全公告

### 报告者须知

感谢报告！如能提供修复补丁，请在私有 fork 中创建 PR。

> [!note]
> GitHub 存在一个问题：PR 未跟随上游 develop 分支时可能无法合并，请保持与该分支同步。

### misskey-dev 成员须知

修复 PR 未跟随 develop 时可能无法合并，此时可请求作者：

> 请合并上游 develop 分支，或将你的分支变基到上游 develop。

## 部署

通过 Issue 评论中的 `/deploy` 命令，将 PR 内容部署到预览环境：

```
/deploy sha=<commit hash>
```

预览环境会分配实际域名，便于测试联邦。

## 合并

<a id="release"></a>

## 发布

### 发布步骤

1. 在 `develop` 分支提交 [package.json](package.json) 的版本号变更。
2. 创建从 `develop` 合入 `master` 的发布 PR，标题必须为 `Release: x.y.z`，其中 `x.y.z` 为新版本号。
3. 部署并进行基本质量检查，确认测试通过。
4. 合并，勿压缩提交。
5. 创建 [GitHub 发布](https://github.com/misskey-dev/misskey/releases)，目标分支为 `master`，标签名为版本号。

> [!NOTE]
> 此流程用于最终质量检查、分担责任、检查直接提交到 develop 的改动，并共同庆祝发布 🎉

## 本地化（l10n）

Misskey 使用 [Crowdin](https://crowdin.com/project/misskey) 管理本地化。
可使用 Crowdin 账户改进翻译，修改会自动以“New Crowdin translations”为标题提交 PR。
负责人 [@syuilo](https://github.com/syuilo) 会在下次发布前将其合并到 develop。

若 Crowdin 尚未列出你的语言，请创建 Issue 请求添加。新语言的翻译进度超过 70% 后，将正式纳入 Misskey 并向用户开放。

![Crowdin](https://d322cqt584bo4o.cloudfront.net/misskey/localized.svg)

## 开发

### 环境搭建

开发前需要 Redis、PostgreSQL 和 FFmpeg。
如需试用相关功能，建议安装 Meilisearch。它不是严格的必需项，但部分功能和测试依赖它。

可以选择以下方式。

#### 使用系统软件

通过系统包管理器等方式安装所需软件。

#### 使用 `docker compose`

运行 `docker compose -f $PROJECT_ROOT/compose.local-db.yml up -d` 获取中间件容器。

#### 使用开发容器

开发容器已包含必要设置，可从 VSCode 连接使用。

安装 Dev Containers 扩展后，在 VSCode 打开项目目录，即可在容器中搭建开发环境。
**注意：**Windows 用户请通过 WSL 克隆仓库。Git for Windows 的换行符处理差异可能损坏文件。

容器会自动执行：

``` bash
git submodule update --init
pnpm install --frozen-lockfile
cp .devcontainer/devcontainer.yml .config/default.yml
pnpm build
pnpm migrate
```

迁移完成后即可继续。

#### Cloudflare Tunnel

Cloudflare Tunnel 可将本地 Misskey 服务器公开到互联网，便于验证仅支持 HTTPS 的功能，或从手机等其他设备访问本地服务器。

##### 与 Cloudflare WARP 配合使用

> cloudflared 通过 QUIC/HTTP2 向 region1.v2.argotunnel.com 和 region2.v2.argotunnel.com 发起出站连接。启用 WARP 后，这些流量可能经由 WARP 形成循环或断开。将两个主机加入 WARP 的分流排除列表，可让 cloudflared 绕过 WARP，直接连接 Cloudflare 边缘节点。

### 开始开发

开发时建议使用：

```
pnpm dev
```

- 监听服务端源码，修改后自动构建并启动服务器进程。
- 使用 esbuild 监听 Service Worker。
- 支持 Vite 热更新（`vite` 命令），行为可能与生产环境有差异。
- Vite 位于后端代理之后，除热更新 WebSocket 外，后端通过 `/vite` 和 `/embed_vite` 代理访问。
- 访问 `http://localhost:3000` 查看 Misskey；将 `3000` 替换为 `.config/default.yml` 中的 `port`。

<a id="testing"></a>

## 测试

非后端测试：

```sh
pnpm --filter frontend test
pnpm --filter misskey-js test
```

后端测试需要手动准备服务器，见下一节。

### 后端

后端包含三类测试：

- 单元测试：[`/packages/backend/test/unit`](/packages/backend/test/unit)
- 单服务器端到端测试：[`/packages/backend/test/e2e`](/packages/backend/test/e2e)
- 多服务器端到端测试：[`/packages/backend/test-federation`](/packages/backend/test-federation)

#### 运行单元测试或单服务器端到端测试

1. 创建配置文件：

```sh
cp .github/misskey/test.yml .config/
```

2. 启动测试数据库和 Redis：

```sh
docker compose -f packages/backend/test/compose.yml up
```

也可以准备可清空的空数据库，并相应调整 `.config/test.yml`。

3. 运行全部测试：

```sh
pnpm --filter backend test     # 单元测试
pnpm --filter backend test:e2e # 单服务器端到端测试
```

运行指定测试：

```sh
pnpm --filter backend test -- packages/backend/test/unit/activitypub.ts
pnpm --filter backend test:e2e -- packages/backend/test/e2e/nodeinfo.ts
```

#### 运行多服务器端到端测试

见 [`/packages/backend/test-federation/README.md`](/packages/backend/test-federation/README.md)。

## 环境变量

- `MISSKEY_CONFIG_YML`：指定配置文件路径以替代 default.yml，例如 `2nd.yml`。
- `MISSKEY_WEBFINGER_USE_HTTP`：设为 true 时，WebFinger 使用 HTTP，便于测试本机服务器间的联邦。严禁用于生产环境。

## 持续集成

Misskey 使用 GitHub Actions 执行自动化测试，配置位于 [`/.github/workflows`](/.github/workflows)。

## Vue

Misskey 使用 Vue 3 作为前端框架。

- 使用 TypeScript。
- **新组件使用组合式 API，配合 [setup 语法糖](https://v3.vuejs.org/api/sfc-script-setup.html)及 [ref 语法糖](https://github.com/vuejs/rfcs/discussions/369)。**
- 部分旧组件仍使用选项式 API，欢迎将其迁移至组合式 API。

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

插入时使用 `insert`，避免使用 `save`，见 #6441。

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

在 packages/backend 中执行：

```sh
pnpm dlx typeorm migration:generate -d ormconfig.js -o --esm <migration name>
```

- 将生成文件移动到 migration 目录。
- 移除生成脚本中的无关修改。
- `-o`（`--outputJs`）生成 JS，`--esm` 生成 ESM。已有迁移均为 ESM JS，因此两个选项都需要。

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
