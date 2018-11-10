# 在 Egg 应用中抓包

在我负责的项目中，Node 应用跟服务器的交互都是走 http/https 的，因此抓包已经成为日常跟服务器同学探讨锅的归属的最常用方式之一。

## 如何抓包

### 开发期

得益于 egg 中内置的请求库 `urllib` 自带支持了通过环境变量（ `http_proxy` | `https_proxy` 等，详见[这里](https://github.com/node-modules/urllib/blob/master/lib/detect_proxy_agent.js) ）来指定代理地址，所以在 egg 中抓包就变得更简单。

在开发期抓包的时候我习惯性用 charles 来抓 http/https 的包，一般 charles 默认监听的端口是 `8888`，因此只需要在应用启动的时候，加上 `http_proxy` 的环境变量

```bash
$ http_proxy=http://127.0.0.1:8888 npm run dev
```

就可以将 egg 的请求代理到 charles 上了。如果是用其他 http 抓包工具，比如 `anyproxy` `fiddler` 之类的也类似。

### 服务器

在本地开发的时候，抓包很简单，因为我们只需要在本地装一下抓包工具即可，但是在服务端开发就会麻烦了一些，不过也是可以实现的。

一个是可以通过 tcpdump 在服务器上抓包，抓好包之后把生成的 cap 文件下载下来用 wiresharks 进行分析。

再或者就是直接在服务器装个抓包工具了，比如 `anyproxy` `whistle` 这些用 js 写的抓包工具，都是很容易安装以及使用的，同时也集成了分析面板。装好后，在启动应用的时候加上前面说的环境变量即可。

## 问题

从上面可以看到，不管是在开发期还是在服务器抓包，都有一些成本，再加上之前质量同学经常跟我吐槽，他们遇到问题的时候，想看到我们 node 到 java 服务器的请求。

所以为了能够降低抓包的成本，能够在各个项目中 0 成本抓包，我将 whistle 集成到了 egg ，开发了个 [egg-whistle](https://github.com/whxaxes/egg-whistle) 插件。从而可以在本地，测试环境抓 node 到 jws 的 http 请求。

## 插件使用

使用方法极其简单。只需要跟其他 egg 插件一样安装一下

```bash
$ tnpm i egg-whistle --save
```

然后在 plugin.js 中配置一下

```js
// config/plugin.js

exports.whistle = {
  enable: true,
  env: [ 'local', 'test' ], // 最好只在 test 和 local 开启哦
  package: 'egg-whistle',
};
```

然后启动应用

```bash
[master] nut init, got unknown UAE_MODE: undefined, EGG_SERVER_ENV: undefined, NODE_ENV: development
2018-11-05 20:55:32,298 INFO 39253 [master] node version v8.12.0
2018-11-05 20:55:32,298 INFO 39253 [master] alinode version v3.12.0
2018-11-05 20:55:32,299 INFO 39253 [master] larva version 3.0.0
2018-11-05 20:55:36,155 INFO 39253 [master] agent_worker#1:39254 started (3852ms)
2018-11-05 20:55:39,043 INFO 39253 [master] larva started on http://127.0.0.1:7001 (6744ms)
2018-11-05 20:55:39,050 INFO 39254 [egg-whistle] whistle started on http://127.0.0.1:7001/__whistle__
```

看到最后那句话了吗？说明 whistle 就已经启动成功了，接下来就可以直接访问 `http://127.0.0.1:7001/__whistle__` 就可以看到 whistle 的抓包界面了。

![](https://cdn.nlark.com/lark/0/2018/png/8714/1541507863946-e47c46b4-062c-4d3b-8d00-4eb4cddad279.png)

由于 `egg-whistle` 做了一层代理，将应用的 `/__whistle__` 代理到了 `whistle` 的服务中，因此就算将应用直接发布到测试环境，比如测试环境地址是 `http://test.com` ，`whistle` 的地址就是 `http://test.com/__whistle__`。

## 会被自动抓包的请求

`egg-whistle` 默认会自动代理所有由 `app.httpclient` 和 `ctx.httpclient` 发出的请求（ 也包括 `ctx.curl` 及 `app.curl`  ），如果不是用 egg 提供的 httpclient 发出的请求（ 比如自己用 http 发的请求，或者 websocket ）是不会被代理的，如果想代理这部分请求，添加 agent 即可。如下

http

```js
// app.js

const http = require('http');
module.exports = app => {
  app.whistle.on('ready', () => {
    http.request('http://xxx.com/xxx', { agent: app.whistle.proxyAgent });
  });
};
```

websocket

```js
// app.js

const ws = require('WebSocket');
module.exports = app => {
  app.whistle.on('ready', () => {
    const socket = new WebSocket('ws://xxx.com/xxx', {
      agent: app.whistle.proxyAgent,
    });
  });
};
```

配置全局代理

```js
// app.js

const http = require('http');
module.exports = app => {
  app.whistle.on('ready', () => {
    http.globalAgent = app.whistle.proxyAgent;
  });
};
```

## Whistle

选择 `whistle` 的原因主要还是因为 `whistle` 的功能很强大，支持 http/https/websocket，同时拥有进行请求重发、请求过滤、插件机制等等很便利的功能。而且开源有持续的更新。简单说几个常用的例子

### 请求重发

点击 menu bar 里的 replay 即可对选中的请求进行重发，而点击 compose ，则可以在右边的详情栏目里对请求进行编辑后，点击 `GO` 按钮即可重发。

### 过滤请求

由于测试环境的所有 node 到 jws 的请求都被代理了，所以如果大家一起用的话，可能会出现比较多的包，所以过滤功能就很重要了。配置也很简单，看到主界面底部的黑色的 filter 输入框了么，在里面可以输入相关规则进行过滤，其中

> h:、s:、i:、m:、b: 分别表示匹配请求响应头、请求方法、响应状态码、ClientIP 及 ServerIP、请求响应内容、其它表示匹配 url(以上匹配都不区分大小写)

比如，我的手机型号是 `SM-G9250` （ 可以在请求头的 ua 里看到自己手机的信息 ），然后因为在 user-agent 中会有该数据，所以我想过滤仅看我自己的手机就可以这么配置

```
h: SM-G9250
```

### 解 HTTPS 的包

我们有部分的请求是 https 的（ 比如请求用户中心的 ），而 whistle 默认是没有开启 https 的解包的，要开启的话，只需要点击 menu bar 中的 HTTPS 按钮，然后勾上抓包的选择即可。

![](https://cdn.nlark.com/lark/0/2018/png/8714/1541427026895-2e94dc32-e39c-4218-a10b-59927629d65f.png)

### Dashboard 账号密码验证

如果不想让抓包界面谁都可以访问，就可以配置账号密码，直接在插件配置中配置

```js
// config/config.default.js

exports.whistle = {
  username: 'your username',
  password： 'your password',
};
```

## 其他

其他更多 dashboard 上的的使用方式可以直接看官方文档：http://wproxy.org/whistle/webui/
