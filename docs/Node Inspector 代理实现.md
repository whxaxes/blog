# Node Inspector 代理实现

## 背景

平时做 node 开发的时候，通过 node inspector 来进行断点调试是一个很常用的 debug 方式。但是有几个问题会导致我们的调试效率降低。

问题一：当使用 vscode 进行断点调试时，如果应用是通过 cluster 启动的 inspector，那么每次当 worker 挂了重启后，inspector 的端口都会自增。虽然在 node8.x 版本中可以指定 inspectPort 固定调试端口，但是在 node6.x 中是不支持的。这样会导致每次 worker 重启了就得在 vscode 中重新指定调试端口。

问题二：当使用 devtools 调试的时候，每次调试都需要拷贝 devtools 链接到 chrome 上调试，而上面说的端口变更问题则会导致 devtools 的链接变更，除此之外，每次重新启动 inspector 也会导致 devtools 的链接变更，因为 websocket id 变了。

而把上面的两个问题简化一下就是：


- 在 vscode 中调试，在 inspector 端口变更或者 websocket id 变更后能够重连。
- 在 devtools 中调试，在 inspector 端口变更或者 websocket id 变更后能够重连。

## 解决方案

目前业界已经有解决方案就是 chrome 插件 `Node Inspector Manager(Nim)` ，不过这个只能解决在同个 inspector 端口下的应用重启后链接更改的问题，却无法解决 cluster 启动导致的端口自增问题，除非在 Nim 中提前指定好多个端口，再者 Nim 是 chrome 上的插件，对于在 vscode 中的调试却无能为力了。

所以最佳的解决方案自然是使用 node 来做 inspector 代理，解决方案如下：

对于第一个问题，在 vscode 上，它是会自己去调用 /json 接口获取最新的 websocket id，然后使用新的 websocket id 连接到 node inspector 服务上。因此解决方法就是实现一个 tcp 代理功能做数据转发即可。

对于第二个问题，由于 devtools 是不会自动去获取新的 websocket id 的，所以我们需要做动态替换，所以解决方案就是代理服务去 /json 获取 websocket id，然后在 websocket 握手的时候将 websocket id 进行动态替换到请求头上。

画了一张流程图：

![image](https://user-images.githubusercontent.com/5856440/30554809-5768c224-9cd8-11e7-9549-b7cf920c4e7c.png)

## 实现步骤

### 一、Tcp 代理

首先，先实现一个 tcp 代理的功能，其实很简单，就是通过 node 的 net 模块创建一个代理端口的 Tcp Server，然后当有连接过来的时候，再创建一个连接到目标端口即可，然后就可以进行数据的转发了。

简易的实现如下：

```js
const net = require('net');
const proxyPort = 9229;
const forwardPort = 5858;

net.createServer(client => {
  const server = net.connect({
    host: '127.0.0.1',
    port: forwardPort,
  }, () => {
    client.pipe(server).pipe(client);
  });
  // 如果真要应用到业务中，还得监听一下错误/关闭事件，在连接关闭时即时销毁创建的 socket。
}).listen(proxyPort);
```

上面实现了比较简单的一个代理服务，通过 pipe 方法将两个服务的数据连通起来。client 有数据的时候会被转发到 server 中，server 有数据的时候也会转发到 client 中。

当完成这个 Tcp 代理功能之后，就已经可以实现 vscode 的调试需求了，在 vscode 中项目下 launch.json 中指定端口为代理端口，在 configurations 中添加配置

```js
{
  "type": "node",
  "request": "attach",
  "name": "Attach",
  "protocol": "inspector",
  "restart": true,
  "port": 9229
}
```

那么当应用重启，或者更换 inspect 的端口，vscode 都能自动重新通过代理端口 attach 到你的应用。

### 二、获取 websocketId

这一步开始，就是为了解决 devtools 链接不变的情况下能够重新 attach 的问题了，在启动 node inspector server 的时候，inspector 服务还提供了一个 /json 的 http 接口用来获取 websocket id。

这个就相当简单了，直接发个 http 请求到目标端口的 /json，就可以获取到数据了：

```js
[ { description: 'node.js instance',
    devtoolsFrontendUrl: '...',
    faviconUrl: 'https://nodejs.org/static/favicon.ico',
    id: 'e7ef6313-1ce0-4b07-b690-d3cf5274d8b0',
    title: '/Users/wanghx/Workspace/larva-team/vscode-log/index.js',
    type: 'node',
    url: 'file:///Users/wanghx/Workspace/larva-team/vscode-log/index.js',
    webSocketDebuggerUrl: 'ws://127.0.0.1:5858/e7ef6313-1ce0-4b07-b690-d3cf5274d8b0' } ]
```

上面数据中的 id 字段，就是我们需要的 websocket id 了。

### 三、Inspector 代理

拿到了 websocket id 后，就可以在 tcp 代理中做 websocket id 的动态替换了，首先我们需要固定链接，因此先定一个代理链接，比如我的代理服务端口是 9229，那么 chrome devtools 的代理链接就是：

```
chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:9229/__ws_proxy__
```

上面除了最后面的 `ws=127.0.0.1:9229/__ws_proxy__` 其他都是固定的，而最后这个也一眼就可以看出来是 websocket 的链接。其中 `__ws_proxy__`则是用来占位的，用于在 chrome devtools 向这个代理链接发起 websocket 握手请求的时候，将 `__ws_proxy__` 替换成 websocket id 然后转发到 node 的 inspector 服务上。

对上面的 tcp 代理中的 `pipe` 逻辑的代码做一些小修改即可。

```js
const through = require('through2');
...

client
      .pipe(through.obj((chunk, enc, done) => {
        if (chunk[0] === 0x47 && chunk[1] === 0x45 && chunk[2] === 0x54) {
          const content = chunk.toString();
          if (content.includes('__ws_proxy__')) {
            return done(null, Buffer.from(content.replace('__ws_proxy__', websocketId)));
          }
        }
        done(null, chunk);
      }))
      .pipe(server)
      .pipe(client);
...
```

通过 through2 创建一个 transform 流来对传输的数据进行一下更改。

简单判断一下 chunk 的头三个字节是否为`GET`，如果是 GET 说明这可能是个 http 请求，也就可能是 websocket 的协议升级请求。把请求头打印出来就是这个样子的：

```bash
GET /__ws_proxy__ HTTP/1.1
Host: 127.0.0.1:9229
Connection: Upgrade
Pragma: no-cache
Cache-Control: no-cache
Upgrade: websocket
Origin: chrome-devtools://devtools
Sec-WebSocket-Version: 13
...
```

然后将其中的路径`/__ws_proxy`替换成对应的 websocketId，然后转发到 node 的 inspector server 上，即可完成 websocket 的握手，接下来的 websocket 通信就不需要对数据做处理，直接转发即可。

接下来就算各种重启应用，或者更换 inspector 的端口，都不需要更换 debug 链接，只需要再 inspector server 重启的时候，在下图的弹窗中

![image](https://user-images.githubusercontent.com/5856440/30554708-09033966-9cd8-11e7-81e6-69f8c7f4939e.png)

点击一下 Reconnect DevTools 即可恢复 debug。

## 最后

上面的详细代码可以在下面的 git 中找到：

- Tcp 代理：https://github.com/whxaxes/tcp-proxy.js
- Inspector 代理：https://github.com/whxaxes/inspector-proxy

