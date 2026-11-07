# 独立插件与共享包

每个插件使用 `packages/<name>/package.json` 声明唯一包名与 `exports`，应用通过 `workspace:*` 引用。该目录已注册到根目录 pnpm 工作区。

插件的构建、测试与发布产物由自己的脚本和 `files` 字段定义。未准备发布的插件设置 `private: true`；可发布包按实际代码来源声明许可证。应用入口放在 `apps/`，Misskey 内部实现放在 `apps/misskey/packages/`。
