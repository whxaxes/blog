# 解读 Vue 之 $mount 方法

## 前言

在使用 vue 的时候，如果不用 .vue 格式来写，那么肯定用过`$mount`方法，包括我们创建一个 root 节点，传入了`el`，vue也会帮我们调用`$mount`方法。而`$mount`方法是 vue 中最重要的一环之一，用于解析模板，生成 render function 。

## 入口文件

`$mount`方法的入口文件在 `src/entries/web-runtime-with-compiler` 中，在 vue 2.x 中引入了预编译的概念。模板可以被预编译成 render function ，在页面中渲染的时候就不需要再去解析构建 AST 静态语法树了，对页面性能有一定的提升作用。因此入口文件分成了带 compiler 的，以及不带 compiler 的。

在`web-runtime-with-compiler`中调用了一个`compileToFunctions`的方法，而`compileToFunctions`方法又调用了`compile`方法以及`makeFunction`方法。

```javascript
...
const res = {}
const compiled = compile(template, options)
res.render = makeFunction(compiled.render)
const l = compiled.staticRenderFns.length
res.staticRenderFns = new Array(l)
for (let i = 0; i < l; i++) {
  res.staticRenderFns[i] = makeFunction(compiled.staticRenderFns[i])
}
```

其中，所有的逻辑都在`compile`中，compile 后的对象里，就包含了 render function 字符串，然后再通过 makeFunction（就是 new Function()） 实例化一个 function 对象。

进到compile 方法所在的文件可以看到就剪短的几行代码

```javascript
/**
 * Compile a template.
 */
export function compile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  const ast = parse(template.trim(), options)
  optimize(ast, options)
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
}
```

## parse方法

parse 方法在`src/compiler/parser/index.js`中，先看代码上面的正则，每个正则的用户都用注释写了一下

```javascript
// 匹配 v- || @ || : ，用于判断directive属性
export const dirRE = /^v-|^@|^:/  
// 用于匹配 v-for 中的表达式，从而可以获取到两个匹配组，一个是 key,index ，一个是 in 的对象
export const forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/
// 用于匹配 forAliasRe中匹配出来的 key,index 中的各个具体参数
export const forIteratorRE = /\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/
// 匹配 v-bind | :
const bindRE = /^:|^v-bind:/
// 匹配 v-on | @
const onRE = /^@|^v-on:/
// 匹配 :xx ，获得分组 xx
const argRE = /:(.*)$/
// 匹配 @click.stop 中的 .stop 等
const modifierRE = /\.[^.]+/g
```

然后看 parse 方法，可以看到，真正的解析方法是在里面的 parseHTML 中，调用 parseHTML 方法的时候，可以看到传入了多个参数，占主要逻辑的解析方法是其中的 `start`，`end`，`chars` 方法。  

其中 start 方法，主要是用来创建 type 为 1 的 tag 类 ASTElement。chars 方法是用来创建 type 为 2 或者 3 的文本类 ASTElement，end 方法是用来处理未闭合的标签。  

先不用急着看这几个方法干了啥，先直接进入到 parseHTML 上看，也就是在`src/compiler/parser/html-parser.js`文件里。

还是先看一下正则：

```javascript
// 这里一大堆都是用来匹配标签上的属性值的
const singleAttrIdentifier = /([^\s"'<>/=]+)/
const singleAttrAssign = /(?:=)/
const singleAttrValues = [
  // attr value double quotes
  /"([^"]*)"+/.source,
  // attr value, single quotes
  /'([^']*)'+/.source,
  // attr value, no quotes
  /([^\s"'=<>`]+)/.source
]
const attribute = new RegExp(
  '^\\s*' + singleAttrIdentifier.source +
  '(?:\\s*(' + singleAttrAssign.source + ')' +
  '\\s*(?:' + singleAttrValues.join('|') + '))?'
)

