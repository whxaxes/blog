# TypeScript 的工具类型

## 什么是工具类型？

其实这个名字是我自己觉得可以这么叫的，因为很多时候我们会需要一个类型，来对已有类型做一些处理，然后获得我们想要的新类型。

```js
type --> [type utils] --> newType
```

由于这种类型本身就是类型，但是又具有输入输出能力，就类似于平时我们写代码时封装一些 utils 函数一样，所以我叫这种类型为工具类型。

在 TypeScript 基准库里内置了很多这种类型，比如

- Partial
- ReturnType
- Required
- ...

等等很多，我此前也写过一篇文章专门列举过这些内置类型[《TS 中的内置类型简述》](https://github.com/whxaxes/blog/issues/14) ，这个在这里就不赘述。

今天主要想讲的是如何来深入理解这些工具类型，以及自己怎么来写工具类型？

## 泛型

泛型是一切工具类型的基础，也就是输入，可以当成是函数中的入参，每一个泛型就是一个类型入参。泛型由于官方文档描述的很清楚，举个例子

```typescript
type PlainObject<T> = { [key: string]: T }
```

泛型还可以要求必须是某个类型的子类型，或者给个默认类型（ 相当于默认值 ）。比如上面那个就是

```typescript
type PlainObject<T extends string = string> = { [key: string]: T }
```

使用就相当于

```typescript
type newType = PlainObject<'test'>
// type newType = {
//    [key: string]: "test";
// }
```

## 常用关键字

要想写好一个工具类型，也需要对 ts 类型中的常用关键字熟记于心，这里列一下常用的一些关键词的用法。

**typeof** 可以获取值的类型

```typescript
const obj = { a: '1' };
type Foo = typeof obj; // { a: string }
```

**keyof** 可以获取对象类型的所有 key

```typescript
type Obj = { a: string; b: string }
type Foo = keyof obj; // 'a' | 'b'
```

**in** 可以根据 key 创建对象类型

```typescript
type Obj = { [T in 'a' | 'b' | 'c']: string; } // { a: string; b: string; c: string }
```

获取某个类型中某个 key 的类型

```typescript
type Obj = { a: string; b: string };
type Foo = obj['a'];// string
```

多关键词结合的一些用法

```typescript
const obj = { a: '1' };
type Foo = keyof typeof obj; // 'a' | 'b'
```

```typescript
const arr = [ 'a', 'b' ] as const;
type Foo = (typeof arr)[number]; // 'a' | 'b'
```

```typescript
type Obj = { a: string; b: string };
type Foo = { [T in keyof Obj]: Obj[T] } // { a: string; b: string };
```

## 类型推断

泛型和常用关键词都了解了，我们再来看看 ts 中强大的类型推断。

感谢 [TypeScript 2.8](https://github.com/Microsoft/TypeScript/wiki/What's-new-in-TypeScript#typescript-28) 带来的一些革命性的功能，其中 [Conditional Type](https://github.com/Microsoft/TypeScript/wiki/What's-new-in-TypeScript#conditional-types) 以及 [Type inference](https://github.com/Microsoft/TypeScript/wiki/What's-new-in-TypeScript#type-inference-in-conditional-types) ，还有一大堆上面提及的内置工具类型，让工具类型具有了更强大的类型分析能力。

Conditional Type 很简单，就是条件表达式

```typescript
type Foo<T> = T extends string ? number : boolean;
```

这段代码的意思就是，如果 T 类型是 string 的子类型，那么返回 number 类型，否则返回 boolean 类型。

而当 Conditional Type 跟 Type inference 的结合的时候才是真正的强大，能够推断出某个类型中的类型，比如我们很常用的 `ReturnType`，就能够获取到函数的返回类型，而 ReturnType 的实现也很简单：

```typescript
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
```

这段代码的意思是，如果 T 类型是函数的子类型，那么 infer R ，这个 `infer R` 代表的是推断这个函数的返回类型为 R 并且返回。比如在下面代码中

```typescript
type fn = (abc: string) => number;
type fnt = ReturnType<fn>; // number
```

使用 ReturnType 后，就可以 infer 出 R 为 number 类型，所以 fnt 的类型就是 number 。

除此之外，我们还可以 infer 出函数的任意入参类型，比如此前遇到的一个需求，希望能够对一个函数做包装，然后拿到那个函数第二个入参以后的类型。也可以用 infer type 来轻易实现。

```typescript
type SecondParam<T> = T extends (first: any, ...args: infer R) => any ? R : any;
```

可以看到，跟前面的用法类似，会判断 T 类型是否为函数类型，但是不是 infer 返回类型了，而是将第一个入参类型设为 any，然后 infer 第二个之后的入参类型并且返回，所以如果 T 命中 extends 的规则是个合法的函数的话，那么就可以拿到第二个入参之后的类型，否则就是 any 。

而实际使用中可以这么用。

```typescript
function pack<T extends (...args: any[]) => any>(fn: T) {
  return {
    call(...args: SecondParam<T>): ReturnType<T> {
      return fn.apply(undefined, [ 1, ...args ]);
    },
  };
}

function fn(k: any, a: string, b: string) {
  return k + a + b;
}

pack(fn).call('1', '2');
```

将函数用 pack 包一层之后，就可以直接用 call 调用 fn 方法，并且能够省去第一个固定入参。


## 类型递归

就跟函数递归一样，有时候我们也会需要使用类型递归来解决一些多层级的类型处理问题。比如平时用 egg 中经常用到的 `PowerPartial`

```typescript
type PowerPartial<T> = {
    [U in keyof T]?: T[U] extends object
      ? PowerPartial<T[U]>
      : T[U]
  };
```

就是通过类型递归，将对象类型中的每一个 key ，都变成了不必须（ ?: 代表该 key 可以为 undefine ）。

除此之外，类型递归还能用来做动态添加类型的能力，非常强大，举个例子

```typescript
type ReturnObj<T extends string> = {
  [key in T]: any;
} & {
  add: <R extends string>(key: R) => ReturnObj<T | R>,
};
```

可以看一下这个类型，传入一个泛型 T ，将传入的类型列表作为 key 来形成一个新的对象类型，并且里面还有一个 add 方法，然后这个 add 方法又支持传入一个泛型 R ，并且将前面传入的 T 跟 R 结合起来递归传入下一个类型，这个类型可以这么来用在一个 add 方法上。

```typescript
function add<T extends string>(key: T): ReturnObj<T> {
  const obj = {
    [key]: 123,
    add: key => {
      obj[key] = 123;
      return obj;
    },
  };

  return obj as ReturnObj<T>;
}
```

然后

```typescript
const result = add('test').add('bbb').add('asda').add('ddd').add('kkk');
```

再看一下 result 的类型

![image](https://wanghx.cn/public/github/images/issue16/img1.png)

可以看到 result 的类型中加上了前面 add 的所有 key 值。

## 总结

知道怎么写工具类型，在开发中还是很有帮助的，能够减少很多重复类型的定义，当然目前很多工具类型也不一定需要我们自己实现，目前 github 上也有很多类型库，专门收集各种好用的工具类型，比如 sindresorhus 的 [type-fest](https://github.com/sindresorhus/type-fest) 或者是 [utility-types](https://github.com/piotrwitek/utility-types) 都提供了不少有用的类型。
