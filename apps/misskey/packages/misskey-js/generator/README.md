# misskey-js 类型生成模块

本模块根据本站后端的 OpenAPI `api.json` 生成 SDK 类型，结果写入 `misskey-js/src/autogen/`。生成器本身不随 SDK 分发。

修改后端 API 定义后，在仓库根目录执行：

```sh
pnpm build-misskey-js-with-types
```

该命令串联后端 API 导出与 SDK 类型生成。生成结果与 API 实现一并审查和提交，具体见[团队维护说明](../DEVELOPMENT.md)。
