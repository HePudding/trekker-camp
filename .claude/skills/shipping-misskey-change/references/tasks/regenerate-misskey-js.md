# 重新生成 misskey-js 自动生成类型

修改后端 API 端点或架构（`meta`、`paramDef`、`res`）后，按以下步骤更新 `packages/misskey-js/src/autogen/` 中的类型。

**遗漏此步骤会导致 CI 的 `check-misskey-js-autogen` 失败**，这是最常见的错误之一。

## 执行时机

出现以下任一修改时执行：

- 新增端点（`packages/backend/src/server/api/endpoints/<category>/<name>.ts`）。
- 修改已有端点的 `meta`，如 errors、res、kind、requireCredential。
- 修改已有端点的 `paramDef`（输入架构）。
- 修改打包实体（`packages/backend/src/models/json-schema/*.ts`）。

实际操作中，可按“修改了 `packages/backend/src/server/api/` 就执行”处理。

## 命令

```bash
# 从仓库根目录执行
pnpm build-misskey-js-with-types
```

内部依次执行：

1. 构建后端（`pnpm --filter backend build`）。
2. 生成 OpenAPI 规范（`packages/backend/built/api.json`）。
3. 生成 misskey-js 架构（`packages/misskey-js/generator/api.json`）。
4. 重新生成 TypeScript 类型（`packages/misskey-js/src/autogen/{types,entities,endpoint,models,apiClientJSDoc}.ts`）。
5. 构建 misskey-js 并运行 API extractor。

通常耗时 1–3 分钟。出现超时警告时，使用相当于 `--timeout=600000` 的较长超时设置。

## 执行后检查

```bash
# 查看改动范围
git status --short -- packages/misskey-js/
git diff --stat -- packages/misskey-js/src/autogen/

# 需要查看内容时
git diff -- packages/misskey-js/src/autogen/
```

## 差异处理

- **无差异**：后端修改未影响 misskey-js 公开类型，例如内部重构，无需额外提交。
- **有差异**：**必须将 `packages/misskey-js/src/autogen/` 下的改动加入提交**。

  ```bash
  git add packages/misskey-js/src/autogen/
  ```

  `api.json` 差异较大时，检查 API 端点的 `meta`、`paramDef` 和 `res` 是否符合预期。

## 注意事项

- 此命令用于后端修改后的检查。未修改后端时，构建缓存可能使其不执行实际操作。
- 执行时会更新 `packages/backend/built/`、`packages/misskey-js/built/` 等中间产物，这些目录已被 `.gitignore` 忽略。
- 若 `packages/misskey-js/src/` 中 `autogen/` 之外出现意外差异，可能混入了本地编辑，应暂停并调查原因。
- `packages/misskey-js/` 是 **MIT 许可证子包**，不需要也不要为 `autogen/` 文件添加 AGPL SPDX 头。

## CI 失败消息示例

```
CI: check-misskey-js-autogen
> Please regenerate misskey-js by running:
>   pnpm build-misskey-js-with-types
> and commit the changes under packages/misskey-js/src/autogen/.
```

在本地再次执行上述命令，提交差异后重新推送。

## 相关文档

- 添加 API 端点的完整步骤 → [working-on-backend/references/tasks/adding-api-endpoint.md](../../../working-on-backend/references/tasks/adding-api-endpoint.md)
- `meta`、`paramDef`、`res` 规范 → [working-on-backend/references/knowledge/api-meta-paramdef.md](../../../working-on-backend/references/knowledge/api-meta-paramdef.md)
