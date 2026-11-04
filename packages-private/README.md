# packages-private

`packages-private` 存放用于 CI 等场景的工具。这些包不作为**生产目录 `/packages`** 的依赖。

## 包列表

| 包 | 用途 |
| --- | --- |
| [`diagnostics-shared`](./diagnostics-shared) | 测量包共用的统计、格式化及 V8 堆快照解析工具 |
| [`diagnostics-backend`](./diagnostics-backend) | 比较基线与改动版本的后端内存使用量，生成用于 PR 评论的 Markdown |
| [`diagnostics-frontend`](./diagnostics-frontend) | 比较基线与改动版本在浏览器中启动前端时的指标及生成的代码块信息 |
| [`changelog-checker`](./changelog-checker) | 验证 `CHANGELOG.md` 新增的内容 |

## 从 GitHub Actions 调用

工作流仅调用各包的 npm 脚本，不在工作流中编写业务逻辑。
CLI 接收的路径均相对于调用方的当前目录解析，因此工作流应使用 `$GITHUB_WORKSPACE`、`$RUNNER_TEMP` 传入绝对路径。

```yaml
- name: Generate report
  working-directory: head
  run: >-
    pnpm --filter diagnostics-frontend run render-md
    "$GITHUB_WORKSPACE/base" "$GITHUB_WORKSPACE/head"
    "$REPORT_DIR/base-bundle-stats.json" "$REPORT_DIR/head-bundle-stats.json"
    "$REPORT_DIR/base-browser.json" "$REPORT_DIR/head-browser.json"
    "$REPORT_DIR/report.md"
```

比较 base/head 时，**使用 head 检出版本中的测量工具测量两者**，确保结果仅反映构建产物的差异，避免测量代码变更影响结果。
