# 添加 REST API 端点

在 `apps/misskey/packages/backend/src/server/api/endpoints/<category>/<name>.ts` 添加端点时遵循本流程。**遗漏 endpoint-list.ts 注册会导致 404。**

## 最重要的要求

1. **端点不通过 glob 自动收集**，必须在 [endpoint-list.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoint-list.ts) 添加一行，见[注册指南](../knowledge/endpoint-list.md)。
2. **修改 meta、paramDef、res 后必须重新生成 misskey-js**。遗漏 `pnpm build-misskey-js-with-types` 会导致 check-misskey-js-autogen 失败。
3. **meta.errors 的每个 id 必须是仓库内唯一的 UUID v4**。使用 crypto.randomUUID() 生成，再通过 grep 检查冲突。

## 工作流

1. 设计：确定读写类型、认证要求和权限。
2. 实现：编写 meta、paramDef 和类主体，包含 SPDX 头。
3. 注册：加入 endpoint-list.ts。
4. 验证：端到端测试、lint、重新生成 misskey-js。

## 1. 设计：选择模板

先明确端点性质，**以已有实现为模板起步**。

| 性质 | 参考实现 |
|---|---|
| 无需认证、无参数、小响应 | [ping.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/ping.ts) |
| 需要认证、依赖注入、业务错误 | [notes/create.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/create.ts) |
| sinceId、untilId、limit 分页 | [notes/timeline.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/timeline.ts) |
| 动态角色策略访问控制 | [notes/global-timeline.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/global-timeline.ts)，使用 RoleService.getUserPolicies |
| 文件上传 | [drive/files/create.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/drive/files/create.ts) |
| 管理员助手或管理员专用 | [admin/suspend-user.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/admin/suspend-user.ts)、[admin/roles/create.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/admin/roles/create.ts) |

category 为 notes、users、admin/announcements 等功能领域，遵循现有目录结构。

## 2. 实现

### 2.1 SPDX 头

新 TypeScript 文件开头必须包含：

```ts
/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
```

misskey-js 的 autogen 也可能产生差异，但该子包使用 MIT 许可证，不添加 AGPL 头。

### 2.2 无需认证的读取端点模板

```ts
/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';

export const meta = {
	tags: ['<tag>'],
	requireCredential: false,

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			// ...
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
	) {
		super(meta, paramDef, async (ps, me) => {
			// 实现逻辑。me 为 MiLocalUser | null，匿名端点必须判空
		});
	}
}
```

### 2.3 包含依赖注入、错误和限流的模板

```ts
import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['notes'],
	requireCredential: true,         // 要求认证时必须指定 kind；secure: true 内部 API 除外
	kind: 'write:notes',             // OAuth 权限范围，列表见 apps/misskey/packages/misskey-js/src/consts.ts 的 permissions
	prohibitMoved: false,            // 是否拒绝已迁移账户
	limit: {
		duration: 1000 * 60 * 60,    // 1 小时
		max: 300,
	},
	errors: {
		noSuchNote: {                            // ← 键使用 camelCase
			message: 'No such note.',            // ← 固定英文消息（后端没有国际化机制）
			code: 'NO_SUCH_NOTE',                // ← code 使用 SCREAMING_SNAKE_CASE
			id: '17a0e0fa-3f3e-4f3e-9f3e-3f3e3f3e3f3e', // ← 使用 crypto.randomUUID() 生成并检查冲突
		},
	},
	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Note',                 // 引用打包实体时
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
	},
	required: ['noteId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			// requireCredential 为 true，me 为非空 MiLocalUser
			const note = await this.notesRepository.findOneBy({ id: ps.noteId });
			if (note == null) throw new ApiError(meta.errors.noSuchNote);
			// 实现逻辑
		});
	}
}
```

依赖注入与模块注册详见 [nestjs-di.md](../knowledge/nestjs-di.md)。

### 2.4 exec 完整签名

super 的回调接受七个参数，见 [endpoint-base.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoint-base.ts) 的 Executor：

```ts
async (ps, me, token, file, cleanup, ip, headers) => { ... }
```

| 参数 | 类型 | 用途 |
|---|---|---|
| ps | SchemaType<typeof paramDef> | 经 AJV 验证的输入 |
| me | MiLocalUser，或 MiLocalUser \| null | 当前本地用户；无需认证时必须判空 |
| token | MiAccessToken \| null | OAuth 令牌，用于识别应用 |
| file | { name, path } \| undefined | requireFile 为 true 时保证存在，基类已判空 |
| cleanup | (() => any) \| undefined | 删除上传临时文件。基类仅在 AJV 验证失败时自动调用；正常或异常结束均需在 finally 中主动调用 |
| ip | string \| null \| undefined | 客户端 IP |
| headers | Record<string, string> \| null \| undefined | 请求头 |

