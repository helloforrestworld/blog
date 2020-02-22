---
title: 💡响应式原理-vue源码动手写系列
---
![20200221173344-2020-2-21-17-33-45.png](http://qiniumovie.hasakei66.com/images/20200221173344-2020-2-21-17-33-45.png)
## 1️.准备工作

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
**入口文件**

接下来的篇幅我们将逐步实现```initData```、```initComputed```、```initWatch```、```$mount```。
```js
function Vue(options) {
  this._init(options)
}

Vue.prototype._init = function(options) {
  let vm = this
  vm.$options = options
  initState(vm)

  if (options.el) {
    vm.$mount()
  }
}

function initState (vm) {
  const opts = vm.$options

  if (opts.data) {
    initData(vm)
  }

  if (opts.computed) {
    initComputed(vm)
  }

  if (opts.watch) {
    initWatch(vm)
  }
}
```

## 2️.观察对象和数组

### 1️⃣观察对象1

这一节的开始我们先要了解[defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)，这里就不多介绍了。

初始化Vue实例的时候，会将用户配置的data传入```observe```函数中，然后遍历所有元素进行```defineReactive```，过程中遇到对象的话递归调用```observe```，这样就完成了整个data的重新定义。

这么做的原因是我们可以自定义属性的```getter```和```setter```，可以在里面定义一些依赖收集和视图更新的操作，这是响应式原理的开始。

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

另外，data传入的可能是对象或者函数，需要在数据传入时候处理一下。
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


****


### 2️⃣代理vm._data

你可能注意到平时我们使用vue都是能够从vm中直接获取data的数据，而不是像上面一样通过```vm._data```。

于是代理一下数据，这里仅代理第一层数据就可以了。

当访问```vm.obj.name```时，首先找到```vm.obj```也就是```vm._data.obj```，然后所有嵌套数据都能正常获取。

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


****


### 3️⃣观察数组

数据经过observe过后，对象的所有属性的访问和修改都能被监控到了，但是还没对数组处理，首先我们要劫持能修改数组数据的方法：
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
把newArrayProto设置给传入的数组，然后遍历数组，观察里面的所有元素。
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
对于数组新增的元素我们同样需要观察一波。
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

## 3️.$mount

### 1️⃣渲染watcher
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

这里就简单声明一下这个Watcher类，不用细看，后面章节还会做很多扩展和详细说明这个类。
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


****


### 2️⃣_update
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


## 4.依赖收集

### 1️⃣基本的依赖收集
目前实现了：
- 劫持了对象和数组，能够在getter和setter自定义我们需要的操作。
- 实现了简单的模版解析。

那么vue是如何知道页面是否需要更新，是不是任意一组data的数据修改都要重新渲染？当然不是，仅仅是那些被页面引用了的数据变更后才需要触发视图更新，并且vue中的更新都是组件级别的，需要精确记录数据是否被引用，被谁引用，从而决定是否更新，更新谁，这就是依赖收集的意义。

整个依赖收集的过程我认为是响应式原理最复杂也是最核心的，这里先从一个简单的订阅发布模式讲起。

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

上面代码实例化一个dep，并往这个dep添加了两个watcher，当执行```dep.notify```，所有的watcher都会收到广播，并且执行自身的update方法。

所以依赖收集的大体思路是为每个属性声明一个dep，在属性的getter里面调用```dep.addSub()```，当页面访问该属性的时候，进行依赖收集，在setter里面调用```dep.notify```，当属性被修改时，通知视图更新。

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

然后去修改```defineReactive```方法，添加```addSub```和```dep.notify()```。

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
1. ```new Vue()```初始化数据后，重新定义了数据的```getter```，```setter```。
2. 然后调用$mount，初始化了一个渲染watcher, ```new Watcher(vm, updateComponent)```。
3. Watcher实例化时调用get方法，把当前的渲染watcher挂在Dep.target上，然后执行updateComponent方法渲染模版。
4. ```complier```解析页面的时候取值```vm.msg```，触发了该属性的```getter```，往```vm.msg```的dep中添加Dep.target，也就是渲染watcher。
5. ```setTimeout```2秒后，修改```vm.msg```，该属性的dep进行广播，触发```渲染watcher```的```update```方法，页面也就重新渲染了。



****



### 2️⃣依赖收集优化--Dep.target
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
按照我们优化后的代码，执行的情况是这样的：

- 渲染父组件时，此时```stack = [root渲染watcher]```，Dep.target指向root渲染watcher。
- 当解析到MyComponent组件时，此时```stack = [root渲染watcher，MyComponent渲染watcher ]```，Dep.target指向MyComponent渲染watcher。
- MyComponent渲染完毕后，```popTarget```执行，此时```stack = [root渲染watcher]```，Dep.target指向root渲染watcher。
- 然后继续渲染父组件的其他元素渲染。

明白了整个渲染流程，维护一个watcher stack的作用就很明显了，它保证了嵌套渲染时dep能够收集到正确的watcher。

[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/29a4f8d359d773a98a231785ac6a3715c99117b7)



****


### 3️⃣依赖收集优化--过滤相同的watcher
⚡接下来继续优化，考虑以下代码：

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
    if (Dep.target) { // 调用watcher的addDep方法
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
然后在```defineReactive```就不再是```dep.addSub(Dep.target)```直接添加watcher了，而是调用```dep.depend()```，让watcher取决定是否订阅这个dep。

```js
export function defineReactive(data, key, value) {
  Object.defineProperty(data, key, {
    get() {
      if (Dep.target) {
        dep.depend()
      }
      // ...
    }
    // ...
}
```

这样调整过后，第一次获取msg的值时会在自身的dep中添加一个watcher，同时在watcher中记录这个dep的id，第二次获取msg的时候，watcher发现已经订阅过这个dep，便不再往dep添加同一个watcher。


****


### 4️⃣依赖收集优化--数组的依赖收集
⚡上面处理了那么多的依赖收集似乎对数组并没有用，对于数组的依赖收集我们需要单独处理，因为我们触发更新是在```arr.push```等方法中而不是像普通属性那样在setter中。

我们首先给每个观察过的对象(包括数组)都添加一个```__ob__```属性，返回observe实例本身，并给每一个observe实例都添加一个dep，它是专门给数组收集依赖的。

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
  // 这个Observe实例只是一个中介，关键是dep的传递。
  const obs = observe(value)
  const dep = new Dep()

  Object.defineProperty(data, key, {
    get() {
      if (Dep.target) {
        dep.depend()

        // 当value为数组时，实例中有一个dep属性，这个dep的notify权限给了该数组的方法
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

[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/ee509bc2287c8addad37e520fbc800ece90bc681)

最后我们来解决**嵌套数组依赖收集**的问题，考虑下面的数据。
```js
const vm = new Vue({
  data() {
    return {
      arr: [1, 2, 3, [1, 2]]
    }
  }
})
```
当我们修改数据，```vm.arr[3].push(3)```并不能正确更新，原因是与```vm.arr[1] = 0```一样我们没有观察数组的索引。

里面的嵌套数组```[1, 2]```，在观察的过程中没有进入到```defineReactive```这个函数中。

处理的方法就是，在外层arr收集依赖的同时也帮子数组收集，这里新增一个```dependArray```方法。

上面我们给每个观察过的对象都添加过一个```__ob__```，里面嵌套的数组同样有这个属性，这时候只需要取到里面的dep，depend收集一下就可以，如果里面还有数组嵌套则需要继续调用```dependArray```。

```js
export function defineReactive(data, key, value) {
  Object.defineProperty(data, key, {
    get() {
      if (Dep.target) {
        dep.depend()

        if (obs) {
          obs.dep.depend()
          // 处理嵌套数组的依赖收集
          dependArray(value)
        }
      }
      return value
    }
  })
}
```

```js
function dependArray(value) {
  for (let i = 0; i < value.length; i++) {
    const item = value[i]
    item.__ob__ && item.__ob__.dep.depend()

    if (Array.isArray(item)) {
      dependArray(item)
    }
  }
}
```

到这里，依赖收集的内容基本讲完了，代码的组织也跟源码差不多了，理解了上面的所有内容，下面研究computed和$watch就非常顺利了，因为它们都是基于Watcher这个类，只是新增一些缓存或者是回调函数而已。

[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/dfc872df18cb2612fc3f992a77d556bc8dfca5a5)


## 5.批量更新

### 1️⃣异步更新
考虑下面的代码，1秒后页面需要重新渲染多少次，并且msg的值是什么？
我们希望的结果是最终只渲染一次，并且msg值为最后设置的```'fee'```。

但结果是虽然页面显示的数据都是最新的，但是页面重新渲染了4次。
```js
const vm = new Vue({
  data() {
    return {
      msg: 'hello, world',
      obj: {
        a: '123'
      }
    }
  }
})
setTimeout(() => {
  vm.msg = 'bar'
  vm.msg = 'foo'
  vm.msg = 'fee'
  vm.obj.a = 'goo'
}, 1000)
```

现在需要把同步的更新改成异步的更新，待同步代码执行完毕后再统一更新。

```js
class Watcher {
   update() {
    console.log('update')
    queueWatcher(this)
  },
  run() {
    console.log('run')
    this.get()
  }
}
```
单纯的改成异步更新还不行，更新次数还是没变，我们还需要合并相同的watcher。
```js
const queueIds = new Set()
let queue = []
function flaskQueue() {
  if (!queue.length) return
  queue.forEach(watcher => watcher.run())
  queueIds.clear()
  queue = []
}

function queueWatcher(watcher) {
  const id = watcher.id
  if (!queueIds.has(id)) {
    queueIds.add(id)
    queue.push(watcher)

    // TODO replace with nextTick
    setTimeout(flaskQueue, 0)
  }
}
```
这样每次收到update通知都会向队列新增一个更新任务，待同步代码执行完毕后，清空队列，最终在页面输出的结果是，打印了4次update，1次run，符合我们的预期，最终只渲染一次。

[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/cf8c09bbceb6a1094620fac38d1414d1687625d0)


****


### 2️⃣nextTick

当我们修改了一组数据，并且希望在视图更新完毕之后进行一些操作，这时候会用到Vue.$nextTick(cb)。

```js
vm.msg = 'hi'
vm.$nextTick(() => {
  console.log('视图更新完毕')
})
console.log('我会先执行，因为我是同步代码')
```

nextTick内部同样也是维护了一个事件队列，等同步事件执行完毕后清空，就像我们上面写到的```queueWatcher```一样，但是内部针对浏览器的api支持程度做了一些兼容和优化。

在异步队列中，微任务的优先级更高，所以优先使用Promise而不是setTimeout，另外还有几个异步的api，它们的优先级顺序分别是：
- Promise(微任务)
- MutationObserver(微任务)
- setImmediate(宏任务)
- setTimeout(宏任务)

```js
const callbacks = []

function flushCallbacks() {
  callbacks.forEach(cb => cb())
}

export default function nextTick(cb) {
  callbacks.push(cb)

  const timerFunc = () => {
    flushCallbacks()
  }

  if (Promise) {
    return Promise.resolve().then(flushCallbacks)
  }

  if (MutationObserver) {
    const observer = new MutationObserver(timerFunc)
    const textNode = document.createTextNode('1')
    observer.observe(textNode, { characterData: true })
    textNode.textContent = '2'
    return
  }

  if (setImmediate) {
    return setImmediate(timerFunc)
  }

  setTimeout(timerFunc, 0)
}
```

nextTick实现后把queueWatcher的setTimeout也替换一下。

```js
function queueWatcher(watcher) {
  const id = watcher.id
  if (!queueIds.has(id)) {
    queueIds.add(id)
    queue.push(watcher)

    nextTick(flaskQueue)
  }
}
```

回顾一下开始的代码，```vm.msg```触发渲染watcher的update方法，会向nextTick添加一个```flaskQueue```任务，而用户再调用```vm.$nextTick(cb)```，会再向nextTick添加一个任务，所以最终会先渲染页面然后打印```视图更新完毕```。
```js
vm.msg = 'hi'
vm.$nextTick(() => {
  console.log('视图更新完毕')
})
```
[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/66dc0410f782e0aae7eda6b56c7e4242dc184bbe)


## 6️.$watch

### 1️⃣watch的两种用法
使用watch有两种方法，第一种直接调用vm.$watch，第二种是在选项中配置watch属性。
```js
const vm = new Vue({
  data() {
    return {
      msg: 'hello'
    }
  },
  watch: {
    msg(newVal, oldVal) {
      console.log({ newVal, oldVal })
    }
  }
})

vm.$watch('msg', function(newVal, oldVal) {
  console.log({ newVal, oldVal })
})

```
除了配置一个handler函数外，还可以配置一个对象。
```js
vm.$watch('msg', {
  handler: function(newVal, oldVal) {
    console.log({ newVal, oldVal })
  },
  immediate: true
})
```
还可以配置成数组，这里就先不考虑数组，我们先实现了核心的功能。

事实上我们只需实现一个```vm.$watch```就可以，因为选项里面配置的watch内部也是调用这个方法。

$watch函数干了两件事：
- useDef中分离出handler和其他参数，兼容函数和对象的配置方式。
- new一个Watcher，并且增加```{ user: true }```标记为用户watcher。

```js
Vue.prototype.$watch = function (expr, useDef) {
  const vm = this
  let handler = useDef
  const opts = { user: true }
  if (useDef.handler) {
    handler = useDef.handler
    Object.assign(opts, useDef)
  }
  new Watcher(vm, expr, handler, opts)
}
```


****


### 2️⃣$watch内部原理
⚡接下来我们看Watcher内部如何实现。

首先把传入的表达式转化为函数，例如```'msg'``` 转化为 ```utils.getValue(vm, 'msg')```。

这一步非常关键，因为new Watcher的时候默认调用一次get方法，然后执行getter函数，这个过程会触发msg的getter，让msg的dep添加一个用户watcher，完成依赖收集。
```js
if (typeof exprOrFn === 'function') {
  // 之前传入的updateComponent会走这里
  this.getter = exprOrFn
  } else if (typeof exprOrFn === 'string') {
  // 后面实现$watch会走这里
  this.getter = function () {
    return utils.getValue(vm, exprOrFn)
  }
}
```
然后我们希望在回调函数中返回一个新值，一个旧值，所以我们需要记录getter返回的值。
```js
class Watcher {
  constructor() {
     // ...
    this.value = this.get()
  },
  get() {
    pushTarget(this)
    const value = this.getter()
    popTarget()
    return value
  }
}
```
完成了依赖收集后，当msg改变后，就会触发这个用户watcher的run方法，所以我们修改一下这个方法，执行这个watcher的cb就完事。
```js
class Watcher {
  run() {
    const newValue = this.get()

    // 比较新旧值，执行用户添加的handler
    if (newValue !== this.value) {
      this.cb(newValue, this.value)
      this.value = newValue
    }
  }
}
```
到最后再简单处理一下immediate参数，它的作用是让cb开始的时候执行一次。
```js
class Watcher {
  constructor() {
    // ...
    if (this.immediate) {
      this.cb(this.value)
    }
  }
}
```
```$watch```这个方法实现后，遍历选项中的watch配置，逐个调用```vm.$watch```。
```js
export function initState (vm) {
  const opts = vm.$options

  if (opts.data) {
    initData(vm)
  }

  if (opts.watch) {
    initWatch(vm)
  }
}
```
```js
function initWatch(vm) {
  const watch = vm.$options.watch
  for (const key in watch) {
    const useDef = watch[key]
    vm.$watch(key, useDef)
  }
}
```


****


### 3️⃣dep与watcher梳理

到这里我们再梳理一下dep和watcher的关系吧，以刚才的msg为🌰，假设页面中引用了msg，并且配置了vm.$watch和选项的watch。
```js
<div id="app">
{{msg}}
</div>

const vm = new Vue({
  data() {
    return {
      msg: 'hello'
    }
  },
  watch: {
    msg(newVal, oldVal) {
      console.log('msg监控watcher1')
      console.log({ newVal, oldVal })
    }
  }
})

vm.$watch('msg', function(newVal, oldVal) {
  console.log('msg监控watcher2')
  console.log({ newVal, oldVal })
})
```

![20200221135550-2020-2-21-13-55-52.png](http://qiniumovie.hasakei66.com/images/20200221135550-2020-2-21-13-55-52.png)

此时，当msg的值更新时，页面会重新渲染并且输出```msg监控watcher1```，```msg监控watcher2```。

[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/f10e87fe74548343caef80492065b27d8b4372ed)

[👉戳这里看这小节代码](https://github.com/helloforrestworld/vue-source/commit/ae9baf90d1465d84d80a5708f11a1b067523126b)

## 7️.computed

### 1️⃣一个小目标
computed有以下特点：
- 每个computed都是一个watcher。
- computed一开始不会执行，而是被引用之后才去计算返回值。
- 如果依赖不变，computed会返回缓存的值。
- 需要把computed定义在vm上。

我们现实现一个小目标，先把下面的computed正确地渲染到页面。
```js
// html
<div>{{fullName}}</div>

// js
const vm = new Vue({
  data() {
    return {
      firstName: 'Forrest',
      lastName: 'Lau'
    }
  },
  computed() {
    fullName() {
      return this.firstName + this.lastName
    }
  }
})
```
首先为每个computed初始化一个watcher，然后把属性定义在vm上。
```js
function initComputed(vm) {
  const computed = vm.$options.computed
  for (const key in computed) {
    const watcher = new Watcher(vm, computed[key], () => {}, {})

    // 把计算属性定义到vm上。
    Object.defineProperty(vm, key, {
      get() {
        return watcher.value
      }
    })
  }
}
```
然后我们修改Watcher里面的get的方法，让getter的执行时的this指向vm，这样fullName方法就能够正常执行，并取出firstName和lastName计算结果后挂在watcher的value上。
```js
class Watcher {
  get() {
     pushTarget(this)
     const value = this.getter.call(this.vm)
     popTarget()
     return value
  }
}
```
👌页面上渲染出来了```ForrestLau```，下一个目标。


****


### 2️⃣lazy计算

目前所有computed都在初始化的时候就执行计算，我们希望是默认开始时不去计算，等页面引用的时候才去计算，所以我们添加一个lazy配置，默认不让getter执行，然后给Watcher添加一个evaluate方法，让页面取值的时候调用evaluate去计算。
```js
function initComputed(vm) {
  const computed = vm.$options.computed
  for (const key in computed) {
    const watcher = new Watcher(vm, computed[key], () => {}, { lazy: true })

    Object.defineProperty(vm, key, {
      get() {
        watcher.evaluate()
        return watcher.value
      }
    })
  }
}
```
```js
class Watcher {
  constructor(opts) {
    // 如果是计算属性，开始时默认不会去取值
    this.value = this.lazy ? undefined : this.get()
  }

  evaluate() {
    this.value = this.get()
  }
}
```


****


### 3️⃣computed缓存
👌我们再设置computed的缓存，首先在Watcher增加一个dirty属性标记当前computed watcher是否需要重新计算。

dirty默认为true，没有缓存需要计算，然后在evaluate后dirty变为false，仅当依赖更新时dirty才重新变为true。
```js
class Watcher {
  constructor(opts) {
    this.dirty = this.lazy
  }
  evaluate() {
    this.value = this.get()
    this.dirty = false
  }
  update() {
    if (this.lazy) {
      // 计算属性watcher更新只需要把dirty改为true
      // 当获取计算属性时便会重新evaluate
      this.dirty = true
    } else {
      queueWatcher(this)
    }
  }
}
```
然后修改计算属性的getter方法。
```js
function initComputed(vm) {
  const computed = vm.$options.computed
  for (const key in computed) {
    const watcher = new Watcher(vm, computed[key], () => {}, { lazy: true })

    Object.defineProperty(vm, key, {
      get () {
        if (watcher) {
          // 只有当依赖变化的时候需要重新evaluate
          if (watcher.dirty) {
            watcher.evaluate()
          }
        }
        return watcher.value
      }
    })
  }
}
```


****


### 4️⃣computed的依赖收集

到这里，初始化和取值都没有问题，但是当我们去修改firstName或者lastName时，发现页面并没有更新，因为这个两个属性的dep里面只有一个computed watcher，当firstName变更时，触发fullName computed watcher的update方法，只是把dirty变更为true。

我们需要为firstName和lastName都添加一个渲染watcher，这样当它们其中一个属性变更时，首先会将dirty设置为true，然后重新渲染，过程中去取fullName的值，发现dirty为true，于是调用evaluate重新计算，整个过程应该是这样才合理。

首先我们在Watcher中新增一个depend方法。
```js
class Watcher {
  depend() {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }
}
```
在computed的getter里面调用一下，然后发现上面的问题都解决了。
```js
function initComputed(vm) {
  const computed = vm.$options.computed
  for (const key in computed) {
    const watcher = new Watcher(vm, computed[key], () => {}, { lazy: true })

    Object.defineProperty(vm, key, {
      get () {
        if (watcher) {
          if (watcher.dirty) {
            watcher.evaluate()
          }
          // 新增这个就可以了
          if (Dep.target) {
            watcher.depend()
          }
        }
        return watcher.value
      }
    })
  }
}
```
这个过程到底发生了什么？🤒️
之前我们在写依赖收集的时候，声明了一个stack来存放watcher，下面我们来看看在各个阶段stack里面的情况和Dep.target的指向。

![20200221161839-2020-2-21-16-18-41.png](http://qiniumovie.hasakei66.com/images/20200221161839-2020-2-21-16-18-41.png)

关键看2、3步，当进行到第二步，开始执行evaluate方法时，会调用computed watcher的get方法，在取值之前pushTarget，往stack添加了一个computed watcher，并且让Dep.target指向这个computed watcher，然后去获取firstName和lastName，取值的过程中触发它们的setter，然后往它们的dep里头添加当前watcher，也就是Dep.target即fullName computed watcher。

所以这时dep存放的watcher情况是：
- firstName dep: ```[fullName computed watcher]```
- lastName dep: ```[fullName computed watcher]```

到了第三步，evaluate计算完成后，执行popTarget，在stack中把computed watcher移除，Dep.target的指针回到渲染watcher，然后到了关键的步骤，计算完毕执行下面这段代码，这个时候会去遍历fullName computed watcher的所有dep，然后调用它们自身的depend方法，此时Dep.target指向渲染watcher，执行depend后，顺利为firstName和lastName都添加了一个渲染watcher。
```js
// 新增这个就可以了
if (Dep.target) {
  watcher.depend()
}
```
所以这时dep存放的watcher情况是：
- firstName dep: ```[fullName computed watcher， 渲染watcher]```
- lastName dep: ```[fullName computed watcher， 渲染watcher]```

🌹🌹到这里computed已经完整的实现了，整个响应式的原理也完成了，这里有[完整代码](https://github.com/helloforrestworld/vue-source)🌹🌹