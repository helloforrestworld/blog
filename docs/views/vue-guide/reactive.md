---
title: vue2.x响应式原理
---

:::tip
[项目源码](https://github.com/helloforrestworld/vue-source)
:::

## 1️⃣准备工作

**目录结构**

```
├── public
│   ├── index.html // 模版文件
├── src
│   ├── index.js // 测试页面
├── source
│   ├── vue // vue代码
├── webpack.config.js
```
**配置resolve**

让项目中```import Vue from 'vue'```指向source目录的vue。
```js
// webpack.config.js
module.exports = (env) => {
  return {
    // ...
    resolve: {
      modules: [path.resolve(__dirname, 'source'), path.resolve(__dirname, 'node_modules')]
    },
  }
}
```

## 2️⃣观察对象和数组

vue2.x劫持对象用到的核心方法是[defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)，先看代码。

**observe**
```js
export function observe(data) {
  // 如果不是对象直接返回，不需要观察
  if (typeof data !== 'object' || data === null) {
    return data
  }
  return new Observer(data)
}
```
**Observer**
```js
class Observer {
  constructor(data) {
    this.walk(data)
  }

  walk(data) {
    const keys = Object.keys(data)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const value = data[key]

      defineReactive(data, key, value)
    }
  }
}
```
**defineReactive**
```js
export function defineReactive(data, key, value) {
  // 如果value是对象的话，需要继续观察一层
  observe(value)

  Object.defineProperty(data, key, {
    get() {
      console.log('获取数据')
      return value
    },
    set(newValue) {
      if (newValue === value) return
      console.log('更新视图')
      // 这里说明一下，defineReactive执行是一个闭包，当新的newValue进来后，修改value便能够共享到get里面。
      value = newValue
    }
  })
}
```
初始化Vue实例的时候，会将用户配置的data传入observe中，然后遍历所有元素进行defineReactive，过程中遇到对象的话递归调用observe，这样就完成了整个data的重新定义。

另外data传入的可能是对象或者函数，需要在initData的时候需要简单处理一下。
```js
function initData(vm) {
  let data = vm.$options.data

  // 判断data是否为函数，然后取出data赋值给vm._data
  data = vm._data = typeof data === 'function' ? data.call(vm) : data || {}

  // 将用户插入的数据，用Object.definedProperty重新定义
  observe(vm._data)
}
```
顺便提一下，因为vue组件是可以复用的，传入一个对象的话会造成多个组件引用同一份数据造成污染，实际我们使用当中都是传入一个函数，每次初始化时都生成一个副本。

上面```initData```中我们取到data后把数据挂在```vm._data```中，后面的操作都是针对这组数据。

🧪测试一下。
```js
const vm = new Vue({
  el: '#app',
  data() {
    return {
      msg: 'hello'
    }
  }
})
console.log(vm._data.msg)
vm._data.msg = 'world'
```
这样访问和修改msg属性都会输出我们写的console。

你可能注意到我们平时使用vue都是能够从vm中直接获取data的数据，而不是像上面一样通过```vm._data```。

这里我们需要代理一下数据，将访问```vm.msg```代理到```vm._data.msg```。

```js
function proxy(vm, key, source) {
  Object.defineProperty(vm, key, {
    get() {
      return vm[source][key]
    },
    set(newValue) {
      vm[source][key] = newValue
    }
  })
}

function initData(vm) {
  // ...

  // 把_data的属性映射到vm上
  for (const key in data) {
    proxy(vm, key, '_data')
  }

  // ...
}
```
[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/b44bf50bc171542c51a8e9de0504a1e1316c6593)

**数组方法的劫持**

上面的劫持对数组的```push```等方法是无效的，我们需要对数组的部分方法进行重写。

这七个方法都是能修改数组本身的。
- push
- pop
- unshift
- shift
- sort
- reverse
- splice

为了不污染全局的数组，我们把数组的原型拷贝一份，然后再修改新的原型。

```js
const arrayProto = Array.prototype

const newArrayProto = Object.create(arrayProto)

methods.forEach(method => {
  newArrayProto[method] = function (...args) {
    // 调用原数组方法
    const r = arrayProto[method].apply(this, args)

    console.log('调用了数组的方法设置数据')

    return r
  }
})
```
然后我们把这个新的原型替换到数组中。
```js
class Observer {
  constructor(data) {
    if (Array.isArray(data)) {
      // data.__proto__ = newArrayProto
      // __proto__不推荐使用 https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/proto
      Object.setPrototypeOf(data, newArrayProto)
      for (let i = 0; i < data.length; i++) {
        observe(data[i])
      }
    } else {
      this.walk(data)
    }
  }
  // ...
}
```
另外还需要对数组方法新增的元素进行观察。
```js
methods.forEach(method => {
  newArrayProto[method] = function (...args) {
    const r = arrayProto[method].apply(this, args)

    // 对新增的元素进行观测
    let inserted
    switch (method) {
      case 'push':
      case 'shift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
    }
    observeArray(inserted)
    return r
  }
})

function observeArray(arr) {
  for (let i = 0; i < arr.length; i++) {
    observe(arr[i])
  }
}
```
🧪测试一下
```js
const vm = new Vue({
  el: '#app',
  data() {
    return {
      arr: [{ a:1 }, 1, 2]
    }
  }
})

vm.arr[0].a = 2 // 数组里面嵌套的对象测试
vm.arr.push({ b: 1}) // 数组方法劫持测试
vm.arr[3].b = 2 // 数组方法新增元素测试
```
在vue中出于性能的考虑，并没有对数组的索引进行观察，我们直接修改数组索引例如```arr[0] = 1```这样是不会触发更新的，官网提供了一个```Vue.$set```方法去设置，这个方法内部会去调用数组的```splice```方法。

[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/e28d54c4c23b8af966a92e28aca71bde8fab25f7)

## 3️⃣$mount
在```initState```过后，如果用户配置了```el```属性，会调用```$mount```方法。

```js
function Vue (options) {
  this._init(options)
}
Vue.prototype._init = function (options) {
  vm.$options = options

  // 初始化data watch computed
  initState(vm)

  if (options.el) {
    vm.$mount()
  }
}
```
```$mount```做了两件事：
- 获取el元素并挂载在$el上。
- 实例化一个watcher去渲染页面。

```js
function query(el) {
  if (typeof el === 'string') {
    return document.querySelector(el)
  }
  return el
}

Vue.prototype.$mount = function () {
  const vm = this
  let el = vm.$options.el
  el = vm.$el = query(el)

  // 渲染/更新逻辑
  const updateComponent = () => {
    vm._update()
  }

  new Watcher(vm, updateComponent)
}
```
这里的watcher叫做```渲染watcher```，后面还有更多的watcher，如```computed watcher```。

在这一节暂时不需要去了解watcher的概念，你只需要知道```new Watcher(vm, updateComponent)```会执行一次```updateComponent```。

这里就简单声明一下这个Watcher类，后面章节还会做很多扩展和详细说明这个类。
```js
let id = 0 // 每个watcher的标识
class Watcher {
  /**
   *
   * @param {*} vm 当前Vue实例
   * @param {*} exprOrFn 表达式或者函数 vm.$watch('msg', cb) 如'msg'
   * @param {*} cb  表达式或者函数 vm.$watch('msg', cb) 如cb
   * @param {*} opts 其他的一些参数
   */
  constructor(vm, exprOrFn, cb = () => {}, opts = {}) {
    this.vm = vm
    this.exprOrFn = exprOrFn
    if (typeof exprOrFn === 'function') {
      this.getter = exprOrFn
    }
    this.cb = cb
    this.opts = opts
    this.id = id++

    this.get() // 创建watcher时候默认会调用一次get方法
  }

  get() {
    this.getter()
  }
}

export default Watcher
```

下面我们继续写这一节的核心```updateComponent```里面的```_update```方法，这个方法会进行页面更新，实际上更新过程是比较复杂的，vue2.x引入了虚拟Dom，首先会把模版解析成Vdom，然后将Vdom渲染成真实的dom，数据更新后，生成一个新的Vdom，新旧Vdom进行Diff，然后变更需要修改的部分，完整的编译过程是比较复杂的，这里我们先不引入虚拟Dom，简单实现，后面会新开一篇文章整理```虚拟Dom```和```diff```。


使用```createDocumentFragment```把所有节点都剪贴到内存中，然后编译内存中的文档碎片。
```js
Vue.prototype._update = function () {
  const vm = this
  const el = vm.$el
  // 内存中创建文档碎片，然后操作文档碎片，完成替换后替换到页面，提高性能
  const node = document.createDocumentFragment()
  let firstChild
  while (firstChild = el.firstChild) {
    // appendChild 如果元素存在将会剪贴
    node.appendChild(firstChild)
  }
  complier(node, vm)
  el.appendChild(node)
  console.log('更新')
}
```
匹配页面中的```{{}}```文本，替换为真实的变量的值。

如果是元素节点继续调用```complier```进行编译。
```js
// (?:.|\r?\n) 任意字符或者是回车
// 非贪婪模式 `{{a}} {{b}}` 保证识别到是两组而不是一组
const defaultReg = /\{\{((?:.|\r?\n)+?)\}\}/g
const utils = {
  getValue(vm, expr) {
    const keys = expr.split('.')
    return keys.reduce((memo, current) => {
      return memo[current]
    }, vm)
  },
  complierText(node, vm) {
    // 第一次渲染时给node添加自定义属性存放模版
    if (!node.expr) {
      node.expr = node.textContent
    }
    // 替换模版中的表达式，更新到节点的textContent中
    node.textContent = node.expr.replace(defaultReg, (...args) => {
      return utils.getValue(vm, args[1])
    })
  }
}

export function complier(node, vm) {
  const childNodes = node.childNodes;

  // 类数组转化为数组
  [...childNodes].forEach(child => {
    if (child.nodeType === 1) { // 元素节点
      complier(child, vm)
    } else if (child.nodeType === 3) { // 文本节点
      utils.complierText(child, vm)
    }
  })
}
```
🧪测试一下，页面的变量都被正确替换了。
```html
<div id="app">
  {{msg}}
  <div>
    <div>
      name: {{obj.name}}
    </div>
    <div>
      age: {{obj.age}}
    </div>
  </div>
  <div>
      arr: {{arr}}
  </div>
</div>
```
```js
const vm = new Vue({
  el: '#app',
  data() {
    return {
      msg: 'hello，world',
      obj: { name: 'forrest', age: 11 },
      arr: [1, 2, 3]
    }
  }
})
```
但是我们现在去修改属性```vm.msg = 'hello，sister'```，发现页面并不会更新，因为现在还没有进行依赖收集👇

[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/9c89ad5a793c5002a177a5cf38a2717efa7d528a)


## 4️⃣依赖收集

到这里我们目前实现了：
- 劫持了对象和数组，能够在getter和setter自定义我们需要的操作。
- 实现了简单的模版解析。

响应式原理是一个订阅/发布模式。

举个🌰：
```js
class Dep {
  constructor() {
    // 存放watcher观察者/订阅者
    this.subs = []
  }

  addSub(watcher) {
    this.subs.push(watcher)
  }

  notify() {
    this.subs.forEach(watcher => watcher.update())
  }
}

const dep = new Dep()
dep.addSub({
  update() {
    console.log('订阅者1')
  }
})
dep.addSub({
  update() {
    console.log('订阅者2')
  }
})
dep.notify()
```
这里有两个概念：
- ```dep```发布者/订阅容器
- ```watcher```观察者/订阅者

上面代码中声明了一个```dep```类，并往这个类添加了两个观察者```watcher```，当执行```dep.notify```，所有的```watcher```都会收到广播，并且执行自身的```update```方法。

所以依赖收集的思路就非常明确，为每个属性声明一个```dep```，在属性的```getter```里面执行```dep.addSub()```，在```setter```里面广播```dep.notify```。

现在问题是```dep.addSub()```的时候我们到底要添加什么。

往上翻一翻，在实现```$mount```的时候我们提到一个```渲染watcher```，并且声明了一个```Watcher```类。

现在稍微修改一下```Watcher```，新增一个```update```方法并且在```getter```调用前把当前watcher实例挂到```Dep.target```上。

```js
import Dep from './dep'
let id = 0 // 每个watcher的标识
class Watcher {
  constructor(vm, exprOrFn, cb = () => {}, opts = {}) {
    this.vm = vm
    this.exprOrFn = exprOrFn
    if (typeof exprOrFn === 'function') {
      this.getter = exprOrFn
    }
    this.cb = cb
    this.opts = opts
    this.id = id++

    this.get()
  }

  get() {
    Dep.target = this // 这样写实际上有问题的，后面会讲到pushTarget和popTarget。
    this.getter()
  }

  update() {
    console.log('watcher update')
    this.get()
  }
}
```

然后我们修改```defineReactive```方法，添加```addSub```和```dep.notify()```。

```js
export function defineReactive(data, key, value) {
  // ...

  // 给每个属性都添加一个dep
  const dep = new Dep()

  Object.defineProperty(data, key, {
    get() {
      // 取数据的时候进行依赖收集
      if (Dep.target) {
        dep.addSub(Dep.target)
      }
      // ...
    },
    set(newValue) {
      // 数据变化，通知更新视图
      dep.notify()
      // ...
    }
  })
}
```

🧪测试一下，可以看到2秒后修改数据，页面也重新渲染了。

```html
<div id="app">
  {{msg}}
</div>
```
```js
const vm = new Vue({
  el: '#app',
  data() {
    return {
      msg: 'hello,world'
    }
  }
})

setTimeout(() => {
  vm.msg = 'hello,guy'
}, 2000)
```

到这里我们梳理一下整个代码的执行流程：
1. ```new Vue()```初始化数据后，给数据添加了```getter```，```setter```。
2. 数据重新定义后，调用$mount，然后实例化new Watcher(vm, updateComponent)。
3. new Watcher实例化时调用get方法，把当前的渲染watcher挂在Dep.target上，然后执行updateComponent方法渲染模版。
4. ```complier```解析页面的时候到```vm.msg```取值，触发了该属性的```getter```，往```vm.msg```的dep中添加Dep.target，也就是渲染watcher。
5. ```setTimeout```2秒后，修改```vm.msg```后，该属性的dep进行广播，触发```渲染watcher```的```update```方法，页面也就重新渲染了。


⚡上面实现了最基本的依赖收集，但是还有很多需要优化。

在Watcher类中的get方法直接```Dep.target = this```是有问题的，我们先看修改后的代码。

```js
class Watcher {
  get() {
    // 往Dep添加一个target，指向当前watcher
    pushTarget(this)
    this.getter()
    // getter执行完毕后，把当前watcher从Dep.target中剔除
    popTarget()
  }
}
```
```js
const stack = []
export function pushTarget(watcher) {
  Dep.target = watcher
  stack.push(watcher)
}

export function popTarget() {
  stack.pop()
  Dep.target = stack[stack.length - 1]
}
```
在Vue中渲染和更新都是组件级别的，一个组件一个渲染watcher，考虑以下代码。

```js
<div id="app">
  {{msg}}
  <MyComponent />
  {{msg2}}
</div>
```
翻译成render函数大致上长这样。
```js
renderRoot () {
    ...
    renderMyComponent ()
    ...
}
```
- 渲染父组件时，此时```stack = [root渲染watcher]```，Dep.target指向root渲染watcher。
- 当解析到MyComponent组件时，此时```stack = [root渲染watcher，MyComponent渲染watcher ]```，Dep.target指向MyComponent渲染watcher。
- MyComponent渲染完毕后，```popTarget```执行，此时```stack = [root渲染watcher]```，Dep.target指向root渲染watcher。
- 然后继续渲染父组件的其他元素渲染。

明白了整个渲染流程，维护一个watcher stack的作用就很明显了，它保证了嵌套渲染时dep能够收集到正确的watcher。

[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/29a4f8d359d773a98a231785ac6a3715c99117b7)

⚡接下来继续优化。

考虑以下代码：

```js
<div id="app">
  {{msg}}
  {{msg}}
</div>
```
这里对msg取了两次值，那么msg的dep便会存入两个相同的渲染watcher，当msg发生变化的时候会触发两次更新。

在上面的实现中，我们给每个dep和watcher都添加了一个唯一的标识id。

接下来可以让dep和watcher相互记忆，在dep收集watcher的同时，让watcher记录自身订阅了哪些dep。

```js
class Dep {
  // ...
  depend() {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
}
```
```js
class Watcher {
  constructor () {
    // ...
    this.depIds = new Set()
    this.deps = []
  }

  addDep(dep) {
    const id = dep.id
    if (!this.depIds.has(id)) {
      this.depIds.add(id)
      this.deps.push(dep)
      dep.addSub(this)
    }
  }
}
```
然后在```defineReactive```中把```dep.addSub(Dep.target)```替换成```dep.depend()```。

这样调整过后，第一次获取msg的值时会在自身的dep中添加一个watcher，同时在watcher中记录这个dep的id，第二次获取msg的时候，watcher发现已经订阅过这个dep，便不再往dep添加同一个watcher。

⚡上面处理了那么多的依赖收集似乎对数组并没有用，对于数组的依赖收集我们需要单独处理，因为我们触发更新是在```arr.push```等方法中而不是像普通属性那样在setter中。

按vue源码的做法，我们首先给每个观察过的对象(包括数组)都添加一个```__ob__```属性，返回observe实例本身，并给每一个observe实例都添加一个dep。

```js
class Observe {
  constructor(data) {
    Object.defineProperty(data, '__ob__', {
      get: () => this
    })
    // 这个dep属性专门为数组设置
    this.dep = new Dep()

    // ...
  }
}
```

添加过后，我们就可以在array的方法中，获取到这个dep。

```js
methods.forEach(method => {
  newArrayProto[method] = function (...args) {
    this.__ob__.dep.notify()

    // ...
  }
})
```
然后我们需要用这个dep去收集依赖，先看代码。
```js
export function defineReactive(data, key, value) {
  // 仅当value为数组或者对象时才有返回值，返回值是一个Observe实例
  // 这个Observe实例只是一个中介，关键是让value的数组方法和defineReactive都能获取到同一个dep
  const obs = observe(value)
  const dep = new Dep()

  Object.defineProperty(data, key, {
    get() {
      if (Dep.target) {
        dep.depend()

        // 实例中有一个dep属性
        // 如果value为数组，这个dep的notify权限给了该数组的方法
        if (obs) {
          obs.dep.depend()
        }
      }
      return value
    }
  })
}
```
假设当前的data长这样。
```js
const new Vue({
  data() {
    return {
      arr: [1, 2, 3]
    }
  }
})
```
arr这数组经过```defineReactive```就有了两个dep，第一个是存放在数组身上的dep，第二个是我们为每个属性都声明的dep，当页面引用了arr这个数据后，两个dep都会去收集watcher。```arr.push(1)```，会触发第一个dep的notify，更新页面。而```arr = [0]```这样赋值会触发第二dep的notify，同样也会更新页面。

## 5️⃣批量更新

## 6️⃣$watch

## 7️⃣computed