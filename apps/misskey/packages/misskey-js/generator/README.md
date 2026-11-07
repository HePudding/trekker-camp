## misskey-js 类型生成模块

本模块根据后端输出的 OpenAPI 格式 api.json，生成 misskey-js 使用的类型别名。
本模块不随 misskey-js 打包，而是将生成结果复制到 misskey-js 的 src 目录下使用。

## 使用方法

首先从 Misskey 后端获取 api.json。可以从任意 Misskey 实例的 /api-doc 下载，
也可以在 backend 模块下执行 `pnpm generate-api-json`。

获取后，将 api.json 放到本文件所在目录。

然后执行：

```shell
pnpm generate
```

生成的 ts 文件将位于 `./built` 目录下。
