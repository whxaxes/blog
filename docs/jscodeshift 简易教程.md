# jscodeshift 简易教程

## 背景

[jscodeshift](https://github.com/facebook/jscodeshift) 是 fb 出的一个 codemod toolkit，基于 [recast](https://github.com/benjamn/recast) 这个 js 解析器封装了很多方便使用的工具方法。但是由于官网对使用方式的描述有点谜，刚用起来会有点蛋疼，所以写篇教程说一下。

简单先说明一下 jscodeshift 能用来干嘛，其实就是能够解析 js ，将 js 内容解析成 AST 语法树，然后提供一些便利的操作接口，方便我们对各个节点进行更改，比如更改所有的属性名之类的。比如这个官方提供的最简单的 demo：

```js
const j = require('jscodeshift');

j(jsContent)
    .find(j.Identifier)
    .replaceWith(
      p => j.identifier(p.node.name.split('').reverse().join(''))
    );
```
 
可以实现的效果就是：

```js
console.log('123')
```

会被转换为

```js
elosnoc.gol('123')
```


更复杂一些的话，我们甚至可以基于 jscodeshift 来做类似于 babel 的功能，将 es6 转换为 es5，当然已经有 babel 的情况下就没必要去再实现了，那还可以做啥？就是 codemod，也就是代码自动升级工具，比如框架进行了一个大的升级，业务代码要升级框架要进行大量更改，而这些更改操作就可以通过 jscodeshift 来实现了。


## 使用

在具体说 jscodeshift 如何使用之前，有个网站是必须得配合使用的，就是 jscodeshift 提供的一个 ast 可视化工具 [AST explorer](http://astexplorer.net/)。

基本上使用 jscodeshift 都要配合这个站点上可视化的 ast tree 来实现。

比如我有一串 js 内容为下面这段

```js
app.say = function(test) {
  console.log(test);
}

app.get('/api/config/save', checkConfigHighRiskPermission, function() {
  console.log('cool')
});

app.say('123')
```

你们可以自己把代码贴到 ast explorer 中用鼠标移到各个节点看看，在这里不好截那么大的图，就只截了 ast tree 的结构：

![image](https://user-images.githubusercontent.com/5856440/30771051-796321c0-a071-11e7-933a-7a90cee62f84.png)

可以看到有三个 ExpressionStatement 结构，如果我们点开中间那个，其实也就是 app.get 那串代码，结果就如下：

![image](https://user-images.githubusercontent.com/5856440/30770981-517c5fce-a070-11e7-8500-22b84645fe75.png)

可以看到上面那串代码被转换成了这么一种树形结构，其中 ExpressionStatement 代表的是表达式模块，也就是 app.get 整个串代码，而其中的 MemberExpression 代表的是 `app.get`，arguments 代表的是后面的方法参数那串，然后按顺序，Literal 就是 `'/api/config/save'`，Identifier 就是 `checkConfigHighRiskPermission`，然后 FunctionExpression 就是最后的那个方法。

那么，如果我需要把上面代码中的 `app.get...` 的那段代码，把里面的 app.get 换成 app.post，并且把 app.get 中的那个回调方法，换成一个 generator 该怎么换？

首先，我们需要通过 find 方法查找到 app.get 这串代码的节点，而查找方式就是按照 ast explorer 中的结构来查找

```js
const ast = j(jsContent).find(j.CallExpression, {
    callee: {
        object: {
            name: 'app'
        },
        property: {
            name: 'get'
        }
    }
});
```

通过 find 方法，查找所有的 CallExpression，然后传入查询条件，查询条件其实就是 CallExpression 中的 json 结构，所以传入 callee.object.name 为 app，然后传入 callee.property.name 为 get，找到的 path 就是我们要的 path 了。

找到我们需要的 CallExpression 之后，先替换 app.get 为 app.post，直接接着上面的代码写：

```js
// 找到名称为 get 的 Identifier ，然后替换成一个新的 identifier
ast.find(j.Identifier, { name: 'get' })
    .forEach(path => {
        j(path).replaceWith(j.identifier('post'));
    });
```

然后是替换 function 为 generator：

```js
// 找到 app.get 表达式中的 function，替换成 generator function
ast.find(j.FunctionExpression)
    .forEach(path => {
        j(path).replaceWith(
            j.functionExpression(
                path.value.id,     // identify 方法名
                path.value.params, // 方法参数
                path.value.body,   // 方法体
                true,              // 是否为 generator
                false              // expression
            )
        )
  	})
```

然后再调用:

```js
ast.toSource();
```

就可以看到代码已经被改成：

```js
app.say = function(test) {
  console.log(test);
}

app.post('/api/config/save', checkConfigHighRiskPermission, function*() {
  console.log('cool')
});

app.say('123')
```

简单来说，在 ast explorer 出现了的 type，在 jscodeshift 中都可以用来查找，比如我要找 MemberExpression 就 `j.MemberExpression`，我要找 Identifier 就 `j.Identifier`。所以需要什么类型的节点，就 `j.类型名称` 就能查到所有这个类型的节点。

如果想了解所有的类型：可以戳这个链接 https://github.com/benjamn/ast-types/tree/master/def 

说完类型，如果我们要创建一个某种类型的节点，就像上面的通过 replaceWith 成新的 generator 节点，也是跟类型一样的，只是首字母小写了，比如我要创建一个 MemberExpression 就调用 `j.memberExpression(...args)`，我要创建一个 FunctionExpression 就调用 `j.functionExpression(...args)`，而至于入参要传什么，在 ast explorer 写代码的时候，只要写了这个方法就会有入参提示：

![image](https://user-images.githubusercontent.com/5856440/30771296-f0cf0a62-a076-11e7-9f43-4c783a294932.png)

知道了这些，再举个例子，我要把上面的 function 不替换成 generator 了，而是替换成箭头函数也是一样，就只需要改成使用 arrowFunctionExpression 方法即可：

```js
ast.find(j.FunctionExpression)
    .forEach(path => {
        j(path).replaceWith(
            j.arrowFunctionExpression(
                path.value.params,   // 方法参数
                path.value.body,     // 方法体
                false                // expression
            )
        )
  	})
```

上面说的都是 replaceWith，也就是替换节点。如果我们想要插入一个节点，比如也是上面的 app.get 中，我想在后面的回调中再插入一个回调。就可以直接用 insertAfter：

```js
ast.find(j.FunctionExpression)
    .forEach(path => {
        j(path).insertAfter(
            j.arrowFunctionExpression(
                path.value.params,   // 方法参数
                path.value.body,     // 方法体
                false                // expression
            )
        )
  	})
```

同时，对应 insertAfter 这个方法，还有一个 insertBefore。反正用起来都是很简单的。

## 最后

上面说的 `find`、`forEach`、`replaceWith`、`insertAfter`、`insertBefore` 方法都是比较常用，除此之外还有 `filter`、`get` 等方法，具体有哪些方法可以直接看 jscodeshift 的 collection [源码](https://github.com/facebook/jscodeshift/blob/master/src/Collection.js)。个人觉得直接看源码比看文档简单多了。



