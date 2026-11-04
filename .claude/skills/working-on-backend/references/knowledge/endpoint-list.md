# 注册到 `endpoint-list.ts`

这是新增 API 端点时**最容易遗漏的步骤**。端点不会通过 glob 自动收集，漏加注册行会导致 404。

## 为什么需要注册

[`packages/backend/src/server/api/EndpointsModule.ts`](../../../../../packages/backend/src/server/api/EndpointsModule.ts) 使用 `Object.entries()` 遍历 [`endpoint-list.ts`](../../../../../packages/backend/src/server/api/endpoint-list.ts) 的全部导出，生成 NestJS 提供者（`provide: 'ep:<path>'`）。**此列表是 API 路由的唯一依据**，未列出的端点会被视为不存在。

## 注册方法

在 [endpoint-list.ts](../../../../../packages/backend/src/server/api/endpoint-list.ts) 的**同类端点中**添加一行：

```ts
export * as '<category>/<name>' from './endpoints/<category>/<name>.js';
```

`<category>` 是功能领域，例如 `notes`、`users`、`admin/announcements`；`<name>` 是端点名，例如 `create`、`show`、`delete`。两者均使用短横线命名和斜杠分隔，与文件系统路径一致。

例如，添加 `endpoints/notes/create.ts` 时：

```ts
export * as 'notes/create' from './endpoints/notes/create.js';
```

## 排列顺序

**没有严格的排序要求**。同一目录（如 `admin/queue/*`）中很多条目按添加历史排列，并未按字母排序。

- **新增条目**：添加到同类端点末尾即可。
- **相邻条目**：也可放在同类的相关端点附近。
- **避免过度整理**：无需将已有列表整体重新排序，以免增加审查成本。

## 检查注册

添加文件后，通过 grep 检查注册行是否存在：

```bash
grep -F "'<category>/<name>'" packages/backend/src/server/api/endpoint-list.ts
```

没有结果即表示遗漏注册。

## 现有说明

`endpoint-list.ts` 的开头注释说明了该列表是 API 路由的唯一依据。开发新端点时，先打开此文件了解分类结构，再编写端点文件，更便于正确注册。

## 相关文档

- 新增端点完整步骤 → [tasks/adding-api-endpoint.md](../tasks/adding-api-endpoint.md)
- NestJS 依赖注入和模块结构 → [nestjs-di.md](nestjs-di.md)
