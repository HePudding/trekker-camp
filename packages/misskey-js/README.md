# misskey.js
**适用于浏览器和 Node.js 的强类型 Misskey 官方 SDK。**

[![Test](https://github.com/misskey-dev/misskey.js/actions/workflows/test.yml/badge.svg)](https://github.com/misskey-dev/misskey.js/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/misskey-dev/misskey.js/branch/develop/graph/badge.svg?token=PbrTtk3nVD)](https://codecov.io/gh/misskey-dev/misskey.js)

[![NPM](https://nodei.co/npm/misskey-js.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/misskey-js)

这是面向 JavaScript（TypeScript）的 Misskey 官方 SDK，可在浏览器和 Node.js 中运行。

提供以下功能：
- 用户认证
- API 请求
- 实时流
- 工具函数
- Misskey 的各类类型定义

支持 Misskey 12 及以上版本。

## 安装
```
npm i misskey-js
```

# 使用方法
可以按以下方式统一导入：

``` ts
import * as Misskey from 'misskey-js';
```

为方便说明，后续代码示例均假定按上述方式使用 `* as Misskey` 导入。

该导入方式会影响 Tree-Shaking。对代码体积敏感的场景建议分别导入：

``` ts
import { api as misskeyApi } from 'misskey-js';
```

## 认证
使用用户授权获得的访问令牌初始化下文的 `APIClient`，或将令牌传给 `Stream`。

## API 请求
使用 API 时，传入服务器信息和访问令牌来初始化 `APIClient` 实例，再调用实例的 `request` 方法发送请求。

``` ts
const cli = new Misskey.api.APIClient({
	origin: 'https://misskey.test',
	credential: 'TOKEN',
});

const meta = await cli.request('meta', { detail: true });
```

`request` 的第一个参数为端点名称，第二个参数为请求参数对象，响应通过 Promise 返回。

## 实时流
misskey.js 的实时流提供两个类：`Stream` 管理连接本身，`Channel` 表示连接中的频道。
使用时先初始化 `Stream` 实例，再通过其方法获取 `Channel` 实例。

``` ts
const stream = new Misskey.Stream('https://misskey.test', { token: 'TOKEN' });
const mainChannel = stream.useChannel('main');
mainChannel.on('notification', notification => {
	console.log('notification received', notification);
});
```

连接断开后会自动重连。

### 连接频道
使用 `Stream` 类的 `useChannel` 方法连接频道。

不带参数
``` ts
const stream = new Misskey.Stream('https://misskey.test', { token: 'TOKEN' });

const mainChannel = stream.useChannel('main');
```

带参数
``` ts
const stream = new Misskey.Stream('https://misskey.test', { token: 'TOKEN' });

const chatChannel = stream.useChannel('chat', {
	other: 'xxxxxxxxxx',
});
```

### 断开频道连接
调用 `Channel` 类的 `dispose` 方法。

``` ts
const stream = new Misskey.Stream('https://misskey.test', { token: 'TOKEN' });

const mainChannel = stream.useChannel('main');

mainChannel.dispose();
```

### 接收消息
`Channel` 继承自 EventEmitter，收到服务器消息时，以收到的事件名触发事件并传递载荷。

``` ts
const stream = new Misskey.Stream('https://misskey.test', { token: 'TOKEN' });
const mainChannel = stream.useChannel('main');
mainChannel.on('notification', notification => {
	console.log('notification received', notification);
});
```

### 发送消息
使用 `Channel` 类的 `send` 方法向服务器发送消息。

``` ts
const stream = new Misskey.Stream('https://misskey.test', { token: 'TOKEN' });
const chatChannel = stream.useChannel('chat', {
	other: 'xxxxxxxxxx',
});

chatChannel.send('read', {
	id: 'xxxxxxxxxx'
});
```

### 连接建立事件
监听 `Stream` 类的 `_connected_` 事件。

``` ts
const stream = new Misskey.Stream('https://misskey.test', { token: 'TOKEN' });
stream.on('_connected_', () => {
	console.log('connected');
});
```

### 连接断开事件
监听 `Stream` 类的 `_disconnected_` 事件。

``` ts
const stream = new Misskey.Stream('https://misskey.test', { token: 'TOKEN' });
stream.on('_disconnected_', () => {
	console.log('disconnected');
});
```

### 连接状态
通过 `Stream` 类的 `state` 属性查看。

- `initializing`: 尚未建立连接
- `connected`: 已连接
- `reconnecting`: 正在重连

---

<div align="center">
	<a href="https://github.com/misskey-dev/misskey/blob/develop/CONTRIBUTING.md"><img src="https://assets.misskey-hub.net/public/i-want-you.png" width="300"></a>
</div>
