# TypeORM 与迁移模式

Misskey 后端使用 TypeORM 1 和 PostgreSQL。本页说明实体与迁移的关系，以及迁移中的复杂情况。

## 模型与 Repository

- 实体位于 `apps/misskey/packages/backend/src/models/<Name>.ts`，使用 `@Entity`、`@Column`。
- 通过依赖注入的 Repository 访问，例如 `@Inject(DI.notesRepository)`，见 [nestjs-di.md](nestjs-di.md)。

实体的 `@Column`、`@Entity`、`@Index` 必须与迁移 DDL 一致。`pnpm --filter backend check-migrations` 检测差异，实现见 [check_migrations_clean.js](../../../../../apps/misskey/packages/backend/scripts/check_migrations_clean.js)。

## 迁移文件结构

`apps/misskey/packages/backend/migration/{unixMs}-{descriptive-name}.js` 使用 ESM JavaScript：

```js
/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class PascalCaseName1234567890123 {
    name = 'PascalCaseName1234567890123'

    async up(queryRunner) {
        await queryRunner.query(`...`);
    }

    async down(queryRunner) {
        await queryRunner.query(`...`);  // 完整撤销 up
    }
}
```

详细步骤见 [creating-migration.md](../tasks/creating-migration.md)。**严禁编辑已合并迁移。**

## CREATE INDEX CONCURRENTLY

大表上普通 CREATE INDEX 可能长时间锁表。PostgreSQL 禁止在事务内执行 CREATE INDEX CONCURRENTLY，因此必须在迁移类中关闭该迁移的事务。

参考 [1745378064470-composite-note-index.js](../../../../../apps/misskey/packages/backend/migration/1745378064470-composite-note-index.js)：

```js
const isConcurrentIndexMigrationEnabled = process.env.MISSKEY_MIGRATION_CREATE_INDEX_CONCURRENTLY === '1';

export class CompositeNoteIndex1745378064470 {
    name = 'CompositeNoteIndex1745378064470';
    transaction = isConcurrentIndexMigrationEnabled ? false : undefined;

    async up(queryRunner) {
        const concurrently = isConcurrentIndexMigrationEnabled;
        if (concurrently) {
            // CREATE INDEX CONCURRENTLY ...
        } else {
            // CREATE INDEX ...
        }
    }

    async down(queryRunner) {
        // 同样按环境变量分支
    }
}
```

要点：

- 必须设置 `transaction = isConcurrentIndexMigrationEnabled ? false : undefined;`，否则出现 `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`。
- 环境变量 `MISSKEY_MIGRATION_CREATE_INDEX_CONCURRENTLY=1` 默认关闭。关闭时应在事务内使用普通 CREATE INDEX。up 和 down 均需按环境变量分支。
- [ormconfig.js](../../../../../apps/misskey/packages/backend/ormconfig.js) 的 `migrationsTransactionMode` 在该环境变量启用时为 `'each'`，否则为 `'all'`，将全部迁移包在同一事务。日常按 all 模式考虑。

## 复杂情况

生成式与手写迁移都需注意以下问题。通用要求是：**down 应完整撤销 up**，很多情况不能简单倒转 SQL。

### 1. 添加 NOT NULL 列

已有数据的表添加无默认值的 NOT NULL 列会失败。

- **可使用默认值**：添加 DEFAULT，一条语句即可完成，这是常见方式。

  ```js
  // up
  await queryRunner.query(`ALTER TABLE "note_draft" ADD "isActuallyScheduled" boolean NOT NULL DEFAULT false`);
  // down
  await queryRunner.query(`ALTER TABLE "note_draft" DROP COLUMN "isActuallyScheduled"`);
  ```

  参考 [1758677617888-scheduled-post.js](../../../../../apps/misskey/packages/backend/migration/1758677617888-scheduled-post.js)。

- **需要逐行计算或随后移除默认值**：先添加可空列，再 UPDATE 回填，最后 SET NOT NULL。down 可删除列。大表的回填及非空检查会扫描大量行，可能长时间锁表。

实体设置 `@Column({ default: ... })` 后，生成器会输出 DEFAULT。若应用始终传值、不需要数据库默认值，也可在生成后手动去掉 DEFAULT；已有迁移存在两种风格。

### 2. 添加或修改枚举值

PostgreSQL 无法直接删除枚举值，因此 ADD VALUE 难以撤销。默认 all 事务模式下，也不能立即使用同一事务中新添加的枚举值。

TypeORM 生成器采用可回滚的“重命名旧类型 → 创建新类型 → USING 转换列类型 → 删除旧类型”流程，手写时也应遵循。

