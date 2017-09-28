# 解读 Vue 之 Reactive

## 前言

在一篇文章中简单讲了 vue 是如何把模板解析成 render function 的，这一篇文章就来讲讲 vue 是如何把数据包装成 reactive，从而实现 MDV(Model-Driven-View) 的效果。

先说明一下什么叫 reactive，简单来说，就是将数据包装成一种可观测的类型，当数据产生变更的时候，我们能够感知到。

而 Vue 的相关实现代码全部都在 `core/observer` 目录下，而要自行阅读的话，建议从 `core/instance/index.js` 中开始。

在开始讲 reactive 的具体实现之前，先说说几个对象：Watcher、Dep、Observer。

## Watcher

Watcher 是 vue 实现的一个用于观测数据的对象，具体实现在 `core/observer/watcher.js` 中。

这个类主要是用来观察`方法/表达式`中引用到的数据（数据需要是 reative 的，即 data 或者 props）变更，当变更后做出相应处理。先看一下实例化 Watcher 这个类需要传的入参有哪些：

```javascript
constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
)
```

可以看到，有四个入参可供选择，其中 options 是非必传的，解释一下这几个入参是干嘛的：

- `vm`：当前这个 watcher 所属的 VueComponent。
- `expOrFn`：需要监听的 方法/表达式。举个例子：VueComponent 的 render function，或者是 computed property 的 getter 方法，再或者是`abc.bbc.aac`这种类型的字符串（由于 vue 的 parsePath 方法是用 split('.') 来做的属性分割，所以不支持`abc['bbc']`）。expOrFn 如果是方法，则直接赋值给 watcher 的 getter 属性，如果是表达式，则会转换成方法再给 getter。
- `cb`：当 getter 中引用到的 data 发生改变的时候，就会触发该回调。
- `options`：额外参数，可以传入的参数为包括`deep`、`user`，`lazy`，`sync`，这些值默认都是为 false。
    - `deep` 如果为 true，会对 getter 返回的对象再做一次深度遍历，进行进一步的依赖收集，比如 $watch 一个对象，如果 deep 为 true，那么当这个对象里的元素更改，也会触发 callback。
    - `user` 是用于标记这个监听是否由用户通过 $watch 调用的。
    - `lazy` 用于标记 watcher 是否为懒执行，该属性是给 computed property 用的，当 data 中的值更改的时候，不会立即计算 getter 获取新的数值，而是给该 watcher 标记为 dirty，当该 computed property 被引用的时候才会执行从而返回新的 computed property，从而减少计算量。
    - `sync` 则是表示当 data 中的值更改的时候，watcher 是否同步更新数据，如果是 true，就会立即更新数值，否则在 nextTick 中更新。

其实，只要了解了入参是用来干嘛的之后，也就基本上知道 Watcher 这个对象干了啥或者是需要干啥了。

## Dep

Dep 则是 vue 实现的一个处理依赖关系的对象，具体实现在 `core/observer/dep.js` 中，代码量相当少，很容易理解。

Dep 主要起到一个纽带的作用，就是连接 reactive data 与 watcher，每一个 reactive data 的创建，都会随着创建一个 dep 实例。参见 observer/index.js 中的 `defineReactive` 方法，精简的 defineReactive 方法如下。

```javascript
function defineReactive(obj, key, value) {
    const dep = new Dep();
    Object.defineProperty(obj, key, {
        get() {
          if (Dep.target) {
            dep.depend();
          }
          return value
        }
        set(newValue) {
            value = newValue;
            dep.notify();
        }
    })
}
```

创建完 dep 实例后，就会在该 data 的 getter 中注入收集依赖的逻辑，同时在 setter 中注入数据变更广播的逻辑。

因此当 data 被引用的时候，就会执行 getter 中的依赖收集，而什么时候 data 会被引用呢？就是在 watcher 执行 watcher.getter 方法的时候，在执行 getter 之前 watcher 会被塞入 Dep.target，然后通过调用 dep.depend() 方法，这个数据的 dep 就和 watcher 创建了连接，执行 getter 完成之后再把 Dep.target 恢复成此前的 watcher。

创建连接之后，当 data 被更改，触发了 setter 逻辑。然后就可以通过 dep.notify() 通知到所有与 dep 创建了关联的 watcher。从而让各个 watcher 做出响应。

比如我 watch 了一个 data ，并且在一个 computed property 中引用了同一个 data。再同时，我在 template 中也有显式引用了这个 data，那么此时，这个 data 的 dep 里就关联了三个 watcher，一个是 render function 的 watcher，一个是 computed property 的 watcher，一个是用户自己调用 $watch 方法创建的 watcher。当 data 发生更改后，这个 data 的 dep 就会通知到这三个 watcher 做出相应处理。

## Observer

Observer 可以将一个 plainObject 或者 array 变成 reactive 的。代码很少，就是遍历 plainObject 或者 array，对每一个键值调用 `defineReactive` 方法。

## 流程

以上三个类介绍完了，基本上对 vue reactive 的实现应该有个模糊的认识，接下来，就结合实例讲一下整个流程。

