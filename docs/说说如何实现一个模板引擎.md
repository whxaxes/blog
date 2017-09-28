# 说说如何实现一个模板引擎

## 前言

不知不觉就很长时间没造过什么轮子了，以前一直想自己实现一个模板引擎，只是没付诸于行动，最近终于在业余时间里抽了点时间写了一下。因为我们的项目大部分用的是 swig 或者 nunjucks ，于是就想实现一个类似的模板引擎。

至于为什么要做这么一个东西？基本上每一个做前端的人都会有自己的一个框架梦，而一个成熟的前端框架，模板编译能力就是其中很重要的一环，虽然目前市面上的大部分框架 vue、angular 这些都是属于 dom base 的，而 swig nunjucks ejs这些都是属于 string base 的，但是其实实现起来都是差不多的。不外乎都是 `Template` =parse=> `Ast` =render=>`String`。

再者，做一个模板引擎，个人感觉还是对自身的编码能力的提升还是很有帮助的，在性能优化、正则、字符解析上尤为明显。在日后的业务需求中，如果有一些需要解析字符串相关的需求，也会更得心应手。

## 功能分析

一个模板引擎，在我看来，就是由两块核心功能组成，一个是用来将模板语言解析为 ast（抽象语法树）。还有一个就是将 ast 再编译成 html。

先说明一下 ast 是什么，已知的可以忽略。

> 抽象语法树（abstract syntax tree或者缩写为AST），或者语法树（syntax tree），是源代码的抽象语法结构的树状表现形式，这里特指编程语言的源代码。树上的每个节点都表示源代码中的一种结构。之所以说语法是“抽象”的，是因为这里的语法并不会表示出真实语法中出现的每个细节。比如，嵌套括号被隐含在树的结构中，并没有以节点的形式呈现；而类似于if-condition-then这样的条件跳转语句，可以使用带有两个分支的节点来表示。

在实现具体逻辑之前，先决定要实现哪几种 tag 的功能，在我看来，`for`，`if else`，`set`，`raw`还有就是基本的变量输出，有了这几种，模板引擎基本上也就够用了。除了 tag，还有就是 filter 功能也是必须的。

## 构建 AST

我们需要把模板语言解析成一个又一个的语法节点，比如下面这段模板语言：

```html
<div>
    {% if test > 1 %}
        {{ test }}
    {% endif %}
</div>
```

很明显，div 将会被解析为一个文本节点，然后接着是一个块级节点 if ，然后 if 节点下又有一个变量子节点，再之后有是一个 </div> 的文本节点，用 json 来表示这个模板解析成的 ast 就可以表示为：

```javascript
[
    {
        type: 1,
        text: '<div>'
    },
    {
        type: 2,
        tag: 'if',
        item: 'test > 1',
        children: [{
           type: 3,
           item: 'test'
        }]
    },
    {
        type: 1,
        text: '</div>'
    }
]
```

基本上就分成三种类型了，一种是普通文本节点，一种是块级节点，一种是变量节点。那么实现的话，就只需要找到各个节点的文本，并且抽象成对象即可。一般来说找节点都是根据模板语法来找，比如上面的块级节点以及变量节点的开始肯定是`{%`或者`{{`，那么就可以从这两个关键字符下手：

```javascript
...
const matches = str.match(/{{|{%/);
const isBlock = matches[0] === '{%';
const endIndex = matches.index;
...
```

通过上面一段代码，就可以获取到处于文本最前面的`{{`或者`{%`位置了。

既然获取到了第一个非文本类节点的位置，那么该节点位置以前的，就都是文本节点了，因此就已经可以得到第一个节点，也就是上面的`<div>`了。

获取到 div 文本节点后，我们也可以知道获取到的第一个关键字符是`{%`，也就是上面的`endIndex`是我们要的索引，记得要更新剩余的字符，直接通过 slice 更新即可：

```
// 2 是 {% 的长度
str = str.slice(endIndex + 2);
```

