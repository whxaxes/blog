# JS IntelliSense in Egg

`IntelliSense`（智能提示） 在 IDE 中已经是标配功能，它能在某种程度上提高我们的开发效率，让我们可以更关注功能开发，而不用去来回翻看代码查看变量或者方法的定义。因此在 Egg 中我也在一直尝试更优的开发体验。而用过 Egg 的都知道，Egg 中的模块，都是 Egg Loader 自动加载进去的，因此 IDE 很难自动识别到那些被自动 load 进 egg 中的模块，IntelliSense 就自然无法起作用了。

为了解决这个问题，提升开发体验，在几个月前，我参与了 egg 支持 ts 的开发工作（ 戳：[当 Egg 遇到 TypeScript，收获茶叶蛋一枚](https://zhuanlan.zhihu.com/p/35334932) ），当时写了一个 [egg-ts-helper](https://github.com/whxaxes/egg-ts-helper) 的工具来自动生成 `d.ts` 并通过 TS 提供的 `Declaration Merging` 的能力将 loader 加载的模块合并到 egg 的声明当中。从而实现了 TS 项目中的 `IntelliSense` 。

实现 TS 的 IntelliSense 之后，就开始考虑如何在 JS 项目中也能够跟 TS 项目一样能有智能提示，毕竟 Egg 的大部分项目都还是用 js 的，做了一些尝试之后，发现只要结合 `vscode` & `jsdoc` & `egg-ts-helper` 就能在 js 项目中也有跟 TS 项目中差不多的 IntelliSense 效果了，( github 中会裁剪动图，因此请点击[动图](https://wanghx.cn/public/github/images/issue15/img3.gif)以便看到全图 )：

![image](https://wanghx.cn/public/github/images/issue15/img3.gif)

具体实现如下：

## 声明生成

跟 TS 项目一样，先用 `egg-ts-helper` 在 js 项目下生成 d.ts ( 请使用 egg-ts-helper 的最新版本 `1.17.0` )

```bash
$ npx ets
```

然后项目下的 `typings/app` 目录就已经生成对应的 `d.ts` 了

```js
// typings/app/controller/index.d.ts

import 'egg';
import ExportBlog = require('../../../app/controller/blog');
import ExportHome = require('../../../app/controller/home');

declare module 'egg' {
  interface IController {
    blog: ExportBlog;
    home: ExportHome;
  }
}
```

然后再在项目下创建一个 `jsconfig.json` ，然后写入以下代码

```json
{
  "include": [
    "**/*"
  ]
}
```

这个 `jsconfig.json` 跟 `tsconfig.json` 类似，具体可以看[官方文档描述](https://code.visualstudio.com/docs/languages/javascript#_javascript-projects-jsconfigjson)，创建好这个文件并且 include `**/*` 之后，就会去加载 egg-ts-helper 生成的 d.ts 了。

上面这个 `jsconfig` 有个需要注意的点，如果打开 vscode ，vscode 提醒 `Configure Excludes` 的话，就需要配置一下 `exclude`，因为 include 的文件超过一千个的话，vscode 就会提醒让配置 `exclude`，如果不配置的话 vscode 就不会去处理 `d.ts` 的文件了，比如我这边负责的项目，前端构建多次又没有去清目录的话，轻轻松松文件数就破千了。我这边的 `exclude` 配置如下，可以参考一二

```json
{
  "include": [
    "**/*"
  ],
  "exclude": [
    "node_modules/",
    "app/web/",
    "app/view/",
    "public/",
    "app/mocks/",
    "coverage/",
    "logs/"
  ]
}
```

完成这些配置之后，你就会发现，在 controller 这些用类的形式来写的模块中就已经可以拿到代码提示了。

![image](https://wanghx.cn/public/github/images/issue15/img1.png)

原理跟 TS 项目一样，有了 `jsconfig.json` 的配置之后，vscode 会去解析 egg-ts-helper 生成的声明，这些声明会引入项目中的各个模块，通过 Declaration Merging 合并到 egg 已有的类型中。而 controller 这些模块的写法，都是需要从 egg 中 import 相关类来进行拓展的，因此自然就能顺利读到 egg 的类型，从而获得代码提示。

## JSDOC

上面在类的形式写的 js 中是可以获取到代码提示了，那在非类的形式中怎么来获取呢，比如在 `router.js` 中，也很简单，直接通过写个 `jsdoc` 即可。

```js
// app/router.js

/**
 * @param {import('egg').Application} app
 */
module.exports = app => {
  const { controller, router } = app;
  router.post('/sync', controller.home.sync);
  router.get('/', controller.blog.index);
};
```

看到注释中的代码了么，就可以通过这种方式就能够指定 app 为 egg 中的某个类型

```
@param {import('egg').Application} app
```

**注意**：如果使用了最新版本的 egg-ts-helper ，会自动生成一个声明文件将 egg 注册到一个名为 Egg 的全局 namespace 中，就可以不使用 `import` ，而是直接使用 Egg 来拿类型即可。

```
@param {Egg.Application} app
```

添加 jsdoc 之后就获得代码提示了

![image](https://wanghx.cn/public/github/images/issue15/img2.png)

在其他非拓展类的模块中也差不多，比如：

在 `middleware` 中

```js
// app/middleware/access.js

/**
 * @returns {(ctx: import('egg').Context, next: any) => Promise<any>}
 */
module.exports = () => {
  return async (ctx, next) => {
    await next();
  };
};
```

在 `config` 中

```js

/**
 * @param {import('egg').EggAppInfo} appInfo
 */
module.exports = appInfo => {
  /** @type {import('egg').EggAppConfig} */
  const config = exports = {};

  config.keys = appInfo.name + '123123';

  return {
    ...config,

    biz: {
      test: '123',
    },
  };
};
```

上面 biz 是在最后才写到返回对象中，是为了将这种自定义类型合并到 egg 的 `EggAppConfig` 中。

## 集成到项目

安装 `egg-ts-helper`

```bash
$ npm install egg-ts-helper --save-dev
```

添加 `jsconfig.json` 文件

```json
{
  "include": [
    "**/*"
  ],
  "exclude": [
    "node_modules/",
    "app/web/",
    "app/view/",
    "public/"
  ]
}
```

更改 egg-bin dev 的运行指令

```json
{
  ...
  "dev": "egg-bin dev -r egg-ts-helper/register",
  ...
}
```

执行 `dev`

```bash
$ npm run dev
```

当看到有 `[egg-ts-helper] xxx created` 的日志后，就说明声明已经生成好了，用 vscode 打开项目即可获得代码提示，在 `router.js` 这些需要按照上面描述的加一下 `jsdoc` 就行了。

如果有用到 custom loader，可以看一下 [egg-ts-helper#Extend](https://github.com/whxaxes/egg-ts-helper#extend) 配置，再或者直接参考下面这个 demo 。

https://github.com/whxaxes/egg-boilerplate-d-js 

有兴趣的可以 clone 过去自行尝试一二。

## 最后

要集成该代码提示功能需要具备一些 typescript 的知识基础，可以阅读一下 `egg-ts-helper` 生成的声明文件，知道类型是如何合并的，会更好的帮助你们获得更优异的开发体验，有相关问题可以直接到 `egg-ts-helper` 项目下提 issue ，我会尽快回复。
