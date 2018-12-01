# 如何实现一个模板引擎二：优化

## 前言

在上一篇文章中讲了怎么来实现一个模板引擎，而写完上一篇文章的时候，我的模板引擎也确实是造出来了，不过起初的实现还是比较简陋，就想着做一下性能优化，让自己的轮子，真正能成为可用的组件，而不仅仅是一个 demo。于是就有了这篇文章。

## 工具

在做组件优化的时候，总不可能自己觉得那样写会提升性能就那样写了，很多时候，瞎尝试可能会带来反效果，所以我们需要一个工具来验证自己的优化是否有效，业界最常用的就是 benchmark.js 了，因此，我也是用 benchmark 来做验证。

除了 benchmark 之外，我们最好还需要一个用来对比的东西，才知道要优化到什么程度才可以。而我的组件的语法是参考 nunjucks 做的，因此我就理所当然的选择了 nunjucks 来做对比了。

## 优化之前

在做优化之前，我先写了几个 benchmark 来测一下。

```terminal
Mus#renderExtend x 10,239 ops/sec ±0.93% (88 runs sampled)
Nunjucks#renderExtend x 16,468 ops/sec ±2.13% (82 runs sampled)
Fastest is Nunjucks#renderExtend
Mus#renderNormal x 16,388 ops/sec ±0.98% (86 runs sampled)
Nunjucks#renderNormal x 44,464 ops/sec ±1.16% (88 runs sampled)
Fastest is Nunjucks#renderNormal
Mus#renderSimple x 53,138 ops/sec ±1.07% (89 runs sampled)
Nunjucks#renderSimple x 275,825 ops/sec ±1.63% (86 runs sampled)
Fastest is Nunjucks#renderSimple
```

简直全方面被吊打。简单说一下这几个 benchmark 的测试例子是怎样的：`renderExtend` 是测试有 extend 其他模板文件的测试例子，`renderNormal` 是渲染一段比较多嵌套的模板，`renderSimple` 是渲染一段非常简单，只有变量的模板。

具体可以看 https://github.com/whxaxes/mus/tree/master/benchmark 

## 优化实现

### 1. 能在 ast 阶段做的事，尽量在 ast 阶段做好

做模板渲染之前，都会先生成 ast 并且缓存起来，从而将一切准备工作准备好，尽量减少渲染时候的计算量，从而提升性能。

在此前的实现中。如果有看过上一篇文章的人应该有印象，在进行变量渲染的时候，会把表达式用方法字符串包装起来，并且创建一个方法实例，但是这个行为是在渲染阶段做的。也就是以下这段：

```javascript
function computedExpression(obj, expression) {
  const methodBody = `return (${expression})`;
  const funcString = obj ? `with(_$o){ ${methodBody} }` : methodBody;
  const func = new Function('_$o', '_$f', funcString);
  try {
    const result = func(obj, processFilter);
    return (result === undefined || result === null) ? '' : result;
  } catch (e) {
    // only catch the not defined error
    if (e.message.indexOf('is not defined') >= 0) {
      return '';
    } else {
      throw e;
    }
  }
}
```
但是其实创建方法实例，是完全可以在构建 ast 阶段就准备好的，而渲染阶段，就只需要执行已经准备好的 render function 即可。

上面贴的 benchmark 结果其实是已经做了这个优化的了，在做这个优化之前，`renderNormal`只有 7000ops/sec 而已。

### 2. path.resolve

刚开始，上面的 benchmark 中有一点让我特别疑惑，就是 `renderSimple` 的差距，只是一个变量渲染而已，怎么会差那么多，经过排查，发现代码中在读取模板文件的时候，每次都会进行 `path.resolve` 来获取文件的绝对路径。于是立马对该操作进行了缓存。跑分立马就上去了。

### 3. for 循环的优化。

在此前的实现中是这样的：

```javascript
utils.forEach(result, (value, key, index, len) => {
 const o = {
   [el.value]: value,
   loop: {
     index: index + 1,
     index0: index,
     length: len,
   }
 };

 if (el.index) {
   o[el.index] = key;
 }

 html += this.processAst(el.children, Object.assign({}, scope, o));
});
```

注意到每个 for 循环中都会重新做一次对象的浅拷贝，而其实完全没必要，因为在每个 for 循环中需要的对象都是类似的，因此只需要做一个浅拷贝即可。就改成了：

