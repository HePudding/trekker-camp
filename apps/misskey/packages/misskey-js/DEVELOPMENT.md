# misskey-js · 团队维护

本包随旅人营地的 API 维护。团队流程见[根目录开发指南](../../../../DEVELOPMENT.md)，不设独立的贡献或发布流程。

## 修改与验证

在仓库根目录执行所需命令：

```sh
pnpm --filter misskey-js build
pnpm --filter misskey-js test
pnpm --filter misskey-js lint
```

运行时测试使用 Vitest，类型测试使用 tsd，分别位于 `test/` 和 `test-d/`。按改动范围选择验证。

后端 API 定义变化时运行 `pnpm build-misskey-js-with-types`，一并提交 `src/autogen/` 的变化。不要手工修改生成类型。

公开导出变化时，在构建后运行 `pnpm --filter misskey-js api`，审查并提交 `etc/misskey-js.api.md` 的差异。对照 `master` 检查是否意外改变调用方式和类型。

本包沿用 [MIT 许可证](LICENSE)。本站文档中的使用示例以工作区中的版本为准。
