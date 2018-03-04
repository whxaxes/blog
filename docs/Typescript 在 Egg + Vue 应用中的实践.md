# Typescript 在 Egg + Vue 应用中的实践

最近团队准备尝试 typescript，于是找了个新项目来试水，目前那个项目也已经成功上线。在此总结一下我这个项目在开发途中遇到的一些问题以及自己是怎么解决的。

## 准备工作

### 编译构建

在构建方面，我是选择 node 端的 ts 代码，直接用 tsc 构建，而前端的 ts 代码，则用 webpack 打包。构建流程如下图所示，还是比较简单的。

![](https://lh3.googleusercontent.com/-T9xVC1KNbhs/WpuSt3FKg9I/AAAAAAAAAEw/IUloQh0TFUsfI985sk8KQpo2vdaXVOrYwCHMYCw/I/15201398820871.jpg)

node 端中，是直接将 js 代码编译到同个目录，然后为了在写代码时不受干扰，就在 vscode 的配置中，加了一段配置，将编译后的 js 文件隐藏掉：

```js
"files.exclude": {
    "**/*.js": {
      "when": "$(basename).ts"
    },
    "**/*.map": true
},
```

> 这里说明一下，node 端的开发期为什么不用 ts-node，因为 egg loader 机制会自动挂载模块，而这段逻辑里很多是写死了加载 `*.js`，所以暂不支持 ts-node（以后会支持），因此暂时还是使用 tsc 做编译。

前端的就直接通过 webpack 打包了，用的是我们团队同学写的 [easywebpack](https://github.com/hubcarl/easywebpack) 做前端打包，目前也已经支持 typescript 了。

在编译这快，还有个注意的点就是，因为 node 端和前端的 ts 配置是不一样的，所以需要两份 tsconfig.json，我就是在 node 目录放一个 tsconfig.json，然后在 web 目录放一份 tsconfig.json，然后两份 tsconfig.json 同时 extend 一份公共的 tsconfig.base.json。

项目结构如下。

```
.
├── app
│   ├── controller
│   ├── extend
│   ├── middleware
│   ├── service
│   ├── view
│   └── web
|       ├── webpack.config.ts
|       └── tsconfig.json
├── config
|   └── tsconfig.base.json
├── typings
|   └── index.d.ts
└── tsconfig.json
```

可以看到根目录有个 tsconfig.json，是给 node 用的，web 目录有个 tsconfig.json 是给前端用的。然后两者都继承 config/tsconfig.base.json

### 框架

如果是直接使用 egg 的项目，就可以直接从 egg 中 import 相关类以及模块，不过很大一部分项目都是使用 egg 上层封装模块。

我们团队也有自己的一个 egg 上层封装的框架 larva，在 egg 上添加了一些额外的方法、中间件等，但是目前有支持 typescript 的就只有 egg。我希望我的业务代码能够直接从 larva 中将 egg 中暴露的 interface 给引入进来，也就是能够

```ts
import { Context } from 'larva';
```

于是我以 egg 的声明文件为基础，将 egg 的声明全部导出的同时，在上层框架的声明文件中做拓展。

比如我的 larva 框架在 helper 中拓展了一个 `formatDate` 方法，又在 context 对象中拓展了一个 `isProd` 的属性。就直接使用 `declare module 'egg'` 在 egg module 上做拓展（不知道怎么拓展的同学，[Declation Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html) 了解一下）。

```ts
// larva/index.d.ts

import * as Egg from 'egg';

declare module 'egg' {
  export interface Context {
    isProd: boolean;
  }

  export interface IHelper {
    formatDate(data: Date | string | number, format: string): string;
  }
}

export = Egg;
```

最后再将 Egg 完整导出，就可以在 import 上层框架的时候，使用 egg 中的所有类和接口了。

起初我是用 `export * from 'egg'` 的方式导出，但是后来发现这样会导致插件的声明文件就很难写了，没法做到通用。所以才使用 `export = ` 的方式来导出。

基本上上层框架的声明文件都可以这么写，当然，如果有更好的写法也欢迎提出。

### 插件

项目中用到了很多 egg 插件，而其中大部分 egg 插件都是没有写 typescript 的声明文件的。因此我就一边给相关插件补充声明文件，一边开发项目，这个过程，也可以称作是渐进式开发，流程基本上像这样。

比如我有一个 egg 插件叫 egg-sfclient。我会先在项目中编写相关插件的声明文件，会将该文件放到项目的 typings 目录下：

```ts
// {project}/typings/sfclient.d.ts

import { Application } from 'egg';

export class Sfclient {
  constructor(app: Application);
  getConfig: (name: string) => string;
}

// 由于我的 larva 框架是基于 egg 的声明文件做拓展的，因此插件的也直接拓展 egg
declare module 'egg' {
  interface Application {
    sfclient: Sfclient;
  }
}
```

写完这个声明文件之后，在 vscode 中如果能获得该提示，就说明没问题了

![](https://lh3.googleusercontent.com/-dhwbGxNRLLM/WpuSuV4NG2I/AAAAAAAAAE0/CvZzItXA-mUl1GNQ3mCd4TXnV2T_KjmAACHMYCw/I/15201394772041.jpg)

当写完这个声明文件，并且觉得没什么问题了，就可以将该声明文件直接提个 PR 到插件库，合并并且发版之后，就把本地的声明文件删掉，再在 typings 中将插件 import 进来即可（因为 typescript 是通过 import 去加载模块的声明文件的）。

如果是框架内置的插件，还可以在框架的 index.d.ts 中，直接将插件 import 进来

```ts
// larva/index.d.ts

import * as Egg from 'egg';
import 'egg-sfclient';

declare module 'egg' {
  ...
}

export = Egg;
```

## 开发 - Node 端

### Controller & Service

egg 一个很方便的能力是自动挂载，通过 loader 将 controller、service 自动挂载到 Context 对象中，但是这个能力对于写 ts 来说又会带来一定问题，就是 ts 在做静态类型分析的时候，不知道这些模块会被自动加载，所以我们需要用 d.ts 来告诉 ts 这些模块被挂载到了相关对象中。

比如当我写一个 controller

```ts
// app/controller/account.ts

import { Controller } from 'larva';

export default class AccountController extends Controller {
  public async login() {
    // login
  }
}
```

如果在 router.ts 中想使用该 controller 的时候，如果在 js 中，就可以直接 `app.controller.account.login` 获取到这个路由方法，但是在 ts 中由于强类型检查，会提醒 IController 中不存在该实例。

所以我们要通过 d.ts 将这个实例注入到 IController 中。

```ts
// app/controller/index.d.ts

import AccountController from './account';
declare module 'larva' {
  interface IController {
    account: AccountController;
  }
}
```

加上这个之后，就能愉快的得到代码提示并且能够成功编译了。

![](https://lh3.googleusercontent.com/-YP4nru6ZxN8/WpuSu3IfxDI/AAAAAAAAAE4/9Jf6hf8X_xs1wdAMJH-0pqJPiq3lsdVTgCHMYCw/I/15201416736454.jpg)

在 Service 中亦是如此。

当然，由于这种 d.ts 是有规律的，只需要知道目录结构就能够生成这种 d.ts，所以完全可以通过工具来自动生成，我写了一个小工具：[egg-ts-helper](https://github.com/whxaxes/egg-ts-helper) 可以用来自动生成 controller、service、proxy 目录的 d.ts。

### Extend

egg 还有一个很方便的能力就是自动拓展，在 extend 目录下能够很方便的拓展 egg 对象的方法。但是这些拓展的方法在 ts 中如何注入到 egg 对象中，并且在拓展的逻辑中能够得到相关代码提示呢？比如我要拓展 Context 对象。我是这么做的。

```ts
// app/extend/context.ts

const extendContext = {
  get ctx(): Context {
    return this as any as Context;
  },

  get isProd(): boolean {
    return this.ctx.app.config.env === 'prod';
  },
  
  sfRequest(name) {
    return this.ctx.app.sfclient.request(name);
  }
};

export default extendContext;

declare module 'larva' {
  interface Context {
    isProd: typeof extendContext.isProd;
    sfRequest: typeof extendContext.sfRequest;
  }
}
```

因为不想每一个拓展方法中都去添加

```ts
const ctx = this as any as Context
```

所以就直接提供一个 ctx 的属性，因为对 ts 来说在这些方法中的 this 是属于 extendContext 对象，所以需要强制指定成 Context，而要强制指定，就得先把 this 转成 any，所以就用了 `this as any as Context` 。

而给 egg 对象中注入的方式就有点不是很优雅了，得一个一个方法来写，这个目前是还没想到什么好的办法，唯一想到的就是跟 Controller 那个一样，通过工具来自动生成，不过这个就得做语法分析了。

Application 还有 Helper 等的拓展也一样。

### Middleware & Config & Unittest

而像 middleware、config、unittest 这些，就跟 js 的编写方式类似。所以倒没什么可展开讲的，直接贴出示例代码。

middleware

```ts
// app/middleware/mymid.ts

import { Context } from 'larva';

export default () => {
  return async function mymid(ctx: Context, next: () => Promise<any>) {
    // do something

    await next();
  };
};
```

config

```ts
// app/config/config.default.ts

import { Context, EggAppConfig } from 'larva';
import * as path from 'path';

export default (appInfo: EggAppConfig) => {
  const config: any = {};

  config.keys = appInfo.name + '_1513135333623_4128';

  config.static = {
    prefix: '/public',
    dir: path.join(appInfo.baseDir, 'public'),
  };

  return config;
};
```

unittest

```ts
// test/app/controller/account.test.ts

import mm from 'egg-mock';
import { app, assert } from 'egg-mock/bootstrap';

describe('test/app/controller/account.test.js', () => {
  afterEach(() => {
    mm.restore();
  });

  it('访问 login 会应该正常', () => {
    return app.httpRequest()
      .get('/account/login')
      .expect(200);
  });
});
```

## 开发 - 前端

我们的前端是使用 Vue 来开发，而 Vue 2.5 以上对 typescript 的支持已经很好了，社区相关文档也蛮齐全。

在我的项目中，就是直接用 [vue-property-decorator](https://github.com/kaorun343/vue-property-decorator) 来写 vue 组件了。举个例子：

vue

```html
// app/web/page/home/index.vue

<template>
  <div>hello {{ name }} {{ count }}</div>
</template>

<script lang="ts">
  import vm from './vm';
  export default vm;
</script>
```

ts

```ts
// app/web/page/home/vm.ts

import Vue from 'vue';
import { Component } from 'vue-property-decorator';

@Component({
  name: 'Home',
})
export default class Home extends Vue {
  name = 'typescript';
  count = 0;
  
  countNum() {
    setInterval(() => {
      this.count++;
    }, 1000);
  }
  
  mounted() {
    this.countNum();
  }
}
```

我个人开发是喜欢将 ts 的逻辑抽离出来一个单独的文件 vm.ts，而且这样的话，当我在页面中想使用某个组件的实例的时候，可以使用类型指定的方式来达到代码提示的能力，比如：

```ts
// app/web/page/account/vm.ts

import Vue from 'vue';
import { Component } from 'vue-property-decorator';

// 将 Home 引入的同时，也引入 vm
import Home from '../home/index.vue';
import HomeVm from '../home/vm';

@Component({
  name: 'Account',
  components: { Home },
})
export default class Account extends Vue {
  mounted() {
    // 强制指定为 HomeVm
    const home = this.$refs.home as HomeVm;

    // 就可以有代码提示了
    home.countNum();
  }
}
```

之所以这样写，就是为了在 vscode 中开发的时候，有良好的代码提示，虽然说不强制指定类型也是可以编译的，因为 `$refs.xx` 的类型是 any，但是有代码提示的话还是方便很多的。

## 最后

以上基本上就是此次在 egg 中使用 ts 的尝试经验了，以后应该会有更多的项目去尝试用 ts，如果有更好的想法会继续写一些文章进行分享。

