# 后端测试前置条件与编写方法

本页汇集 Misskey 后端测试结构、`.config/test.yml` 前置条件和端到端测试辅助函数。

## 目录

- [测试配置](#测试配置)
- [测试类型与命令](#测试类型与命令)
- [端到端测试位置](#端到端测试位置)
- [共享初始化](#共享初始化)
- [api 辅助函数](#api-辅助函数)
- [其他辅助函数](#其他辅助函数)
- [本地数据库与 Redis](#本地数据库与-redis)

## 测试配置

后端 test、test:e2e、test:fed 使用 `NODE_ENV=test`，运行时直接读取根目录的 `.config/test.yml`。见 [package.json](../../../../../apps/misskey/packages/backend/package.json) 和 [config.ts](../../../../../apps/misskey/packages/backend/src/config.ts)。**缺少配置时测试无法启动。**

尚未创建时，任选一种方式复制一次：

```bash
ncp .github/misskey/test.yml .config/test.yml
# 或
cp .github/misskey/test.yml .config/test.yml
```

- 根目录 `pnpm start:test` 用于 Playwright，运行时会自动通过 ncp 复制配置，见 [package.json](../../../../../package.json)。直接执行后端测试时需手动复制。
- 修改 YAML 配置后，下次启动测试时直接生效。
- 后端端到端测试无需先运行 start:test，额外启动会造成端口冲突。

## 测试类型与命令

| 类型 | 配置 | 命令 |
|---|---|---|
| 单元测试 | apps/misskey/packages/backend/vitest.config.unit.ts | `pnpm --filter backend test` |
| HTTP / 数据库端到端测试 | apps/misskey/packages/backend/vitest.config.e2e.ts | `pnpm --filter backend test:e2e` |
| 联邦测试 | apps/misskey/packages/backend/vitest.config.fed.ts | `pnpm --filter backend test:fed` |

测试位于 apps/misskey/packages/backend/test 下。覆盖率命令为 `pnpm --filter backend test-and-coverage`。

## 端到端测试位置

apps/misskey/packages/backend/test/e2e 中的文件示例：

```
note.ts            帖子相关（创建、转发、可见范围、附件等）
users.ts           用户相关
timelines.ts       时间线
drive.ts           网盘（上传、下载）
clips.ts           收藏夹
oauth.ts           OAuth 流程
streaming.ts       WebSocket
api.ts             API 层（认证、限流等）
api-visibility.ts  可见范围检查
endpoints.ts       其他分类未覆盖的端点
2fa.ts             2FA
block.ts / mute.ts / antennas.ts / clips.ts / move.ts / nodeinfo.ts / ...
```

**没有 admin.ts**。管理端点测试可放入 api.ts（API 层行为）或 endpoints.ts（其他端点）。

### 选择规则

1. 已有 note.ts、users.ts 等合适分类时，在其中添加 describe/test。
2. 无合适分类时放入 endpoints.ts。
3. 测试超过约 200 行且独立性高时，才考虑新建文件。

describe 使用人类可读名称即可，如 Note、管理员操作，无需使用端点路径。

## 共享初始化

Vitest 的 setupFiles 加载 `apps/misskey/packages/backend/test/setup.e2e.ts`，为各文件注册共享 beforeAll，初始化测试数据库并重置环境。
服务器启动和停止由 globalSetup 中 `test-server/entry.ts` 的 setup/teardown 负责。
测试文件自身的 beforeAll 用于准备用户：

```ts
import { describe, test, beforeAll, afterAll } from 'vitest';
import * as assert from 'node:assert';
import { api, signup, post, role, uploadFile } from '../utils.js';
import type { UserToken } from '../utils.js';

describe('功能名称', () => {
	let alice: UserToken;

	beforeAll(async () => {
		alice = await signup({ username: 'alice' });
	});

	test('正常情况', async () => {
		const res = await api('<category>/<name>', { /* params */ }, alice);
		assert.strictEqual(res.status, 200);
	});
});
```

## api 辅助函数

实现见 [test/utils.ts](../../../../../apps/misskey/packages/backend/test/utils.ts)：

```ts
const res = await api('<category>/<name>', params, me?);
// res.status   : HTTP 状态码（200 / 400 / 401 / 403 / 500 等）
// res.headers  : Headers
// res.body     : 响应 JSON（类型由 misskey.Endpoints 自动推导）
```

省略 me 时发送匿名请求，传入 me 时使用对应用户令牌。

### 验证错误响应

```ts
test('帖子不存在时返回错误', async () => {
	const res = await api('notes/show', { noteId: '0000000000000000' }, alice);
	assert.strictEqual(res.status, 400);
	assert.strictEqual(castAsError(res.body as any).error.code, 'NO_SUCH_NOTE');
});
```

使用 utils.ts 的 `castAsError(...).error.code` 验证 meta.errors 中定义的错误码。

## 其他辅助函数

### signup：创建测试用户

```ts
const alice = await signup({ username: 'alice' });        // 默认密码为 test
const bob = await signup({ username: 'bob', password: 'secret123' });
```

返回注册响应，包含令牌，可直接作为 api 的第三个参数。

### post：发布帖子

```ts
const note = await post(alice, { text: 'hello' });
// 返回值为 misskey.entities.Note
```

也可传入 visibility、visibleUserIds、fileIds 等，测试特定可见范围和附件。

### uploadFile：上传到网盘

```ts
const file = await uploadFile(alice);                                       // 上传 resources/192.jpg
const file2 = await uploadFile(alice, { path: '192.png' });                 // resources/192.png
const file3 = await uploadFile(alice, { blob: new Blob([...]) });           // 任意 Blob
// 可将 file.body.id 传入 fileIds
```

### role：创建并分配角色

实现见 [test/utils.ts](../../../../../apps/misskey/packages/backend/test/utils.ts)。

```ts
const myRole = await role(adminUser, { name: 'tester' }, { canCreateChannel: { useDefault: false, priority: 0, value: true } });
// 调用 admin/roles/create，可通过 policies 参数覆盖单项策略
```

需要管理员助手或管理员权限的测试，应提前通过 signup 和 role 准备。

### createAppToken：创建带权限范围的应用令牌

```ts
const token = await createAppToken(alice, ['write:notes', 'read:account']);
// token 为字符串，可用作 api 的 me.token，或传入 { token, bearer: true } 使用 Bearer 认证
```

用于验证 OAuth 权限范围 kind。

### 更多工具

[test/utils.ts](../../../../../apps/misskey/packages/backend/test/utils.ts) 还提供：

- userList：创建用户列表。
- page、play：创建 Page 和 Flash。
- clip、galleryPost、channel：创建对应资源。
- react：添加回应。
- simpleGet：原始 HTTP fetch 包装。
- testPaginationConsistency：全面验证分页行为。
- sendEnvUpdateRequest、sendEnvResetRequest：更新测试环境变量。
- connectStream、waitFire：WebSocket 实时 API。

详细参数请查看源码。

### 现有测试

- [note.ts](../../../../../apps/misskey/packages/backend/test/e2e/note.ts)：describe('Note') 下组织多个测试。
- [endpoints.ts](../../../../../apps/misskey/packages/backend/test/e2e/endpoints.ts)：未按领域分类的端点。
- [api.ts](../../../../../apps/misskey/packages/backend/test/e2e/api.ts)：认证、限流等 API 层行为。

## 本地数据库与 Redis

测试和开发使用不同 compose 文件及端口，混用会导致连接失败。

| 用途 | compose 文件 | 数据库 / Redis 主机端口 |
|---|---|---|
| test、test:e2e、test:fed | [apps/misskey/packages/backend/test/compose.yml](../../../../../apps/misskey/packages/backend/test/compose.yml) | 54312 / 56312，与 [.github/misskey/test.yml](../../../../../.github/misskey/test.yml) 一致 |
| pnpm dev 等开发 | 根目录 compose.local-db.yml | 5432 / 6379 |

```bash
# 测试用数据库和 Redis
docker compose -f apps/misskey/packages/backend/test/compose.yml up -d

# 开发用数据库和 Redis，仅启动 postgres、redis、meilisearch
docker compose -f compose.local-db.yml up -d
```

开发配置使用标准端口；测试配置使用 test-misskey 数据库及专用端口。
CI 的 `.github/workflows/test-backend.yml` 通过 GitHub Actions services 启动相同测试端口的 PostgreSQL 和 Redis 容器。
