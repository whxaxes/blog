# Egg Ts 改造总结

最近参与了 egg 的 ts 支持改造工作，写篇文章总结一二。

在上一篇文章 [Typescript 在 Egg + Vue 应用中的实践](https://github.com/whxaxes/blog/issues/11) 中在 Egg 项目中做了尝试，但是那时候还不够完善，比如 ts 需要通过 tsc 来生成 js，会产生大量中间文件，而且 scripts 又长又丑。再比如那时实现 controller 等的注入是需要手动写 d.ts 来实现。

所以为了能让我们用 ts 开发 egg 更方便，我们做了以下这些事。

## ts-node 支持

### loader 改造

我们期望在开发期不产生 js 文件就能够把应用跑起来，而业界刚好有这么个工具 [ts-node](https://github.com/TypeStrong/ts-node)，能够支持不生成中间文件，直接运行 ts 代码，于是兴冲冲的进行了尝试，结果却注意到因为 egg 是自动加载各个模块，并且 egg-loader 很多是 hardcode 写死了加载 `*.js` 的，所以为了让 egg 支持 ts-node，做的第一件事就是改造 egg-loader，于是提了个 [PR](https://github.com/eggjs/egg-core/pull/156) 让 egg-loader 支持了 typescript。

简单来说，就是增加了一个 `typescript` 的入参，如果该值为 true，并且 `require.extensions` 中包含 `.ts` 的处理逻辑，loader 就会去加载 `*.(ts|js)`。

### 开发工具改造

在改造之前的 scripts 是这样的

```json
{
  "scripts": {
     "dev": "npm run tsc && concurrently -r \"npm run tsc:w\" \"egg-bin dev\"",
     "debug": "npm run tsc && concurrently -r \"npm run tsc:w\" \"egg-bin debug\"",
     "tsc": "tsc -p tsconfig.json",
     "tsc:w": "tsc -p tsconfig.json -w"
  }
}
```

又长又臭，因此仅 egg-loader 支持加载 ts 代码之后还不够，我们平时开发习惯性用 `egg-bin` 进行开发，而 `egg-bin` 启动 egg 是通过 egg-cluster 启动的，所以我们需要给 egg-bin 加上一个入参，能够透传到 egg-cluster 从而开启 egg-loader 的 typescript。

最终天猪那边提了 N 个 PR 之后，也完成了 egg-bin 对 ts 的支持。现在我们的 scripts 可以精简到了这样

```json
{
  "scripts": {
    "dev": "egg-bin dev --ts",
    "debug": "egg-bin debug --ts"
  }
}
```

或者这样（更建议下面这种方式）

```json
{
  "scripts": {
    "dev": "egg-bin dev",
    "debug": "egg-bin debug",
  },
  "egg": {
    "typescript": true
  }
}
```

## 模块注入

我们都知道，egg 加载各个模块是直接通过 loader 自动加载的，也就是模块注入是自动的，也正因为如此，ts 是没法知道 controller,service 等目录下的代码被挂载到了 egg 下，会导致在编译或者代码提示上都会有不同层面的影响，而要解决这个问题主要有两种方案，一种是使用 shepherdwind 写的 [egg-di](https://github.com/shepherdwind/egg-di) 提供的装饰器来做依赖注入，还有一种就是通过 ts 提供的 Declaration Merging 能力来编写 d.ts ，从而告诉 egg 这些模块其实是已经被引入了。

由于我个人习惯于 egg 的自动加载，所以平时项目中都选择了第二种方式，也就是通过编写 d.ts 来实现注入。而注入的原理很简单，比如在 egg 的 d.ts 中申明的 Application 对象。

```typescript
declare module 'egg' {
  export interface IController {}

  export interface Application {
    controller: IController;
  }
}
```

其中 `IController` 这个 service 可以当成是一个 slot，可以在应用中通过 Declaration Merging 给 IController 添加属性，然后这些属性也就自动添加进了 `app.controller` 中。这个也是 egg ts 最早的实践者 shepherdwind 他们想出来的办法。

但是这个又带来个问题，每次新增一个 controller、service、config 等都需要手动去编写 d.ts 啊，所以又想干脆写个工具来自动生成算了，于是我就开发了一个小工具 [egg-ts-helper](https://github.com/whxaxes/egg-ts-helper) 来减少手动编写 d.ts 的工作。

自动生成的原理很简单，其实每一个生成都是有规律可循的。比如 controller、service，我只需要知道目录结构就能够生成 d.ts。因为每个 controller 和 service 都是直接 export default 相关 class 的。

因此我只需要遍历 controller、service 的目录，根据 egg 的 loader 命名规范，将所有的 controller、service import 到 d.ts，然后再挂载到 `IController` 及 `IService` 下即可。

ts

```typescript
// app/controller/home.ts
import { Controller } from 'egg';

export default class HomeController extends Controller {
  public async index() {
    this.ctx.body = 'ok';
  }
}
```

typings

```typescript
// app/typings/app/controller/index.d.ts
import Home from '../../../app/controller/home';

declare module 'egg' {
  interface IController {
    home: Home;
  }
}
```

而 config 和 extend 就相对要麻烦一些，得去解析代码生成语法树并且做分析，好在 typescript 用来解析代码生成 AST 还是相当方便的，typescript 中提供了很多便利的工具方法用于遍历 AST、节点判断。

比如生成 AST 只需要调用 `createSourceFile` 即可。 

```typescript
import * as ts from 'typescript';
const sourceFile = ts.createSourceFile(f, code, ts.ScriptTarget.ES2017, true);
```

然后就可以对 AST 进行遍历操作并且分析，对 AST 的一些操作文档可以看 typescript 的 wiki：[Using-the-Compiler-API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API) 。不过文档写的相对比较简略，很多情况下还是需要自己摸索，有兴趣的可以参考 egg-ts-helper 的[源码](https://github.com/whxaxes/egg-ts-helper/blob/master/src/generators/extend.ts#L69) 了解如何使用。

有了 AST 大法之后，就可以解析 extend 目录下的代码，分析 export 出来的对象以及其属性，并且将这些属性加到 d.ts 中，从而实现 extend 的代码的代码提示。

ts

```typescript
// app/extend/context.ts
export default {
  doSomething() {
    console.info('do something');
  }
};
```

typings

```typescript
// app/typings/app/controller/index.d.ts
import ExtendObject from '../../../app/extend/context';

declare module 'egg' {
  interface Context {
    doSomething: typeof ExtendObject.doSomething;
  }
}
```

而 config 的话，因为刚好 typescript 2.8 提供了 [ReturnType](https://github.com/Microsoft/TypeScript/wiki/What's-new-in-TypeScript#type-inference-in-conditional-types) 这个利器，因此也是可以很方便的分析 config export 出来的如果是对象，就直接用 typeof，否则则用 ReturnType。

ts

```typescript
// config/config.default.ts
export default function() {
  return {
    keys: '123456'
  }
}
```

typings

```typescript
// app/typings/config/index.d.ts
import { EggAppConfig } from 'egg';
import ExportConfigDefault from '../../config/config.default';
type ConfigDefault = ReturnType<typeof ExportConfigDefault>;
type NewEggAppConfig = EggAppConfig & ConfigDefault;

declare module 'egg' {
  interface Application {
    config: NewEggAppConfig;
  }

  interface Controller {
    config: NewEggAppConfig;
  }

  interface Service {
    config: NewEggAppConfig;
  }
}
```

然后还有最后一个，就是 plugin.ts 的生成啦，也很简单，就是直接分析 plugin 中引入的 package 名称，然后生成 d.ts 并且将 package import 进来。

ts

```typescript
// config/plugin.ts
export default {
  cors: {
    enable: true,
    package: 'egg-cors',
  },
  static: {
    enable: true,
    package: 'egg-static',
  }
}
```

typings

```typescript
// app/typings/config/plugin.d.ts

import 'egg-cors';
import 'egg-static';
```

## 代码提示

让 egg 支持模块注入之后，基本上该有的代码提示都有了，但是我们还想做的更多，其中一个就是 config 编写中的代码提示。也就是，当我们在写配置的时候，能够有代码提示告诉我们有哪些配置可以选择写！所以首先想到的是

```typescript
// config/config.default.ts
import { EggAppConfig } from 'egg';

export default () => {
  const config = {} as EggAppConfig;
  config.static = {
    defaultEngines: 'xxx'
  };
  return config;
}
```

但是这样会报错，为什么呢，因为 EggAppConfig 中的所有配置，都是不带 `?` 这个 modifier 的，因此每一个配置，都必须要将申明的配置每个都写一遍才行。这样也是不能忍受的，那该如何是好，把 EggAppConfig 的配置全部加上 `?` 么。但是如果加上了，在使用这些配置的时候，又要么得

```typescript
if (app.config.static) {
  // use app.config.static
}
```

要么就使用 `!.`

```typescript
app.config.static!.defaultEngines
```

因为加上了 `?` 之后，配置的类型在 ts 看来都可能是 undefined，所以要么使用 `!.` 要么就只能通过 if else 来判断存在后才能使用。

然后又多亏了 typescript 2.8 提供了 [Conditional Types](https://github.com/Microsoft/TypeScript/wiki/What's-new-in-TypeScript#conditional-types) 的能力，我们在 Egg 中提供了一个 PowerParitial 的类型。

```typescript
export type PowerPartial<T> = {
    [U in keyof T]?: T[U] extends object
      ? PowerPartial<T[U]>
      : T[U]
  };
```

能够将多层的对象申明都添加上 `?`。于是我们的 config 就可以这么写也不会报错了，而且也能得到代码提示。

```typescript
// config/config.default.ts
import { EggAppConfig, PowerPartial } from 'egg';

export default () => {
  const config = {} as PowerPartial<EggAppConfig>;
  config.static = {
    defaultEngines: 'xxx'
  };
  return config;
}
```

然后如果我想将业务配置，也加到代码提示当中呢？总结下来，有两种方案：

如果不嫌烦的话，可以写一个 `BizConfig` 的 interface

```typescript
// config/config.default.ts
import { EggAppConfig, PowerPartial } from 'egg';

interface BizConfig {
  news: {
    pageSize: number;
    pageUrl: string;
  }
}

export default () => {
  const config = {} as PowerPartial<EggAppConfig> & BizConfig;
  config.news = {
    pageSize: 123,
    pageUrl: 'xxxx'
  };
  return config;
}
```

由于上面生成的 d.ts 会将 config 返回的类型注入到 app.config 中，因此这样返回之后，也可以直接在业务代码中通过 `app.config.news.pageSize` 获得。

如果觉得写 interface 很麻烦，那么还有第二种方法，不过就得将业务配置以及 Egg 配置分开写

```typescript
// config/config.default.ts
import { EggAppConfig, PowerPartial } from 'egg';

export default () => {
  const config = {} as PowerPartial<EggAppConfig>;
  config.static = {
    ...
  }
  
  const bizConfig = {
    news: {
      pageSize: 123,
      pageUrl: 'xxxx'
    }
  };

  return { 
    ...config,
    ...bizConfig
  };
}
```

在 config.default.ts 中写的业务配置，如果我想在 config.local.ts 以及 config.prod.ts 中也有代码提示的话，也很简单，直接通过 ReturnType 就可以拿到 config.default 中返回的配置类型了。

```typescript
// config/config.prod.ts
import { EggAppConfig, PowerPartial } from 'egg';
import defaultConfig from './config.default';
type DefaultConfig = ReturnType<typeof defaultConfig>;

export default () => {
  const config = {} as PowerPartial<DefaultConfig>;
  config.news = {
    pageSize: 30
  };
  return config;
}
```

由于我们在 config 中的配置，也能够被同名的 middleware 消费，而如果我们想在 middleware 中拿到配置的代码提示就可以这么写：

```typescript
// middleware/news.ts
import defaultConfig from './config.default';
type DefaultConfig = ReturnType<typeof defaultConfig>;

// 这里注意，只能用 DefaultConfig['news']，不能用 DefaultConfig.news
// 因为 DefaultConfig 是类型，不是实例，所以不能用 .
export default (options: DefaultConfig['news']) => {
  return async function(ctx, next) {
    console.info(options.pageSize);
    await next();
  }
}
```

除了 config，我们还期望写 plugin 配置的时候也能有代码提示，所以我也给 egg 加了个 `EggPlugin` 的声明，因此写 plugin 配置的时候，也能够有代码提示了：


```typescript
import { EggPlugin } from 'egg';

const pluginList = {} as EggPlugin;
pluginList.static = true;

export default pluginList;
```

以上均可以在我自己用来测试的项目 [egg-boilerplate-d-ts](https://github.com/whxaxes/egg-boilerplate-d-ts) 中进行体验测试。

## 最后

至此，就是此次 egg ts 改造所做的一些事了，不合理的地方欢迎指出，共同提升 egg 的 ts 开发体验。


