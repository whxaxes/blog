# ts-node 下错误堆栈问题排查小记

## 背景

此前 egg 需要支持 ts，所以我们在 egg-bin 中集成了 ts-node （ 详见 [当 Egg 遇到 TypeScript，收获茶叶蛋一枚](当 Egg 遇到 TypeScript，收获茶叶蛋一枚) ），从而能够让开发者直接跑用 ts 写的 egg 应用，当然也包括单元测试。

但是实际在跑单测的时候却发现，`power-assert`（ [power-assert](https://github.com/power-assert-js/power-assert) 是个很酷的模块，也集成在了 egg-bin 中 ） 却在 ts-node 下失效了，查阅了一下文档发现要引入 [espower-typescript](https://github.com/power-assert-js/espower-typescript) 才能让 `power-assert` 在 ts-node 下生效，引入后发现 `power-assert` 正常了，但是却又有了另一个问题：

![](https://lh3.googleusercontent.com/-TKo0e1xjHjM/W4UWQ2SsI3I/AAAAAAAAAII/OniF3Bu-v2Qhsdt9cPXNTxnRY_B0a38hwCHMYCw/I/15354405535871.jpg)

![](https://lh3.googleusercontent.com/-DlXjxGK0nhc/W4UWQ-mp0qI/AAAAAAAAAIE/Cbfy-dBKx80xE3CALuLkw1NnvOdNbgdnQCHMYCw/I/15354405176504.jpg)

可以看到，当单测出错的时候，错误堆栈中的出错的行数应该是 5，但是实际上却成了 30 ，列数也是一样不对的，可是 `ts-node` 有内置 [source-map-support](https://github.com/evanw/node-source-map-support) ，应该是会自动纠正错误堆栈的行数才对的，为啥还会导致堆栈错误？

> 关于 source-map-support ，可以看一下这篇 [Node.js 中 source map 使用问题总结](https://zhuanlan.zhihu.com/p/26267678)

强迫症表示这可不行啊，这必须得解决，于是开始了对源码的折腾...

## 分析

### espower-typescript ?

由于一旦引入 `espower-typescript` 之后就导致堆栈错误，移除又正常，再加上堆栈错误的原因一般都是 source-map 哪里出问题了，所以首先觉得应该是 `espower-typescript` 里的 source map 处理的问题。看了一下源码，发现里面引入了个 `espower-source` 的模块来处理 source-map 。所以我看了一下 `espower-source` 的源码。

```js
// espower-source/index.js

module.exports = function espowerSource (originalCode, filepath, options) {
    ...
    var espowerOptions = mergeEspowerOptions(options, filepath);
    // 分析出 originalCode 中的 source map，即 ts => js 的 source map
    var inMap = handleIncomingSourceMap(originalCode, espowerOptions);
    ...
    // 将 originalCode 加上 power-assert 的封装
    var instrumented = instrument(originalCode, filepath, espowerOptions);
    // 获取 power-assert 封装后的 source map，即 js => power-asser + js 的 source map
    var outMap = convert.fromJSON(instrumented.map.toString());
    if (inMap) {
        // 合并两个 source map 并且返回
        var reMap = reconnectSourceMap(inMap, outMap);
        return instrumented.code + '\n' + reMap.toComment() + '\n';
    } else {
        return instrumented.code + '\n' + outMap.toComment() + '\n';
    }
};
```

源码不复杂，可以看到 `espower-source` 中会先分析 compile 后的代码，然后从代码中提取出 sourcemap（ 比如 ts 编译成 js 后的 inlineSourceMap ），这个 sourcemap 是从 ts 到 js 的 sourcemap，然后再将编译后的代码做 power-assert 的封装（ 要实现 power-assert 的那种展示效果，是需要对代码做额外包装的 ），同时会生成一个新的 sourcemap ，这个就是从 js 到 封装后的 js 的 sourcemap。然后将两个 source map 合并成一个新的 sourcemap 并且返回。

这咋看之下，逻辑没问题呀，按道理这个新的 sourcemap 应该是可以映射出封装后的 js 到 ts 的位置的。紧接着我将 `instrumented.code` 加了行号之后打印了出来

![](https://lh3.googleusercontent.com/-dT7xl2KF_vM/W4UWRRcosgI/AAAAAAAAAIQ/1J-sGT_pWK8aU1iNiaJPhWHCgmq16_oJwCHMYCw/I/15354448095573.jpg)

可以看到，前面截图中出错的行号正是这个封装后的 js 代码堆栈行号，也就是 sourcemap 是没有映射到 ts 上的。

那是不是合并生成的 sourcemap 是有问题的？抱着这个疑问我又看了一下用来合并 sourcemap 的模块 [multi-stage-sourcemap](https://github.com/azu/multi-stage-sourcemap) 的代码逻辑，也没看出来问题，那只能直接自己手动使用 [source-map](https://github.com/mozilla/source-map) 库来算来一下这个位置，看一下对不对了。

于是在 `espowerSource` 的源码中手动加上了以下这段代码

```js
const SourceMapConsumer = require('source-map').SourceMapConsumer;
// 传入合并后的 sourcemap: reMap.sourcemap
const consumer = SourceMapConsumer(reMap.sourcemap);
const newPosition = consumer.originalPositionFor({
  line: 30,
  column: 15
});
console.info('>>>', newPosition);
```

想通过使用 `source-map` 模块的 `Consumer` 来根据新的 sourcemap ，以及传入上面报错截图中的行数及列数，看下能否算出来正确的 ts 中的行数及列数。结果如下

![](https://lh3.googleusercontent.com/-WRymd18hxAQ/W4UWQ97vZ6I/AAAAAAAAAIM/jHozZjOyDLYtJHKKOvNkZZfZBavQpC37wCHMYCw/I/15354454815892.jpg)

嗯...结果是对的，锅貌似不在 espower-typescript 呀？

### source-map-support ?

那既然锅不是 espower-typescript 的，难道是 `source-map-support` 的？毕竟实际上做 sourcemap 映射的，是我们引入的 `source-map-support` 的模块。

然后又浏览了一下 source-map 的源码，发现 source-map-support 是通过 hook 掉 `Error.prepareStackTrace` 方法来实现在每次出错的时候，能够拿到错误堆栈，并且根据出错代码的 sourcemap 做行数及列数的矫正，于是根据这个代码找到了 source-map-support 中的 `mapSourcePosition` 方法，就是用于错误行数及列数矫正的。

```js
function mapSourcePosition(position) {
  var sourceMap = sourceMapCache[position.source];

  if (!sourceMap) {
    ...
  }

  if (sourceMap && sourceMap.map) {
    var originalPosition = sourceMap.map.originalPositionFor(position);
    if (originalPosition.source !== null) {
      originalPosition.source = supportRelativeURL(
        sourceMap.url, originalPosition.source);
      return originalPosition;
    }
  }

  return position;
}
```

根据上面的测试，我们知道 `originalPositionFor` 方法是用来计算原始位置的，然后我将计算出来的 originalPosition 打印了一下，发现映射出来的 source、line、column 的值全是 null，为啥会是 null ？那只能说明，这里拿到的 sourcemap 是错误的。于是我就将在 `source-map-support` 中拿到的 sourcemap，跟 `espower-typescript` 中最后返回的 sourcemap 做了对比，发现.... 完！全！不！一！样！但是这个 sourcemap 却跟 js => ts 的那个 sourcemap 一毛一样。

也就是说，在 source-map-support 中拿到的 sourcemap 其实是 ts 生成的 sourcemap，而不是 espower-typescript 生成的那串，难怪会导致行数算不出来，都不是同个 sourcemap。

### ts-node !

因为 source-map-support 是 ts-node 引入的，既然 source-map-support 里拿到的是错误的 sourcemap，那肯定就是 ts-node 导致的了，于是又去看 ts-node 的源码，然后就发现了导致该问题的代码。

```js
var memoryCache = {
    contents: Object.create(null),
    versions: Object.create(null),
    outputs: Object.create(null)
};
...
sourceMapSupport.install({
    environment: 'node',
    retrieveFile: function (path) {
        return memoryCache.outputs[path];
    }
});
```

可以看到，在 ts-node 中缓存了编译后的代码，并且在 `source-map-support` 的 retrieveFile 方法中返回缓存值。而 `source-map-support` 的 `retrieveFile` 是用来接收包含 sourcemap 信息的代码文件的。因为 ts-node 在 `source-map-support` 获取 sourcemap 的时候稳定返回了缓存值，所以就导致 espower-typescript 中生成的 sourcemap 没有生效。

## 解决方案

既然知道了原因，要解决就很简单了，直接复写 `source-map-support` 的 `retrieveFile` 方法，返回正确的缓存值：

```js
const sourceMapSupport = require('source-map-support');
const cacheMap = {};
const extensions = ['.ts', '.tsx'];

sourceMapSupport.install({
  environment: 'node',
  retrieveFile: function (path) {
    // 根据路径找缓存的编译后的代码
    return cacheMap[path];
  }
});

extensions.forEach(ext => {
  const originalExtension = require.extensions[ext];
  require.extensions[ext] = (module, filePath) => {
    const originalCompile = module._compile;
    module._compile = function(code, filePath) {
      // 缓存编译后的代码
      cacheMap[filePath] = code;
      return originalCompile.call(this, code, filePath);
    };
    return originalExtension(module, filePath);
  };
})
```

经过验证，在引入 espower-typescript 之后再引入上面的代码，就可以解决这个问题了。

## 最后

最后这么来看，其实也不是 ts-node 的锅，因为 ts-node 的特殊性（ 不会生成包含 sourceMap 的 js ），所以必须得在 `source-map-support` 的 `retrieveFile` 方法返回缓存在内存中的 js 代码，否则 `source-map-support` 自己去读 ts 文件的话也是拿不到 sourcemap ，一样会导致堆栈行数错误。

主要原因还是在于多个模块都是基于修改 `module._compile` 来实现，大家都生成了 sourcemap，但是没有考虑如何能被 `source-map-support` 正确消费而已。

当查出这个原因之后，发现导致这个的原因并不复杂，只是从出现问题，到解决问题这个过程还是比较折腾的（ 也有可能是我学艺不精，绕了个圈子[摊手] ），各种看源码....正所谓一言不合就看源码。

写这篇文章，也是方便之后，如果有其他类似的通过修改 `module._compile` 来实现的模块出现堆栈问题的时候，提供一种这样的解决思路。