```js
// up: 添加 app 值的示例，切换到包含新值的类型
await queryRunner.query(`ALTER TYPE "public"."notification_type_enum" RENAME TO "notification_type_enum_old"`);
await queryRunner.query(`CREATE TYPE "public"."notification_type_enum" AS ENUM('follow', 'mention', /* ... */ 'app')`);
await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type_enum" USING "type"::"text"::"public"."notification_type_enum"`);
await queryRunner.query(`DROP TYPE "public"."notification_type_enum_old"`);
```

```js
// down: 按相同步骤恢复为不含新值的旧类型
await queryRunner.query(`ALTER TYPE "public"."notification_type_enum" RENAME TO "notification_type_enum_old"`);
await queryRunner.query(`CREATE TYPE "public"."notification_type_enum" AS ENUM('follow', 'mention', /* ... 不包含 app ... */)`);
await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type_enum" USING "type"::"text"::"public"."notification_type_enum"`);
await queryRunner.query(`DROP TYPE "public"."notification_type_enum_old"`);
```

注意：

1. 列有默认值时，转换前 DROP DEFAULT，转换后 SET DEFAULT。
2. 数组列（如 mutingNotificationTypes）需使用数组类型与数组转换：`TYPE "..."[] USING "col"::"text"::"..."[]`。
3. down 删除的枚举值若仍被数据使用，USING 转换会失败。上线使用后回滚，应先将相关行 UPDATE 为替代值，再转换类型。刚添加新值、尚未使用时回滚较安全。

完整示例见 [1674118260469-achievement.js](../../../../../apps/misskey/packages/backend/migration/1674118260469-achievement.js)；新建类型见 [1580276619901-v12-10.js](../../../../../apps/misskey/packages/backend/migration/1580276619901-v12-10.js)。

### 3. 数据迁移与回填

迁移中的 UPDATE 可能影响生产表全部数据，造成长时间锁和大事务。

- 仅填默认值时使用 `UPDATE ... WHERE col IS NULL`，确保重复执行安全。
- 尽量避免大表全量更新。确有需要时，考虑分批或单独运维，并在 PR 中讨论。
- 有信息损失、无法恢复原值的数据迁移，应在 down 注释中明确说明，至少恢复数据库结构。

```js
// up: 添加可空列 → 回填 → 设置 NOT NULL
await queryRunner.query(`ALTER TABLE "user_profile" ADD "github" boolean`);
await queryRunner.query(`UPDATE "user_profile" SET "github" = FALSE WHERE "github" IS NULL`);
await queryRunner.query(`ALTER TABLE "user_profile" ALTER COLUMN "github" SET NOT NULL`);
```

### 4. JSONB 与数组列默认值

默认值字面量应遵循已有格式，避免与生成器输出不一致：

```js
await queryRunner.query(`ALTER TABLE "user_profile" ADD "room" jsonb NOT NULL DEFAULT '{}'`);          // 对象
await queryRunner.query(`ALTER TABLE "bubble_game_record" ADD "logs" jsonb NOT NULL DEFAULT '[]'`);     // 数组(JSON)
await queryRunner.query(`ALTER TABLE "meta" ADD "pinnedUsers" character varying(256) array NOT NULL DEFAULT '{}'::varchar[]`); // PostgreSQL 数组类型
```

参考 [1565634203341-room.js](../../../../../apps/misskey/packages/backend/migration/1565634203341-room.js)、[1704959805077-bubble-game-record.js](../../../../../apps/misskey/packages/backend/migration/1704959805077-bubble-game-record.js)、[1557476068003-PinnedUsers.js](../../../../../apps/misskey/packages/backend/migration/1557476068003-PinnedUsers.js)。down 均为 DROP COLUMN。

### 5. 安全的 DROP 与 COMMENT

- 对已知只在部分情况下存在的对象，可使用 `DROP ... IF EXISTS`。生成器通常不添加此条件，不要无差别补上，以免掩盖应被发现的不一致。
- Misskey 反规范化列通常使用 `[Denormalized]` 注释。实体的 `@Column({ comment: '[Denormalized]' })` 会生成 COMMENT ON COLUMN；up 添加后，down 应对称处理。

  ```js
  await queryRunner.query(`COMMENT ON COLUMN "note"."renoteChannelId" IS '[Denormalized]'`);
  ```

参考 [1761569941833-add-channel-muting.js](../../../../../apps/misskey/packages/backend/migration/1761569941833-add-channel-muting.js)。

### 6. 重命名列

生成器常将实体属性改名解释为“删除旧列、添加新列”，这会**丢失数据**。若意图为重命名，应将生成 SQL 改为 `ALTER TABLE "t" RENAME COLUMN "old" TO "new"`，down 使用逆向改名。必须审查生成结果。