在 vue 实例化的时候，会先调用 initData，再调用 initComputed，最后再调用 mountComponent 创建 render function 的 watcher。从而完成一个 VueComponent 的数据 reactive 化。

### initData

initData 方法在 core/instance/state.js 中，而这个方法里大部分都是做一些判断，比如防止 data 里有跟 methods 里重复的命名之类的。核心其实就一行代码：

```
observe(data, true)
```

而这个 observe 方法干的事就是创建一个 Observer 对象，而 Observer 对象就像我上面说的，对 data 进行遍历，并且调用 defineReactive 方法。

就会使用 data 节点创建一个 Observer 对象，然后对 data 下的所有数据，依次进行 reactive 的处理，也就是调用 `defineReactive` 方法。当执行完 defineReactive 方法之后，data 里的每一个属性，都被注入了 getter 以及 setter 逻辑，并且创建了 dep 对象。至此 initData 执行完毕。

### initComputed

然后是 initComputed 方法。这个方法就是处理 vue 中 computed 节点下的属性，遍历 computed 节点，获取 key 和 value，创建 watcher 对象，如果 value 是方法，实例化 watcher 的入参 expOrFn 则为 value，否则是 value.get。

```javascript
function initComputed (vm: Component, computed: Object) {
  ...
  const watchers = vm._computedWatchers = Object.create(null)

  for (const key in computed) {
    const userDef = computed[key]
    let getter = typeof userDef === 'function' ? userDef : userDef.get
    ...
    watchers[key] = new Watcher(vm, getter, noop, { lazy: true })

    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      ...
    }
  }
}
```

我们知道 expOrFn 是可以为方法，也可以是字符串的。因此，通过上面的代码我们发现了一种官方文档里没有说明的用法，比如我的 data 结构如下

```javascript
{ obj: { list: [{value: '123'}] } }
```

如果我们要在 template 中需要使用 list 中第一个节点的 value 属性 值，就写个 computed property：

```javascript
computed: {
  value: { get: 'obj.list.0.value' }
}
```

然后在 template 中使用的时候，直接用`{{ value }}`，这样的话，就算 list 为空，也能保证不会报错，类似于 lodash.get 的用法，例子 https://jsfiddle.net/wanghx/n5r1vj1o/1/ 。

扯远了，回到正题上。

创建完 watcher，就通过 Object.defineProperty 把 computed property 的 key 挂载到 vm 上。并且在 getter 中添加以下逻辑

```javascript
 if (watcher.dirty) {
   watcher.evaluate()
 }
 if (Dep.target) {
   watcher.depend()
 }
 return watcher.value
```

前面我有说过，computed property 的 watcher 是 lazy 的，当 computed property 中引用的 data 发生改变后，是不会立马重新计算值的，而只是标记一下 dirty 为 true，然后当这个 computed property 被引用的时候，上面的 getter 逻辑就会判断 watcher 是否为 dirty，如果是，就重新计算值。

而后面那一段`watcher.depend`。则是为了收集 computed property 中用到的 data 的依赖，从而能够实现当 computed property 中引用的 data 发生更改时，也能触发到 render function 的重新执行。

```javascript
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }
```

### mountComponent

把 data 以及 computed property 都初始化好之后，则创建一个 render function 的 watcher。逻辑如下：

```javascript
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el
  ...
  callHook(vm, 'beforeMount')

  let updateComponent
  ...
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  ...

  vm._watcher = new Watcher(vm, updateComponent, noop)

  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}
```

可以看到，创建 watcher 时候的入参 expOrFn 为 updateComponent 方法，而 updateComponent 方法中则是执行了 render function。而这个 watcher 不是 lazy 的，因此创建该 watcher 的时候，就会立马执行 render function 了，当执行 render function 的时候。如果 template 中有使用 data，则会触发 data 的 getter 逻辑，然后执行 dep.depend() 进行依赖收集，如果 template 中有显式使用 computed property，也会触发 computed property 的 getter 逻辑，从而再收集 computed property 的方法中引用的 data 的依赖。最终完成全部依赖的收集。

最后举个例子：

```javascript
<template>
    <div>{{ test }}</div>
</template>

<script>
  export default {
    data() {
      return {
        name: 'cool'
      }
    },
    computed: {
      test() {
        return this.name + 'test';
      }
    }
  }
</script>
```

#### 初始化流程：

1. 将 name 处理为 reactive，创建 dep 实例
2. 将 test 绑到 vm，创建 test 的 watcher 实例 watch1，添加 getter 逻辑。
3. 创建 render function 的 watcher 实例 watcher2，并且立即执行 render function。
4. 执行 render function 的时候，触发到 test 的 getter 逻辑，watcher1 及 watcher2 均与 dep 创建映射关系。

#### name 的值变更后的更新流程：

1. 遍历绑定的 watcher 列表，执行 watcher.update()。
2. watcher1.dirty 置为为 true。
3. watcher2 重新执行 render function，触发到 test 的 getter，因为 watcher1.dirty 为 true，因此重新计算 test 的值，test 的值更新。
4. 重渲染 view


---

至此，vue 的 reactive 是怎么实现的，就讲完了。