// 这一大块是用于匹配标签名，之所以拆开是方便复用
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = '((?:' + ncname + '\\:)?' + ncname + ')'
// 匹配 <xxx
const startTagOpen = new RegExp('^<' + qnameCapture)
// 匹配 xxx>
const startTagClose = /^\s*(\/?)>/
// 匹配 </xxx>
const endTag = new RegExp('^<\\/' + qnameCapture + '[^>]*>')

// 匹配DOCTYPE、注释、还有IE上的条件判断语句 <![]>
const doctype = /^<!DOCTYPE [^>]+>/i
const comment = /^<!--/
const conditionalComment = /^<!\[/
```

然后就是主要方法 parseHTML ，里面逻辑还是比较清晰。首先会使用`html.indexOf('<')`来获取需要处理的位置索引，如果位置为0，进入标签判断逻辑：

```javascript
let textEnd = html.indexOf('<')
if (textEnd === 0) {
  ...
}
```

会判断当前的<，是属于注释、还是IE的条件判断，还是Doctype，如果是这三者之一，基本上就是直接通过`advance`方法，更新剩余的html。

```javascript
   // Comment:
   if (comment.test(html)) {
     ...
   }

   // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
   if (conditionalComment.test(html)) {
     ...
   }

   // Doctype:
   const doctypeMatch = html.match(doctype)
   if (doctypeMatch) {
     ...
   }
```

接着判断 end tag，如果是 </xxx> ，则在更新完 html 之后，调用 `parseEndTag` 方法，在这个方法里，就是遍历 `stack` 列表，stack列表是用于存放此前创建的 <xxx> 的抽象，获取相匹配的<xxx>，如果发现获取到的 <xxx> 不是在 stack 列表的最后一位，说明有未闭合的标签。直接调用 `options.end` 方法，通知上一个文件里的移除未闭合的 ASTElement 。

再进行 start tag 的判断，判断 start tag 的方法单独抽成了一个 parseStartTag 方法，而不是一个正则那么简单了，因为除了做标签判断之外，还要收集标签上的属性值。逻辑也比较简单：

先匹配 startTagOpen ，也就可以获取到 <xxx ...> 中的 <xxx 以及 xxx。

```javascript
const start = html.match(startTagOpen)
if(start){
const match = {
   tagName: start[1],
   attrs: [],
   start: index
 }
 // 更新 html 位置
 advance(start[0].length)
}
```

此时，如果 html 是`<div v-for="item in items">`，经过上面的处理，html就剩下`v-for="item in items">`了。

```javascript
// 注意startTagClose的正则，是有^的，所以遇到 /?> 前都不会被匹配到
// 所以就可以不停的收集属性，直到遇到 /> 或者 >
// 同时更新 html
 while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
   advance(attr[0].length)
   match.attrs.push(attr)
 }
 if (end) {
   // 标记当前标签是否不需要闭合的，即 <br /> 这种类型
   match.unarySlash = end[1]
   // 更新html
   advance(end[0].length)
   match.end = index
   return match
 }
```

经过上面一些逻辑判断，就可以知道当前标签如果匹配上了，就再调用`handleStartTag`方法，对属性值做进一步处理，然后在判断当前标签需不需要闭合，如果是不需要闭合的标签就不需要塞入 stack ，如果需要闭合，就塞入 stack 。

紧接着就调用了 `options.start` 方法，再回到上一个文件中，在 start 方法里，就是把 <xxx> 抽象成一个 ASTElement ，并且对其进行多层处理，逐个处理 v-for、v-if、等这些指令：

```javascript
if (!inVPre) {
   processPre(element)
   if (element.pre) {
     inVPre = true
   }
 }
 if (platformIsPreTag(element.tag)) {
   inPre = true
 }
 if (inVPre) {
   processRawAttrs(element)
 } else {
   processFor(element)
   processIf(element)
   processOnce(element)
   processKey(element)

   // determine whether this is a plain element after
   // removing structural attributes
   element.plain = !element.key && !attrs.length

   processRef(element)
   processSlot(element)
   processComponent(element)
   for (let i = 0; i < transforms.length; i++) {
     transforms[i](element, options)
   }
   processAttrs(element)
 }
