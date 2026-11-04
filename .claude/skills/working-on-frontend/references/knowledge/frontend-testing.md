# 前端测试（Vitest / Playwright）

Misskey 前端的测试配置如下。

## Vitest（单元测试）

```bash
pnpm --filter frontend test                # 运行一次
pnpm --filter frontend test-and-coverage   # 包含覆盖率
```

### 文件位置

- 主要位于 `packages/frontend/test/*.test.ts`，例如 `i18n.test.ts`、`theme.test.ts`、`is-birthday.test.ts`。
- 构建工具等适合与目标代码放在一起的测试，在同目录下使用 `*.test.ts`，例如 [packages/frontend/lib/rollup-plugin-unwind-css-module-class-name.test.ts](../../../../../packages/frontend/lib/rollup-plugin-unwind-css-module-class-name.test.ts)。
- 共享组件（`MkX.vue`）的单元测试目前较少，未采用 `*.spec.ts` 或 `__tests__/` 形式，由 Storybook 和 Playwright 覆盖。

## Playwright 端到端测试

Playwright 访问**已启动的测试服务器**，前置条件多于单元测试。在本地按 [.github/workflows/test-frontend.yml](../../../../../.github/workflows/test-frontend.yml) 的 `e2e` 任务执行：

```bash
# 1. 启动测试数据库和 Redis，使用测试端口
docker compose -f packages/backend/test/compose.yml up -d

# 2. 尚未创建测试配置时复制；可按环境替换 cp 命令
cp .github/misskey/test.yml .config/test.yml

# 3. 构建整个项目
pnpm build

# 4. 从根目录启动测试服务器并运行 Playwright
pnpm e2e                # 内部运行 pnpm start:test，等待 http://localhost:61812 后执行 Playwright
```

- 配置位于 [packages/frontend/playwright.config.ts](../../../../../packages/frontend/playwright.config.ts)，测试目标为 `packages/frontend/test/e2e/` 下的 `*.spec.ts`。
- 测试文件放在 [packages/frontend/test/e2e/](../../../../../packages/frontend/test/e2e/) 下。

新增前端功能的端到端测试通常使用 Playwright，重点覆盖登录、发帖、网盘等主要界面流程。细粒度测试使用 Vitest 或 Storybook。

## Storybook（视觉检查及 Chromatic 视觉回归）

详情见 [storybook.md](storybook.md)。

```bash
pnpm --filter frontend storybook-dev      # http://localhost:6006
pnpm --filter frontend build-storybook    # 静态构建
```

各组件旁配套 `*.stories.impl.ts`，例如 `MkButton.stories.impl.ts`。使用 Chromatic（`pnpm --filter frontend chromatic`）检查视觉回归。

## 本地数据库与 Redis

不同前端测试对数据库和 Redis 的要求不同：

- **Vitest 单元测试**：不需要数据库。仅测试逻辑或组件，不连接后端；CI 的 `vitest` 任务也没有 `services:`。
- **Playwright 端到端测试**：通过 `pnpm start:test` 连接后端，需要数据库和 Redis。使用测试端口的 [packages/backend/test/compose.yml](../../../../../packages/backend/test/compose.yml)，步骤见上文。

开发用的 `compose.local-db.yml` 使用数据库端口 `5432`、Redis 端口 `6379`，**不用于测试**。测试配置 `packages/backend/test/compose.yml` 使用 `54312` 和 `56312`，混用会导致连接失败。
