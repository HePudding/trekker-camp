---
name: working-on-backend
description: 编辑或添加 apps/misskey/packages/backend/ 下的代码时必须使用，包括 REST API 端点、NestJS 服务和模块、TypeORM 实体、迁移及后端测试。涵盖 NestJS 依赖注入、TypeORM 实体规范、endpoint-list 注册、meta/paramDef/res、misskey-js 重新生成、迁移 up/down 规则，以及 .config/test.yml 前置条件。任何后端修改前都必须阅读，以避免 CI 失败和生产事故。即使此前已经调用 brainstorming、writing-plans 或其他上游技能，进入实现阶段时仍必须调用本技能。
---

# working-on-backend

编辑 `apps/misskey/packages/backend/`（Misskey 服务端）时，首先阅读本技能。这里汇集 NestJS、TypeORM、API 端点、迁移和后端测试的**操作步骤**与**背景知识**。

SKILL.md 本身仅作为参考文件索引。具体步骤和规范应按需读取对应文件。

**使用过其他技能也不能免除本要求。** 即使已调用 `brainstorming`、`writing-plans` 或其他上游技能，进入涉及 `apps/misskey/packages/backend/` 的实现阶段时，仍须调用本技能。

## 按任务组织的工作流（tasks）

每份文件包含完整任务清单和检查点。添加新功能时阅读。

- 添加 REST API 端点 → [references/tasks/adding-api-endpoint.md](references/tasks/adding-api-endpoint.md)
- 创建数据库迁移（TypeORM CLI 生成或手写）→ [references/tasks/creating-migration.md](references/tasks/creating-migration.md)

## 通用知识（knowledge）

供多个任务引用的规范和背景说明。

- NestJS 依赖注入、模块注册及 `@Injectable` 模式 → [references/knowledge/nestjs-di.md](references/knowledge/nestjs-di.md)
- TypeORM 实体、`@Column`、`@Index` 模式及复杂情况 → [references/knowledge/typeorm-patterns.md](references/knowledge/typeorm-patterns.md)
- API 端点的 `meta`、`paramDef`、`res` 完整速查及常见问题 → [references/knowledge/api-meta-paramdef.md](references/knowledge/api-meta-paramdef.md)
- `endpoint-list.ts` 注册方法（遗漏会导致 404）→ [references/knowledge/endpoint-list.md](references/knowledge/endpoint-list.md)
- 后端测试前置条件（`.config/test.yml`）、编写方法和端到端测试辅助函数 → [references/knowledge/backend-testing.md](references/knowledge/backend-testing.md)

## 必须完成的最终检查

提交后端修改或创建 PR 前，必须遵循 [shipping-misskey-change](../shipping-misskey-change/SKILL.md) 的最终检查清单。

添加或修改 API 端点后，可在此阶段通过 Task 启动 [misskey-api-reviewer](../../agents/misskey-api-reviewer.md) 代理。它从审查角度检查本技能的规范，帮助发现遗漏的 endpoint-list 注册和 misskey-js 重新生成。
