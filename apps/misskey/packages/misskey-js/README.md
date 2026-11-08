# misskey-js · 旅人营地 SDK

基于 Misskey 的 JavaScript / TypeScript SDK，供本站前后端共享 API 类型、请求客户端和实时流工具，可在浏览器和 Node.js 中使用。

仓库内的应用通过 `"misskey-js": "workspace:*"` 引用此包。工作区版本包含营地的 API 定义，使用本仓库构建产物对接本站。npm 上的同名上游包按上游版本维护。

维护步骤见 [DEVELOPMENT.md](DEVELOPMENT.md)，本包沿用 [MIT 许可证](LICENSE)。下文以本地开发服务 `http://localhost:3000` 为例，访问令牌使用测试账号授权获得的值。

## 使用方法
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
	origin: 'http://localhost:3000',
	credential: 'TOKEN',
});

const meta = await cli.request('meta', { detail: true });
```

`request` 的第一个参数为端点名称，第二个参数为请求参数对象，响应通过 Promise 返回。

## 实时流
misskey.js 的实时流提供两个类：`Stream` 管理连接本身，`Channel` 表示连接中的频道。
使用时先初始化 `Stream` 实例，再通过其方法获取 `Channel` 实例。

``` ts
const stream = new Misskey.Stream('http://localhost:3000', { token: 'TOKEN' });
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
const stream = new Misskey.Stream('http://localhost:3000', { token: 'TOKEN' });

const mainChannel = stream.useChannel('main');
```

带参数
``` ts
const stream = new Misskey.Stream('http://localhost:3000', { token: 'TOKEN' });

const chatChannel = stream.useChannel('chat', {
	other: 'xxxxxxxxxx',
});
```

### 断开频道连接
调用 `Channel` 类的 `dispose` 方法。

``` ts
const stream = new Misskey.Stream('http://localhost:3000', { token: 'TOKEN' });

const mainChannel = stream.useChannel('main');

mainChannel.dispose();
```

### 接收消息
`Channel` 继承自 EventEmitter，收到服务器消息时，以收到的事件名触发事件并传递载荷。

``` ts
const stream = new Misskey.Stream('http://localhost:3000', { token: 'TOKEN' });
const mainChannel = stream.useChannel('main');
mainChannel.on('notification', notification => {
	console.log('notification received', notification);
});
```

### 发送消息
使用 `Channel` 类的 `send` 方法向服务器发送消息。

``` ts
const stream = new Misskey.Stream('http://localhost:3000', { token: 'TOKEN' });
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
const stream = new Misskey.Stream('http://localhost:3000', { token: 'TOKEN' });
stream.on('_connected_', () => {
	console.log('connected');
});
```

### 连接断开事件
监听 `Stream` 类的 `_disconnected_` 事件。

``` ts
const stream = new Misskey.Stream('http://localhost:3000', { token: 'TOKEN' });
stream.on('_disconnected_', () => {
	console.log('disconnected');
});
```

### 连接状态
通过 `Stream` 类的 `state` 属性查看。

- `initializing`: 尚未建立连接
- `connected`: 已连接
- `reconnecting`: 正在重连
