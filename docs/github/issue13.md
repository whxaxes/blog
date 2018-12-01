# TS 中的内置类型简述

用了一段时间的 ts ，发现 ts 中有很多很好用但是感觉很多人都没怎么去尝试的内置类型，这篇文章就来简单梳理一下我觉得挺好用的类型，然后又能衍生出哪些用法？

## Partial

ts 中的实现

```typescript
// node_modules/typescript/lib/lib.es5.d.ts

type Partial<T> = {
    [P in keyof T]?: T[P];
};
```

这个类型的用处就是可以将某个类型里的属性加上 ? 这个 modifier ，加了这个 modifier 之后那些属性就可以为 undefined 了。

举个例子，我有个接口 Person ，里面定义了两个必须的属性 `name` 和 `age`。

```typescript
interface Person {
    name: string;
    age: number;
}

// error , property age is missing.
const axes: Person = {
    name: 'axes'
}
```

如果使用了 Partial 

```typescript
type NewPerson = Partial<Person>;

// correct, because age can be undefined.
const axes: NewPerson = {
    name: 'axes'
}
```

这个 NewPerson 就等同于

```typescript
interface Person {
    name?: string;
    age?: number;
}
```

但是 Partial 有个局限性，就是只支持处理第一层的属性，如果我的接口定义是这样的 

```typescript
interface Person {
    name: string;
    age: number;
    child: {
      name: string;
      age: number;
    }
}

type NewPerson = Partial<Person>;

// error, property age in child is missing
const axes: NewPerson = {
  name: 'axes';
  child: {
    name: 'whx'
  }
}
```

可以看到，第二层以后的就不会处理了，如果要处理多层，就可以自己通过 [Conditional Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html) 实现一个更强力的 Partial

```typescript
export type PowerPartial<T> = {
     // 如果是 object，则递归类型
    [U in keyof T]?: T[U] extends object
      ? PowerPartial<T[U]>
      : T[U]
};
```

## Required

ts 中的实现

```typescript
// node_modules/typescript/lib/lib.es5.d.ts

type Required<T> = {
    [P in keyof T]-?: T[P];
};
```

这个类型刚好跟 Partial 相反，Partial 是将所有属性改成不必须，Required 则是将所有类型改成必须。

其中 `-?` 是代表移除 `?` 这个 modifier 的标识。再拓展一下，除了可以应用于 `?` 这个 modifiers ，还有应用在 readonly ，比如 Readonly 这个类型

```typescript
// node_modules/typescript/lib/lib.es5.d.ts

type Readonly<T> = {
    readonly [P in keyof T]: T[P];
};
```

就可以给子属性添加 `readonly` 的标识，如果将上面的 `readonly` 改成 `-readonly` 就是移除子属性的 `readonly` 标识。

## Pick

ts 中的实现 

```typescript
// node_modules/typescript/lib/lib.es5.d.ts

type Pick<T, K extends keyof T> = {
    [P in K]: T[P];
};
```

这个类型则可以将某个类型中的子属性挑出来，比如上面那个 Person 的类 

```typescript
type NewPerson = Pick<Person, 'name'>; // { name: string; }
```

可以看到 NewPerson 中就只有个 name 的属性了，这个类型还有更有用的地方，等讲到 Exclude 类型会说明。

## Record

ts 中的实现

```typescript
// node_modules/typescript/lib/lib.es5.d.ts

type Record<K extends keyof any, T> = {
    [P in K]: T;
};
```

可以获得根据 K 中的所有可能值来设置 key 以及 value 的类型，举个例子

```typescript
type T11 = Record<'a' | 'b' | 'c', Person>; // { a: Person; b: Person; c: Person; }
```

## Exclude

ts 中的实现

```typescript
// node_modules/typescript/lib/lib.es5.d.ts

type Exclude<T, U> = T extends U ? never : T;
```

这个类型可以将 T 中的某些属于 U 的类型移除掉，举个例子

```typescript
type T00 = Exclude<"a" | "b" | "c" | "d", "a" | "c" | "f">;  // "b" | "d"
```