cleanup 参考 [drive/files/create.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/drive/files/create.ts) 的 finally。
大部分端点只需要 ps、me；少数管理、调试或认证端点才使用其他参数。

### 2.5 meta 与 paramDef 规范

tags、requireCredential、kind、limit、errors 等字段，以及 requiredRolePolicy、secure、cacheSec、allowGet 和 AJV 模式，见 [api-meta-paramdef.md](../knowledge/api-meta-paramdef.md)。

### 2.6 错误处理

**向客户端返回的业务错误**必须先在 meta.errors 声明，再抛出 ApiError，否则生成类型缺失且可能返回 500。第二个参数可携带补充信息：

```ts
throw new ApiError(meta.errors.invalidParam, { reason: 'too short' });
```

数据库不一致、底层服务缺陷和防御断言等**意外异常**可保留普通 Error。将所有异常包装为 ApiError 会把未知缺陷隐藏为客户端错误。可参考 notes/create.ts 在 catch 末尾重新抛出未知错误的模式。

## 3. 注册到 endpoint-list.ts

在 [endpoint-list.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoint-list.ts) 的同类端点附近添加：

```ts
export * as '<category>/<name>' from './endpoints/<category>/<name>.js';
```

详见[注册指南](../knowledge/endpoint-list.md)。**遗漏会导致 404。**

## 4. 验证

### 4.1 端到端测试

[测试目录](../../../../../apps/misskey/packages/backend/test/e2e/) 按 note、users、timelines、drive、clips、oauth 等领域分文件。
已有合适分类时在其中添加测试，否则放入 endpoints.ts。describe 使用人类可读标签即可。

```ts
import { describe, test } from 'vitest';
import * as assert from 'node:assert';
import { api, signup } from '../utils.js';

describe('<人类可读标签>', () => {
	test('正常情况', async () => {
		const alice = await signup({ username: 'alice' });
		const res = await api('<category>/<name>', { /* params */ }, alice);
		assert.strictEqual(res.status, 200);
	});
});
```

先准备 .config/test.yml，见[后端测试指南](../knowledge/backend-testing.md)，然后运行：

```bash
pnpm --filter backend test:e2e
```

### 4.2 lint 与类型检查

```bash
# 快速检查单个文件
pnpm exec eslint --fix apps/misskey/packages/backend/src/server/api/endpoints/<category>/<name>.ts
pnpm --filter backend typecheck      # tsc --noEmit（仅后端）

# 整体检查（提交 PR 前）
pnpm --filter backend lint
```

### 4.3 重新生成 misskey-js

修改 meta、paramDef、res 后执行：

```bash
pnpm build-misskey-js-with-types
```

提交 autogen 下的差异，以通过 check-misskey-js-autogen。详细步骤见[生成指南](../../../shipping-misskey-change/references/tasks/regenerate-misskey-js.md)。

## 常见问题

完整的“症状、原因、修复”说明见 [API 速查](../knowledge/api-meta-paramdef.md)。

- 404：遗漏 endpoint-list 注册。
- check-misskey-js-autogen 失败：遗漏类型生成。
- spdx 失败：缺少 SPDX 头。
- 客户端收到 500 且没有错误类型：未在 meta.errors 声明业务错误。
- me.id 抛出 TypeError：匿名端点未判空。
- UUID 重复：遗漏冲突检查。
- 临时文件残留：未在 finally 调用 cleanup。
- requiredRolePolicy 匿名访问返回 500：ApiCallService 直接读取 user!.id，必须配合 requireCredential: true。

## 参考代码

- [endpoints.ts 类型定义](../../../../../apps/misskey/packages/backend/src/server/api/endpoints.ts)
- [Endpoint 基类](../../../../../apps/misskey/packages/backend/src/server/api/endpoint-base.ts)
- [端点注册表](../../../../../apps/misskey/packages/backend/src/server/api/endpoint-list.ts)
- [ApiError](../../../../../apps/misskey/packages/backend/src/server/api/error.ts)
- [最小端点](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/ping.ts)
- [依赖注入与错误处理](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/create.ts)
- [动态策略](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/global-timeline.ts)
- [测试示例](../../../../../apps/misskey/packages/backend/test/e2e/endpoints.ts)
- [测试辅助函数](../../../../../apps/misskey/packages/backend/test/utils.ts)
- [API JSON 生成器](../../../../../apps/misskey/packages/backend/scripts/generate_api_json.js)