```

指令的处理就不细说，就相当于打标签似的，比如当前 ASTElement 上有 v-once ，则给这个 ASTElement 加上一个`once=true`的节点，当然也不是都那么简单，会有一些特殊处理。

可以说，每一个标签开合即\<XXX>，都会被转成一个 type 为 1 的 ASTElement。处理完\<XXX>，然后就通过下面这段逻辑，来获取上一个 \<XXX> 和下一个 \<XXX> 或者 \</XXX> 等中间的文本内容。

直接举个例子：

比如要处理的 html 是`<div>123<123{{ item }}<span></span></div>`。

```javascript
 // 上一步已经将<div>转成一个 ASTElement 了，因此此时 textEnd 是 3，匹配到了 123<123 中的 <
 let text, rest, next
 if (textEnd > 0) {
   // 此时 rest = '<123{{ item }}<span></span></div>'
   rest = html.slice(textEnd)
   
   // 判断当前匹配到的 < 是否属于标签
   while (
     !endTag.test(rest) &&
     !startTagOpen.test(rest) &&
     !comment.test(rest) &&
     !conditionalComment.test(rest)
   ) {
     next = rest.indexOf('<', 1)
     if (next < 0) break
     // 如果当前匹配到的<不属于标签，textEnd += 下一个 < 的位置。
     textEnd += next
     // 更新 rest ，此时 rest = '<span></span></div>'
     rest = html.slice(textEnd)
   }
   // text = '123<123{{ item }}'
   text = html.substring(0, textEnd)
   // 更新 html
   advance(textEnd)
 }
 
 // 执行 options.chars ，即将 '123<123{{ item }}' 转成 ASTElement
 if (options.chars && text) {
   options.chars(text)
 }
```

然后再看 options.chars 里的逻辑。那里的逻辑会比较简单：

```javascript
// 如果不在 v-pre 中，并且 text 不为空，并且 text 中含有 {{ XXX }} 则生成 type 为 2 的 ASTElement，
if (!inVPre && text !== ' ' && (expression = parseText(text, delimiters))) {
     children.push({
       type: 2,
       expression,
       text
     })
   } else if (text !== ' ' || children[children.length - 1].text !== ' ') {
     // 否则为 type 3 的 ASTElement
     currentParent.children.push({
       type: 3,
       text
     })
   }
```

而里面调用的 `parseText` ，则是从文本中匹配出`{{ XXX }}` , 并且转换成表达式的方法。逻辑也比较简单，通过正则匹配出`{{ XXX }}` 中的 XXX，再判断是否有 filter ，也就是是否为`{{ XXX \| filterName }}` 的格式，如果是，则转换成`_f("filterName")(XXX)`的格式，如果不是，就直接是`XXX`了，紧接着再包一层变成`_f("filterName")(XXX)`或者`_s(XXX)`。 `_s` 是 `toString` 方法，而 `_f` 则是获取 filter 的方法。


再举个解析的例子：

解析前

```html
<ul>
  tutututu
  <li v-for="(item, index) in items"></li>
  aaa{{ item | reverse }}bb