```javascript
utils.forEach(result, (value, key, index, len) => {
 loopScope = loopScope || Object.assign({}, scope);
 loopScope[el.value] = value;
 loopScope.loop = {
   index: index + 1,
   index0: index,
   length: len,
 };

 if (el.index) {
   loopScope[el.index] = key;
 }

 html += this.processAst(el.children, loopScope);
});
```

### 4. 对表达式进行预处理

此前的实现中，无论什么样的表达式，都一股脑，直接拼成方法来处理，而且此前的都是用 with 来包裹的，而被 with 包裹的代码，在 js 引擎解析的时候是没法做优化的，执行效率特别慢。

因此可以在构建 AST 阶段，对表达式做预处理：

1. 如果是简单的字符串，或者数字，就完全都不需要创建 function 了，直接返回即可。
2. 如果是简单的变量输出，比如`{{ test }}`或者`{{ test.value }}`之类的，就不需要用 with 包裹。直接拼成`{{ _$o.test }}`，然后再创建 function。
3. 剩下的就是有运算符之类的，这种不太好解析，就直接用 with 包裹了。

```javascript
  if (stringRE.test(expr) || numberRE.test(expr)) {
    el.expression = RegExp.$1 || el.expression;
  } else if (objectRE.test(expr)) {
    // simple render, like {{ test }}
    computedString = `_$o.${utils.nlEscape(expr)}`;
  } else {
    // computed render, like {{ test > 1 ? 1 : 2 }}
    computedString = `(${utils.nlEscape(expr)})`;
    useWith = true;
  }

  // create render function
  if (computedString) {
    let funcStr = `
      var result = ${computedString};
      return (result === undefined || result === null) ? '' : result;
    `;

    if (useWith) {
      funcStr = `with(_$o){ ${funcStr} }`;
    }

    el.render = new Function('_$o', '_$f', funcStr);
  }
```

### 5. filter 的优化

在第4点中，我会对表达式做一个类型判断，但是还不够，按照此前实现的 filter 的逻辑，有 filter 的表达式，会被组装成`_$f('nl2br')(test)`的格式，一旦被组装后，到第四点中的表达式判断的时候，就会被认为是比较复杂的类型从而选择使用 with 来组合渲染方法。所以这个也是可以优化的点。然后就把 filter 的处理部分改成：

```javascript
  let flStr = ''; // _$f('json')(_$f('nl2br')(
  let frStr = ''; // ))

  if (matches) {
    expr = expr.substring(0, matches.index);
    const filterString = matches[0];

    // collect filter string
    while (filterRE.test(filterString)) {
      const name = RegExp.$1;
      const args = RegExp.$2;
      if (name === 'safe') {
        el.safe = true;
      } else {
        flStr = `_$f('${name}')(${flStr}`;
        if (args) {
          frStr = `${frStr}, ${args.substring(1)}`;
        } else {
          frStr = `${frStr})`;
        }
      }
    }
  }
```

把 filter 的 function string 分为左半边以及右半边来进行收集，在做完类型检查之后，再把 filter 组合起来。这样的话，filter 就不影响类型检查了。

```javascript
  // create render function
  if (computedString) {
    computedString = utils.nlEscape(`${flStr}${computedString}${frStr}`);
    let funcStr = `
      var result = ${computedString};
      return (result === undefined || result === null) ? '' : result;
    `;

    ...
  }
```

除了以上几个，还有将所有的 for 循环改成了 while 循环，经过一系列优化后再次跑 benchmark：

```javascript
Mus#renderExtend x 48,836 ops/sec ±1.04% (88 runs sampled)
Nunjucks#renderExtend x 17,738 ops/sec ±2.35% (76 runs sampled)
Fastest is Mus#renderExtend
Mus#renderNormal x 62,793 ops/sec ±0.93% (91 runs sampled)
Nunjucks#renderNormal x 56,013 ops/sec ±1.00% (90 runs sampled)
Fastest is Mus#renderNormal
Mus#renderSimple x 594,982 ops/sec ±1.38% (89 runs sampled)
Nunjucks#renderSimple x 295,682 ops/sec ±1.45% (82 runs sampled)
Fastest is Mus#renderSimple
```

在已有的测试例子中，分数都超过 nunjucks 。也算是优化成功了。

写本文更多是记录一下自己的优化过程。可能没啥干货，有兴趣的看看，没兴趣的也请勿喷。

最后再贴上项目地址：https://github.com/whxaxes/mus 