而此时我们就可以知道匹配到的当前关键字符是`{%`，那么他的闭合处就肯定是`%}`，因此就可以再通过

```javascript
const expression = str.slice(0, str.indexOf('%}'))
```

获取到 `if test > 1` 这个字符串了。然后我们再通过正则`/^if\s+([\s\S]+)$/`匹配，就可以知道这个字符串是 if 的标签，同时可以获得`test > 1`这一个捕获组，然后就可以创建我们的第二个节点，if 的块级节点了。

因为 if 是个块级节点，那么继续往下匹配的时候，在遇到 `{% endif %}` 之前的所有节点，都是属于 if 节点的子节点，所以我们在创建节点时要给它一个`children`数组属性，用来保存子节点。

紧接着再重复上面的操作，获取下一个`{%`以及`{{`的位置，跟上面的逻辑差不多，获取到`{{`的位置后再判断`}}`的位置，就可以创建第三个节点，test 的变量节点，并且 push 到 if 节点的子节点列表中。

创建完变量节点后继续重复上述操作，就能够获取到`{% endif %}`这个闭合节点，当遇到该节点之后的节点，就不能保存到 if 节点的子节点列表中了。紧接着就又是一个文本节点。

相对比较完整的实现如下：

```javascript
const root = [];
let parent;
function parse(str){
    const matches = str.match(/{{|{%/);
    const isBlock = matches[0] === '{%';
    const endIndex = matches.index;
    
    const chars = str.slice(0, matches ? endIndex : str.length);
    if(chars.length) {
     ...创建文本节点 
    }
    
    if(!matches) return;
    
    str = str.slice(endIndex + 2);
    const leftStart = matches[0];
    const rightEnd = isBlock ? '%}' : '}}';
    const rightEndIndex = str.indexOf(rightEnd);
    const expression = str.slice(0, rightEndIndex)
    
    if(isBlock) {
       if( 如果是块级节点 ) {
            ...创建块级节点 el
            
            parent = el;
       } else if( 是块级节点的闭合节点（endfor、endif ..） ) {
            parent = parent.parent;
       }
    } else {
        ...创建变量节点 el
    }
    
    (parent ? parent.children : root).push(el);
    parse(str.slice(rightEndIndex + 2));
}
```

