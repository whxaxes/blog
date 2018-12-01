# [WIP]如何给 Egg 项目写 d.ts 声明

在 Egg 的诸多插件中，有不少还缺乏 ts 的支持，需要社区的同学为其补充 `d.ts` 从而支持 ts ，但是有不少人不知道如何给 egg 插件写声明，也不知道如何为其写单元测试，因此写这篇文章来说明一下这种单测该如何来写？

## Egg 项目

### 声明添加

如果要给 Egg 添加声明，需要通过 `Declaration Merging` 给 Egg 的对象声明添加属性类型，一般来说，在插件中都只需要给 Egg 的 `Application`、`Context`、`EggAppConfig` 这几个常用的对象进行拓展。而拓展方式也很简单，直接通过 `declare module 'egg'` 将 egg 声明合并进去即可。

```typescript
// 为了保证在执行到 declare module 之前先加载 egg 的声明，最好在前面 import 一下 egg
import 'egg';

declare module 'egg' {
  interface Application {
    // 在这里扩展 app
  }

  interface Context {
    // 在这里扩展 context
  }

  interface EggAppConfig {
    // 在这里扩展插件配置
  }
}
```

举个例子，如果我有一个 egg 插件叫 `egg-my-plugin` ， 在这个插件中，我拓展了一个 `app.myPlugin` 的对象，同时需要添加一些配置的话就可以这么来写

```typescript
// egg-my-plugin/index.d.ts

import 'egg';

declare module 'egg' {
  interface Application {
    myPlugin: string;
  }

  interface EggAppConfig {
    myPlugin: {
      name: string;
      prefix: string;
    }
  }
}
```

在插件项目下添加 `index.d.ts` 文件，并且添加以上代码即可完成声明的添加，同时记得在 `package.json` 中补上 `typings` 以及将 `index.d.ts` 加到 `files` 中。

```json
{
  ...
  "typings": "index.d.ts",
  "files": {
    "index.d.ts",
    ...
  }
  ...
}
```

### 单测编写

写好声明之后，单测是必不可少的，我们需要通过单测来验证一下声明编写是否没问题。还是上面那个例子


