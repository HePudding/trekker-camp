## test-federation

测试两个 Misskey 服务器 `a.test` 和 `b.test` 之间的联邦通信。

测试前，需要构建整个项目并切换到此目录：

```sh
pnpm build
cd packages/backend/test-federation
```

首先执行以下命令启动服务器：

```sh
bash ./setup.sh
NODE_VERSION=22 docker compose up --scale tester=0
```

然后执行以下命令运行全部测试：

```sh
NODE_VERSION=22 docker compose run --no-deps --rm tester
```

测试指定文件：

```sh
NODE_VERSION=22 docker compose run --no-deps --rm tester -- pnpm -F backend test:fed packages/backend/test-federation/test/user.test.ts
```
