# NestJS 依赖注入与模块注册

Misskey 后端采用 NestJS 11、Fastify 5、TypeORM 1（PostgreSQL）及 Redis，以依赖注入容器和 Repository 模式为核心。

## 架构

- **依赖注入容器**：NestJS 的 `@Injectable()` 服务和 TypeORM Repository。
- **注入令牌**：从 [`@/di-symbols.js`](../../../../../apps/misskey/packages/backend/src/di-symbols.ts) 导入 `DI`，通过 `@Inject(DI.xxx)` 注入。
- **构建**：`rolldown -c` 打包到 `built/`，使用 `tsc` 检查类型。

## 端点中的依赖注入

API 端点类继承 `Endpoint<typeof meta, typeof paramDef>`，添加 `@Injectable()`，在构造函数中注入 Repository 和服务：

```ts
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
		// 按需注入 RoleService、UserEntityService、GlobalEventService 等
	) {
		super(meta, paramDef, async (ps, me) => {
			// 例如调用 this.notesRepository.findOneBy(...)
		});
	}
}
```

端点使用 `// eslint-disable-line import/no-default-export`，因为 NestJS 需要默认导出，而 ESLint 默认限制此写法。

## 主要注入令牌

由 `@/di-symbols.js` 提供：

| 令牌 | 类型 | 用途 |
|---|---|---|
| `DI.notesRepository` | `NotesRepository` | notes 表的 TypeORM Repository |
| `DI.usersRepository` | `UsersRepository` | users 表 |
| `DI.driveFilesRepository` | `DriveFilesRepository` | drive_file 表 |
| `DI.config` | `Config` | 应用配置 |
| `DI.redis` | `Redis` | Redis 客户端 |
| `DI.db` | `DataSource` | TypeORM 数据源，可执行原始 SQL |

`NoteCreateService`、`RoleService`、`UserEntityService` 等服务**直接按类型注入**：

```ts
constructor(
	private roleService: RoleService,
	private userEntityService: UserEntityService,
) {}
```

## 服务类写法

服务添加 `@Injectable()`，在构造函数声明依赖，并注册为对应 NestJS 模块（如 `apps/misskey/packages/backend/src/core/CoreModule.ts`）的提供者。

```ts
@Injectable()
export class MyService {
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private roleService: RoleService,
	) {}

	async doSomething(noteId: string) {
		const note = await this.notesRepository.findOneBy({ id: noteId });
		// ...
	}
}
```

新增服务时，**必须同时加入模块的 `providers` 数组**。可参考 CoreModule 中已有服务的注册方式。

## 模块结构

- **CoreModule**（`src/core/CoreModule.ts`）：汇集服务。
- **EndpointsModule**（`src/server/api/EndpointsModule.ts`）：通过 `Object.entries()` 遍历 endpoint-list.ts，自动生成 `provide: 'ep:<path>'` 提供者。
- **GlobalModule**（`src/GlobalModule.ts`）：Repository、配置、Redis、DataSource 等底层依赖。
- **QueueModule**（`src/core/QueueModule.ts`）：BullMQ 任务队列。

新增端点无需手动注册到模块，见 [endpoint-list.md](endpoint-list.md)。新增服务必须注册到 CoreModule 或对应模块。

## 参考实现

- [notes/create.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/create.ts)：按类型注入服务，结合 meta.errors、try/catch 转换业务错误，末尾重新抛出未知异常。
- [i/pin.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/i/pin.ts)：通过 catch 回调转换错误，并继续抛出未知错误。
- [notes/global-timeline.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/global-timeline.ts)：通过 `RoleService.getUserPolicies()` 动态判断策略。