</ul>
```

解析后

```javascript
// root ASTElement
{
    type: 1,
    tag: 'ul', 
    attrsList: [], 
    attrsMap: Object{},
    parent: undefined,
    children: [
        {
          type: 3,
          text: 'tutututu',
        },
        { 
          type: 1, 
          tag: 'li', 
          attrsList: [], 
          attrsMap: { v-for: '(item, index) in items' },
          parent: Object{...ul},
          children: [], 
          for: 'items', 
          alias: 'item', 
          iterator1: 'index', 
          plain: true
        },
        {
          type: 2,
          expression: '_s(_f("reverse")(item))',
          text: "aaa{{ item | reverse }}bb"
        }
    ], 
    plain: true
}
```

## optimize 方法

经过`parse`方法的解析，此时获得是一个抽象出来的 AST 树对象。而 optimize 方法做的事情相对于 parse 来说就简单一些了，只是遍历 AST 树里的所有节点，然后标记其本身包括子树是否静态的，以便在每次界面重渲染的时候，可以不需要重新生成静态树的dom，而在部分数据发生改变引发的 patch 的时候，也可以完全跳过对静态树的检查。

判断逻辑即：

```javascript
function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { // 说明是包含 {{ XXX }} 的文本，不属于静态
    return false
  }
  if (node.type === 3) { // 纯文本，属于静态
    return true
  }
  return !!(node.pre || (
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) && // 非在 v-for template 节点下的子节点
    Object.keys(node).every(isStaticKey)
  ))
}
```

简单概括，会被认为静态的节点为以下三种：

- type 为 3 的纯文本节点
- 含有 v-pre 属性的节点 
- 没有绑定任何指令逻辑的节点

进行完 `static` 的标记，还会进行`staticRoot`以及`staticInFor`的标记。其中`staticRoot`的标记表明该节点是个有子节点的静态节点。但是只会标记有一个文本节点以上的节点，因为按照源码里的注释说明，说如果只有一个文本子节点，那么对这个处理就有点得不偿失了。

> For a node to qualify as a static root, it should have children that
> are not just static text. Otherwise the cost of hoisting out will
> outweigh the benefits and it's better off to just always render it fresh.

而`staticInFor`则是标记该节点及其子节点是否为在 v-for 下的静态节点。

## generate 方法

经过 optimize 处理后，就使用 generate 方法把 AST 转成 render function。看这个方法，需要配合`src/core/instance/render.js`一起看，才知道 render function 中的那些简写的方法是干嘛用的。

```javascript
...
const code = ast ? genElement(ast) : '_c("div")'
...
return {
    render: `with(this){return ${code}}`,
    staticRenderFns: currentStaticRenderFns
}
```

可以看出，generate 方法是通过 genElement 方法生成 function string 然后使用 with 拼装后返回。其中的`_c`方法是`vnode`中的`createElement`方法，也就是会实例化一个`VNode`对象，即虚拟dom。具体怎么生成就不细说，那一块是 vdom 里的，不在本文中细说。

而在`genElement`方法中，也就是根据ASTElement的类型不同，组装出不同的 function string;

从上往下，如果 root ASTElement 是一棵静态树，那么就会执行`genStatic`方法。

```javascript
// hoist static sub-trees out
function genStatic (el: ASTElement): string {
  // 添加记号，以防重复处理同个ASTElement 
  el.staticProcessed = true
  // 因为静态 render function 是可以重复用的，所以放到 staticRenderFns 中缓存。
  // 然后进行递归处理 ASTElement
  staticRenderFns.push(`with(this){return ${genElement(el)}}`)
  return `_m(${staticRenderFns.length - 1}${el.staticInFor ? ',true' : ''})`
}
```

代码中的`_m`方法，就是`render.js`中的`renderStatic`方法。

```javascript
...
let tree = this._staticTrees[index]
// 如果已经存在 vnode 实例，并且不在 v-for 下，则直接拷贝即可。
if (tree && !isInFor) {
 return Array.isArray(tree)
   ? cloneVNodes(tree)
   : cloneVNode(tree)
}
// 通过调用staticRenderFns中保存的 function，生成新的 vnode ，
tree = this._staticTrees[index] = this.$options.staticRenderFns[index].call(this._renderProxy)
// 将该 vnode 标记为静态 vnode
markStatic(tree, `__static__${index}`, false)
return tree
```
其他还有`genFor`、`genData`这些方法就不细说了，有兴趣的可以自行去看，这些方法均是使用`src/core/instance/render.js`里的方法做包装，最后用`with(this){ /** function string **/ }`包裹起来，那么里面引用的`_m`方法之类的，就用的都是 vue instance 的方法了。

---

EOF