当然，具体实现起来还是有其他东西要考虑的，比如一个文本是`{% {{ test }}`，就要考虑到{%的干扰等。还有比如 else 还有 elseif 节点的处理，这两个是需要关联到 if 标签上的，这个也是需要特殊处理的。不过大概逻辑基本上就是以上。


## 组合 html 

创建好 ast 后，要渲染 html 的时候，就只需要遍历语法树，根据节点类型做出不同的处理即可。

比如，如果是文本节点，就直接`html += el.text`即可。如果是`if`节点，则判断表达式，比如上面的`test > 1`，要实现表达式的计算，要么是自己解析然后算，要么就是用`eval`或者`new Function`了,为了方便，所以就使用`new Function`的方式来实现。变量节点的计算也一样，用`new Function`来实现。

封装后具体实现如下：

```javascript
function computedExpression(obj, expression) {
  const methodBody = `return (${expression})`;
  const funcString = obj ? `with(__obj__){ ${methodBody} }` : methodBody;
  const func = new Function('__obj__', funcString);
  try {
    let result = func(obj);
    return (result === undefined || result === null) ? '' : result;
  } catch (e) {
    return '';
  }
}
```

使用 with ，可以让在 function 中执行的语句关联对象，比如

```javascript
with({ a: '123' }) {
    console.log(a); // 123
}
```

虽然 with 不推荐在编写代码的时候使用，因为会让 js 引擎无法对代码进行优化，但是却很适合用来做这种模板编译，会方便很多。包括 vue 中的 render function 也是用 with 包裹起来的。不过 nunjucks 是没有用 with 的，它是自己来解析表达式的，因此在 nunjucks 的模板语法中，需要遵循它的规范，比如最简单的条件表达式，如果用 with 的话，直接写`{{ test ? 'good' : 'bad' }}`，但是在 nunjucks 中却要写成`{{ 'good' if test else 'bad' }}`。

anyway，各有各的好吧。

## 实现多级作用域

在将 ast 转换成 html 的时候，有一个很常见的场景就是多级作用域，比如在一个 for 循环中再嵌套一个 for 循环。而如何在做这个作用域分割，其实也是很简单，就是通过递归。

比如我的对一个 ast 树的处理方法命名为：`processAst(ast, scope)`，再比如最初的 scope 是 

```javascript
{ 
  list: [
   { subs: [1, 2, 3] },
   { subs: [4, 5, 6] } 
  ] 
 }
```

那么 processAst 就可以这么实现：

```javascript
function processAst(ast, scope) {
    ...
    if(ast.for) {
        const list = scope[ast.item]; // ast.item 自然就是列表的 key ，比如上面的 list
        list.forEach(item => {
            processAst(ast.children, Object.assign({}, scope, {
                [ast.key]: item,  // ast.key 则是 for key in list 中的 key
            }))
        })
    }
    ...
}
```

就简单通过一个递归，就可以把作用域一直传递下去了。


## Filter 功能实现

实现上面功能后，组件就已经具备基本的模板渲染能力，不过在用模板引擎的时候，还有一个很常用的功能就是 filter 。一般来说 filter 的使用方式都是这这样 `{{ test | filter1 | filter2 }}`，这个的实现也说一下，这一块的实现我参考了 vue 的解析的方式，还是蛮有意思的。

还是举个例子：

```
{{ test | filter1 | filter2 }}
```

在构建 AST 的时候，就可以获取到其中的`test | filter1 | filter2`，然后我们可以很简单的就获取到 filter1 和 filter2 这两个字符串。起初我的实现方式，是把这些 filter 字符串扔进 ast 节点的 filters 数组中，在渲染的时候再一个一个拿出来处理。

不过后来又觉得为了性能考虑，能够在 AST 阶段就能做完的工作就不要放到渲染阶段了。因此就改成 vue 的方法组合方式。也就是把上面字符串变成：

```
_$f('filter2', _$f('filter1', test))
```

预先用个方法包裹起来，在渲染的时候，就不需要再通过循环去获取 filter 并且执行了。具体实现如下：

```javascript
const filterRE = /(?:\|\s*\w+\s*)+$/;
const filterSplitRE = /\s*\|\s*/;
function processFilter(expr, escape) {
  let result = expr;
  const matches = expr.match(filterRE);
  if (matches) {
    const arr = matches[0].trim().split(filterSplitRE);
    result = expr.slice(0, matches.index);

    // add filter method wrapping
    utils.forEach(arr, name => {
      if (!name) {
        return;
      }

      // do not escape if has safe filter
      if (name === 'safe') {
        escape = false;
        return;
      }

      result = `_$f('${name}', ${result})`;
    });
  }

  return escape ? `_$f('escape', ${result})` : result;
}
```

上面还有一个就是对 safe 的处理，如果有 safe 这个 filter ，就不做 escape 了。完成这个之后，有 filter 的 variable 都会变成`_$f('filter2', _$f('filter1', test))`这种形式了。因此，此前的 computedExpression 方法也要做一些改造了。

```javascript
function processFilter(filterName, str) {
  const filter = filters[filterName] || globalFilters[filterName];

  if (!filter) {
    throw new Error(`unknown filter ${filterName}`);
  }

  return filter(str);
}

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

其实也是很简单，就是在 new Function 的时候，多传入一个获取 filter 的方法即可，然后有 filter 的 variable 就能被正常识别解析了。

---

至此，AST 构建、AST 到 html 的转换、多级作用域以及 Filter 的实现，都已经基本讲解完成。

贴一下自己实现的一个模板引擎轮子：https://github.com/whxaxes/mus 

算是实现了大部分模板引擎该有的功能，欢迎各路豪杰 star 。


