# 创建数据库迁移

在 apps/misskey/packages/backend/migration 下添加 TypeORM 迁移时遵循本流程。

## 强制要求

- **禁止编辑已合并到 develop 或 master 的迁移**，见 [AGENTS.md](../../../../../AGENTS.md)。改写生产历史会导致严重数据不一致；结构修改始终使用新时间戳创建文件。
- 不事后修改文件名中的时间戳，避免破坏顺序。
- 即使已合并迁移存在明显缺陷，也通过新迁移修正，不改写其 up/down。

## 选择方式

| 情况 | 方式 |
|---|---|
| 先修改实体的 Column、Index、Entity，再按差异生成 | migration:generate |
| 手写 SQL、数据迁移、并发建索引等实体差异难以表达的修改 | migration:create 创建空模板 |

通常先改实体再生成。已有迁移主要通过 queryRunner.query 执行原始 SQL，两种方式都需保持该风格。

## 类命名

- 文件：`apps/misskey/packages/backend/migration/{unixMs}-{descriptive-name}.js`。
- 描述名称在历史中混用 PascalCase、camelCase、kebab-case，使用能表达修改的英文名称即可。
- **类名为 PascalCase 加 13 位时间戳**，如 BirthdayIndex1767169026317。
- **name 属性与类名完全相同**。

```js
/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class PascalCaseName1234567890123 {
    name = 'PascalCaseName1234567890123'

    async up(queryRunner) {
        // 正向迁移
    }

    async down(queryRunner) {
        // 完整撤销 up
    }
}
```

## A. 按实体差异生成

```bash
# 可从根目录执行，--filter backend exec 会切换到 apps/misskey/packages/backend。
# 输出路径和 ormconfig.js 均相对于 apps/misskey/packages/backend 解析。
pnpm --filter backend exec typeorm migration:generate -d ormconfig.js -o --esm migration/<PascalName>
```

使用工作区已安装的 typeorm，保持与后端依赖版本一致。

**必须同时指定 -o 和 --esm**：前者输出 JavaScript，后者输出 ESM，与现有迁移一致。遗漏 --esm 会生成 CommonJS。

### 准备环境

生成需要后端构建和本地数据库。仓库提供 Node 脚本，原生 Windows 也可使用，在根目录执行：

```bash
node .claude/skills/working-on-backend/scripts/prepare-generate.mjs
```

脚本执行：

- pnpm build-pre，生成 loadConfig 所需的 built/meta.json。
- 后端 compile-config，生成 ormconfig.js 所需的 built/.config.json。输入为 .config/default.yml；缺失时先按 .config/example.yml 创建。
- 后端 build，使 built 中的实体更新，CLI 从此读取。
- `docker compose -f compose.local-db.yml up -d --wait db`，启动 PostgreSQL。--wait 要求 Docker Compose v2.1.1（2021-11）及以上，不支持已停止维护的 v1。

仅创建空模板时无需数据库或构建，也无需此脚本。

## B. 创建空模板

```bash
pnpm --filter backend exec typeorm migration:create -o --esm migration/<PascalName>
```

无需数据库和构建，仅生成空 up/down。
必须指定 -o --esm，否则生成 TypeScript/CommonJS，ormconfig.js 只读取 migration/*.js，还需手动转换。

migration:create **不会生成 name 属性**，需手动补充与类名相同的 name，并实现 up/down。移除模板中已有文件不使用的 @typedef、@implements MigrationInterface JSDoc，保持项目风格。

此前 migrate-new 包装命令已停用。手动按“migration:create → SPDX → name 属性 → check-migrations”执行即可。

## 添加 SPDX 头

CLI 不会生成 SPDX，必须在开头添加，否则 spdx CI 失败：

```js
/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
```

## up/down 对应关系

- up 每条语句都需在 down 中完整撤销。
- 列、表、外键、索引的添加与删除成对编写。
- 禁止留下空 down，避免生产回滚受阻。

枚举、非空列、数据回填、JSONB/数组默认值、列重命名、安全 DROP/COMMENT 等复杂情况，必须参考 [TypeORM 模式](../knowledge/typeorm-patterns.md)。枚举变更和列重命名尤其需要审查生成结果，以免回滚失败或丢失数据。

### 并发建立索引

大表普通 CREATE INDEX 可能长时间锁表。使用 CONCURRENTLY 时需关闭该迁移的事务，详情见 [TypeORM 模式](../knowledge/typeorm-patterns.md)。
参考 [1745378064470-composite-note-index.js](../../../../../apps/misskey/packages/backend/migration/1745378064470-composite-note-index.js)。

## 验证

从根目录运行：

```bash
# 检查迁移是否遗漏应生成的 DDL
pnpm --filter backend check-migrations

# 应用到本地数据库
pnpm migrate

# 回滚，检查 down
pnpm revert

# 重新正向应用
pnpm migrate
```

[check_migrations_clean.js](../../../../../apps/misskey/packages/backend/scripts/check_migrations_clean.js) 通过 TypeORM 的 createSchemaBuilder().log() 获取待执行 DDL，upQueries 或 downQueries 有残留时以非零退出。该检查验证实体和迁移是否同步，不检查迁移排序。

## 参考模板

新增迁移前，至少打开一个类似实现作为风格参考：

| 模式 | 文件 |
|---|---|
| 索引与函数 | [1767169026317-birthday-index.js](../../../../../apps/misskey/packages/backend/migration/1767169026317-birthday-index.js) |
| 仅新增列 | [1766652173085-add-category-to-avatar-decorations.js](../../../../../apps/misskey/packages/backend/migration/1766652173085-add-category-to-avatar-decorations.js) |
| 新建表与外键 | [1761569941833-add-channel-muting.js](../../../../../apps/misskey/packages/backend/migration/1761569941833-add-channel-muting.js) |

## 提交前自查

- [ ] 使用新时间戳，未编辑已合并迁移。
- [ ] 包含 SPDX 头。
- [ ] 类名与 name 完全一致，符合 PascalCase 加 13 位时间戳。
- [ ] down 非空且能对应撤销 up，复杂情况已参考 [TypeORM 模式](../knowledge/typeorm-patterns.md)。
- [ ] check-migrations 通过，待执行 DDL 为 0。
- [ ] 如可行，migrate → revert → migrate 全部通过。