可以看到 T 是 `"a" | "b" | "c" | "d"` ，然后 U 是 `"a" | "c" | "f"` ，返回的新类型就可以将 U 中的类型给移除掉，也就是 `"b" | "d"` 了。

那这个类型有什么用呢，在我看来，可以结合 Pick 类型使用。

在我们给 js 写声明的时候，经常会遇到我们需要 extend 某个接口，但是我们又需要在新接口中将某个属性给 overwrite 掉，但是这样经常会遇到类型兼容性问题。举个例子

```typescript
interface Chicken {
    name: string;
    age: number;
    egg: number;
}
```

我需要继承上面这个接口

```typescript
// error, Types of property 'name' are incompatible
interface NewChicken extends Chicken {
  name: number;
}
```

可以看到就会报错了，因为在 Chicken 中 name 是 string 类型，而 NewChicken 却想重载成 number 类型。很多时候可能有人就直接把 name 改成 any 就算了，但是不要忘了我们有个 Pick 的类型，可以把我们需要的类型挑出来，那就可以这样

```typescript
// correct.
interface NewChicken extends Pick<Chicken, 'age' | 'egg'> {
  name: number;
}
```

可以看到，我们把 Person 中的类型做了挑选，只把 age 和 egg 类型挑出来 extend ，那么我复写 name 就没问题了。

不过再想一下，如果我要继承某个接口并且复写某一个属性，还得把他的所有属性都写出来么，当然不用，我们可以用 Exclude 就可以拿到除 `name` 之外的所有属性的 key 类型了。

```typescript
type T01 = Exclude<keyof Chicken, 'name'>; // 'age' | 'egg'
```

然后把上面代码加到 extend 中就成了

```typescript
// correct.
interface NewChicken extends Pick<Chicken, Exclude<keyof Chicken, 'name'>> {
  name: number;
}
```

然后还可以把这个处理封装成一个单独的类型

```typescript
type FilterPick<T, U> = Pick<T, Exclude<keyof T, U>>;
```

然后上面的 extend 的代码就可以写成这样，就更简洁了

```typescript
interface NewChicken extends FilterPick<Chicken, 'name'> {
  name: number;
}
```

这样一来，我们就可以愉快的进行属性 overwrite 了。

## ReturnType

ts 中的实现

```typescript
// node_modules/typescript/lib/lib.es5.d.ts

type ReturnType<T extends (...args: any[]) => any> = T extends (...args: any[]) => infer R ? R : any;
```

这个类型也非常好用，可以获取方法的返回类型，可能有些人看到这一长串就被绕晕了，但其实也是使用了 Conditional Types ，推论 ( infer ) 泛型 T 的返回类型 R 来拿到方法的返回类型。

实际使用的话，就可以通过 ReturnType 拿到方法的返回类型，如下的示例

```typescript
function TestFn() {
  return '123123';
}

type T01 = ReturnType<typeof TestFn>; // string
```

## ThisType

ts 中的实现

```typescript
// node_modules/typescript/lib/lib.es5.d.ts

interface ThisType<T> { }
```

可以看到声明中只有一个接口，没有任何的实现，说明这个类型是在 ts 源码层面支持的，而不是通过类型变换，那这个类型有啥用呢，是用于指定上下文对象类型的。

```typescript
interface Person {
    name: string;
    age: number;
}

const obj: ThisType<Person> = {
  dosth() {
    this.name // string
  }
}
```

这样的话，就可以指定 obj 里的所有方法里的上下文对象改成 Person 这个类型了。跟 

```typescript
const obj = {
  dosth(this: Person) {
    this.name // string
  }
}
```

差不多效果。

## NonNullable

ts 中的实现

```typescript
// node_modules/typescript/lib/lib.es5.d.ts

type NonNullable<T> = T extends null | undefined ? never : T;
```

根据实现可以很简单的看出，这个类型可以用来过滤类型中的 null 及 undefined 类型。

比如

```typescript
type T22 = '123' | '222' | null;
type T23 = NonNullable<T22>; // '123' | '222'
```

## 最后

其实上面很多类型也可以直接看 ts 的 [release-note](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html) ，写出来也是自己做个备忘。