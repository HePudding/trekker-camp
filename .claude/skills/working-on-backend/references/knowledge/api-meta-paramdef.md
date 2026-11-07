# API 端点 meta、paramDef 与 res 速查

汇集 [IEndpointMeta](../../../../../apps/misskey/packages/backend/src/server/api/endpoints.ts) 全部字段、AJV 实用模式及常见审查问题，供新增和修改端点时参考。

## 目录

- [字段列表](#字段列表)
- [权限字段组合](#权限字段组合)
- [kind 权限范围](#kind-权限范围)
- [errors](#errors)
- [res](#res)
- [paramDef 模式](#paramdef-模式)
- [OpenAPI 映射](#openapi-映射)
- [常见问题](#常见问题)

## 字段列表

来自 [endpoints.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints.ts) 的 IEndpointMetaBase。

| 字段 | 类型 | 默认值 | 用途 |
|---|---|---|---|
| stability | deprecated / experimental / stable | 未指定 | 稳定性提示，避免新增对 deprecated API 的使用 |
| tags | ReadonlyArray<string> | — | OpenAPI 标签，实际仅使用首项 |
| errors | Record<key, { message, code, id }> | — | 客户端业务错误，每个 id 为唯一 UUID v4 |
| res | Schema | — | 响应 JSON Schema，也可引用打包实体 |
| requireCredential | boolean | false | 要求认证；为 true 时必须设置 kind |
| requireModerator | boolean | false | 要求 isModerator 角色；为 true 时需 kind |
| requireAdmin | boolean | false | 要求 isAdministrator 角色；为 true 时需 kind |
| requiredRolePolicy | KeyOf<'RolePolicies'> | 未指定 | 要求特定角色策略，如 canCreateChannel |
| prohibitMoved | boolean | false | 拒绝已迁移用户，写操作需考虑 |
| limit | { key?, duration?, max?, minInterval? } | 无 | 限流，duration 与 max 配套设置 |
| requireFile | boolean | false | 要求 multipart/form-data 文件；为 true 时保证 exec 的 file 参数存在 |
| secure | boolean | false | 禁止第三方应用访问，OpenAPI 显示 Internal Endpoint |
| kind | (typeof permissions)[number] | — | OAuth 权限范围，与 require 系列字段存在联合类型约束 |
| description | string | — | OpenAPI 操作描述 |
| allowGet | boolean | false | 默认仅 POST，启用后允许 GET，适合幂等读取 |
| cacheSec | number | — | 成功响应添加 Cache-Control: public, max-age=<秒> |

Schema 见 @/misc/json-schema.js，联合类型约束见 [endpoints.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints.ts)。

## 权限字段组合

| 场景 | requireCredential | requireModerator | requireAdmin | kind |
|---|---|---|---|---|
| 匿名 | false 或省略 | 省略 | 省略 | 不需要 |
| 登录用户 | true | 省略 | 省略 | 必需，如 read:account |
| 管理员助手及以上 | 省略 | true | 省略 | 必需，如 read:admin:show-user |
| 管理员 | 省略 | 省略 | true | 必需，如 write:admin:emoji |
| secure: true 内部端点 | 任意 | 任意 | 任意 | 不需要 |

**secure: true 例外**：它是独立联合类型分支，不要求 kind。参考 [auth/accept.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/auth/accept.ts)、[i/export-user-lists.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/i/export-user-lists.ts)。第三方应用无法访问，因此无需 OAuth scope。

- requiredRolePolicy 按指定策略限制用户，**必须配合 requireCredential: true**。[ApiCallService.ts](../../../../../apps/misskey/packages/backend/src/server/api/ApiCallService.ts) 会直接访问 user!.id；允许匿名时会产生 TypeError 和 500。需要匿名用户时，在执行阶段调用 `RoleService.getUserPolicies(me ? me.id : null)`，参考 [global-timeline.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/global-timeline.ts)。策略列表见 [RolePolicies](../../../../../apps/misskey/packages/backend/src/core/RoleService.ts)。
- secure: true 仅供 Misskey 自身前端调用，OAuth 令牌无法访问，无需 kind。

## kind 权限范围

完整列表见 [consts.ts](../../../../../apps/misskey/packages/misskey-js/src/consts.ts) 的 permissions。

| 类型 | 示例 |
|---|---|
| 普通读取 | read:account、read:notifications、read:drive、read:reactions |
| 普通写入 | write:account、write:notes、write:reactions、write:drive |
| 管理读取 | read:admin:meta、read:admin:server-info、read:admin:show-user、read:admin:user-ips |
| 管理写入 | write:admin:reset-password、write:admin:suspend-user、write:admin:emoji、write:admin:roles |

新增操作领域时同步扩充 permissions。

## errors

```ts
errors: {
	noSuchNote: {                                            // ← 键使用 camelCase
		message: 'No such note.',                            // ← 固定英文消息（后端没有国际化机制）
		code: 'NO_SUCH_NOTE',                                // ← code 使用 SCREAMING_SNAKE_CASE
		id: '17a0e0fa-3f3e-4f3e-9f3e-3f3e3f3e3f3e',          // ← UUID v4，仓库内唯一
		httpStatusCode: 404,                                 // ← 可选，覆盖 HTTP 状态码
		kind: 'client',                                      // ← 可选：client（默认）、server、permission
	},
},
```

httpStatusCode 与 kind 通过 [error.ts](../../../../../apps/misskey/packages/backend/src/server/api/error.ts) 的 E 类型接受。未设置时使用默认行为，客户端错误通常为 400 系列。

命名约定：

- 键为 camelCase，如 noSuchNote、cannotReRenote、alreadyBlocking、youHaveBeenBlocked。
- code 为 SCREAMING_SNAKE_CASE，如 NO_SUCH_NOTE、CANNOT_RENOTE_TO_A_PURE_RENOTE。
- 常见模式为 NO_SUCH_*、CANNOT_*、ALREADY_*、TOO_MANY_*、INVALID_*、*_REQUIRED。

ApiError 的第二个参数进入响应 error.info，可传入 reason 等补充信息。

## res

可直接定义 JSON Schema，或引用打包实体：

```ts
// 简单对象
res: {
	type: 'object',
	optional: false, nullable: false,
	properties: {
		count: { type: 'integer' },
	},
},

// 打包实体引用
res: {
	type: 'object',
	optional: false, nullable: false,
	ref: 'Note',                  // ← apps/misskey/packages/backend/src/models/json-schema/*.ts 中的定义名
},

// 数组
res: {
	type: 'array',
	optional: false, nullable: false,
	items: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Note',
	},
},
```

每个属性**显式声明 optional 和 nullable**，避免架构约束和生成的 misskey-js 类型过于宽松。

## paramDef 模式

paramDef 是 JSON Schema 7 兼容架构，通过 `new Ajv({ useDefaults: true })` 编译。初始化见 [endpoint-base.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoint-base.ts)。

### 自定义格式

Misskey 自定义格式只有 misskey:id：

```ts
ajv.addFormat('misskey:id', /^[a-zA-Z0-9]+$/);
```

其他 date-time、email、url 等为标准格式名。本项目 AJV 配置主要对 ID 模式执行实际正则验证，其他格式名可通过而不触发格式验证错误。

### 基础模式

```ts
export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },         // 必填 ID
		text: { type: 'string', minLength: 1, maxLength: 500 },   // 字符串长度约束
		count: { type: 'integer', minimum: 0, maximum: 100, default: 10 },
		isPublic: { type: 'boolean', default: false },
		visibility: { type: 'string', enum: ['public', 'home', 'followers', 'specified'] },
	},
	required: ['noteId'],
} as const;
```

必须添加 as const，保证 SchemaType<typeof paramDef> 的类型推导。

### 分页

参考 [notes/timeline.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/timeline.ts)：

```ts
properties: {
	limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
	sinceId: { type: 'string', format: 'misskey:id' },
	untilId: { type: 'string', format: 'misskey:id' },
	sinceDate: { type: 'integer' },
	untilDate: { type: 'integer' },
},
```

使用 QueryService.makePaginationQuery(qb, ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate) 传入 TypeORM 查询构建器。

### 数组约束

```ts
properties: {
	// 唯一 ID 列表，最少 1 个，最多 100 个
	noteIds: {
		type: 'array',
		uniqueItems: true,
		minItems: 1,
		maxItems: 100,
		items: { type: 'string', format: 'misskey:id' },
	},
},
```

参考 [show-partial-bulk.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/show-partial-bulk.ts) 的 noteIds，以及 [drafts/create.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/drafts/create.ts) 的 fileIds、visibleUserIds。

### oneOf 与 anyOf

允许多种参数形态：

```ts
properties: {
	userId: { type: 'string', format: 'misskey:id' },
	username: { type: 'string' },
	host: { type: 'string', nullable: true },
},
anyOf: [
	{ required: ['userId'] },
	{ required: ['username'] },
],
```

响应也可使用 oneOf 表达变体，参考 [ap/show.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/ap/show.ts)：

```ts
res: {
	optional: false, nullable: false,
	oneOf: [
		{ type: 'object', properties: { type: { enum: ['User'] }, object: { ref: 'UserDetailedNotMe' } } },
		{ type: 'object', properties: { type: { enum: ['Note'] }, object: { ref: 'Note' } } },
	],
},
```

### 动态键 additionalProperties

表达“任意键对应某类型值”：

```ts
data: {
	type: 'object',
	additionalProperties: {
		anyOf: [{ type: 'number' }],
	},
},
```

参考 [retention.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/retention.ts)、[admin/get-table-stats.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/admin/get-table-stats.ts)。
additionalProperties: true 接受任意内容而不验证。

### 默认值

AJV 启用 useDefaults，请求缺失字段时自动补值：

```ts
properties: {
	includeMyRenotes: { type: 'boolean', default: true },
},
```

适合保持向后兼容。

### 可空属性

```ts
properties: {
	parentId: { type: 'string', format: 'misskey:id', nullable: true },
},
```

nullable: true 显式接受 null。

## OpenAPI 映射

实现见 [gen-spec.ts](../../../../../apps/misskey/packages/backend/src/server/api/openapi/gen-spec.ts)。

| meta 字段 | OpenAPI 结果 |
|---|---|
| description | 操作描述开头 |
| secure: true | 描述中增加 Internal Endpoint 警告 |
| requireCredential: true | 描述增加 Credential required: Yes，并设置 bearerAuth |
| kind | 描述增加 Permission |
| tags[0] | 操作标签，仅首项 |
| requireFile: true | 请求体为 multipart/form-data，添加二进制 file 字段 |
| errors | responses 中的示例 |
| res | 响应体架构 |
| limit | 添加 429 Too many requests 响应 |
| allowGet | 同路径添加 GET，保留 POST |

requireModerator、requireAdmin、requiredRolePolicy、prohibitMoved、cacheSec、stability 仅内部使用，不映射到 OpenAPI。

## 常见问题

### 1. 端点返回 404

- 症状：GET 的兜底路径返回 UNKNOWN_API_ENDPOINT，或 POST 返回普通 404。
- 原因：端点不自动收集，遗漏注册。
- 修复：见 [endpoint-list.md](endpoint-list.md)。

### 2. check-misskey-js-autogen 失败

- 症状：PR 提示 Please regenerate misskey-js。
- 原因：修改了 meta、paramDef、res 却未更新生成文件。
- 修复：见[重新生成指南](../../../shipping-misskey-change/references/tasks/regenerate-misskey-js.md)。

### 3. spdx 失败

- 症状：SPDX header missing。
- 原因：新 TypeScript 文件没有 SPDX 头。
- 修复：添加文件头；misskey-js 使用独立 MIT 许可证，不添加 AGPL 头。

### 4. 500 响应与缺少错误类型

- 症状：前端无法按生成类型读取 result.error.code，响应为 500。
- 原因：错误未在 meta.errors 声明。
- 修复：先声明，再抛出 ApiError(meta.errors.<key>)。
- 同时保留未知异常原样抛出，避免把内部缺陷包装成客户端错误；参考 notes/create.ts 的 catch 末尾。

### 5. me.id 访问 null

匿名端点的 me 可为 null。添加判空；确需认证时设置 requireCredential: true。

### 6. UUID 冲突

复用 errors.id 会造成生成类型混淆。检查：

  ```bash
  grep -r "id: '<生成的 UUID>'" apps/misskey/packages/backend/src/server/api/endpoints/
  ```

使用 `node -e "console.log(crypto.randomUUID())"` 生成新值。

### 7. 将 policies 放进 paramDef

让客户端传入 gtlAvailable 等策略会产生可绕过的权限检查。
角色策略应动态获取：从参数定义移除，在 exec 内调用 RoleService.getUserPolicies(me?.id)。

### 8. 后端错误消息使用日语

后端没有国际化机制，message 统一使用英文。前端根据 error.id 或 error.code 翻译，避免把未本地化的日语直接返回用户。

### 9. 遗漏 as const

会破坏 Endpoint 类型推导，ps 可能变为 any。meta 和 paramDef 定义末尾都需 as const。

### 10. 认证端点遗漏 kind

联合类型约束会产生 Property 'kind' is missing。设置适当 OAuth scope。
secure: true 内部端点属于独立分支，无需 kind，见 [endpoints.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints.ts)。

### 11. 上传临时文件残留

基类仅在 AJV 验证失败时自动 cleanup。正常完成或端点内部抛错时都需 finally 调用 cleanup!()，参考 [drive/files/create.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/drive/files/create.ts)，避免占满磁盘。

### 12. requiredRolePolicy 允许匿名导致 500

[ApiCallService.ts](../../../../../apps/misskey/packages/backend/src/server/api/ApiCallService.ts) 直接读取 user!.id。
静态策略必须与 requireCredential: true 配合；需要匿名策略时改为运行时判断，参考 [global-timeline.ts](../../../../../apps/misskey/packages/backend/src/server/api/endpoints/notes/global-timeline.ts)。

### 13. 端到端测试无法启动

立即失败或数据库连接错误可能来自缺少 .config/test.yml，见[后端测试指南](backend-testing.md)。
