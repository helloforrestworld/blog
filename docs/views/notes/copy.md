---
title: 深拷贝与浅拷贝
---

## 深拷贝 VS 浅拷贝

其实深拷贝和浅拷贝都是针对的引用类型

:::tip 浅拷贝
创建一个新对象，这个对象有着原始对象属性值的一份精确拷贝。如果属性是基本类型，拷贝的就是基本类型的值，如果属性是引用类型，拷贝的就是内存地址 ，所以如果其中一个对象改变了这个地址，就会影响到另一个对象。
:::

:::tip 深拷贝
整个对象拷贝到另一个内存中，修改内容互相不影响
:::

```js
// 基本类型
var a = 1;
var b = a;`
a = 2;
console.log(a, b); // 2, 1 ，a b指向不同的数据

// 引用类型指向同一份数据
var a = {c: 1};
var b = a;
a.c = 2;
console.log(a.c, b.c); // 2, 2 全是2，a b指向同一份数据

```

对于引用类型，会导致a b指向同一份数据，此时如果对其中一个进行修改，就会影响到另外一个，有时候这可能不是我们想要的结果，如果对这种现象不清楚的话，还可能造成不必要的bug

那么如何切断a和b之间的关系呢，可以拷贝一份a的数据，根据拷贝的层级不同可以分为浅拷贝和深拷贝，浅拷贝就是只进行一层拷贝，深拷贝就是无限层级拷贝

浅拷贝的实现很简单，例如:
```js
function shallowClone(source) {
    var target = {};
    for(var i in source) {
        if (source.hasOwnProperty(i)) {
            target[i] = source[i];
        }
    }

    return target;
}
```
原生的方法很多也是浅拷贝：
```js
Object.assign()
arr.slice()
arr.concat()
```

## 深拷贝的实现

### 最简单的处理
序列化和反序列化
```js
JSON.parse(JSON.stringify())
```

虽然能应对大部分场景，但还是有很大缺陷，例如不能拷贝函数等。
[关于JSON.parse(JSON.stringify(obj))实现深拷贝应该注意的坑](https://www.jianshu.com/p/b084dfaad501)

### 深拷贝实现
实现思路
- 遍历要克隆的对象
- 如果是基础类型，直接拷贝。
- 如果是引用类型，递归循环，拷贝到新对象中
```js
function clone(source) {
  var target = {}
  for(var i in source) {
    if (source.hasOwnProperty(i)) {
      if (typeof source[i] === 'object') {
        target[i] = clone(source[i])
      } else {
        target[i] = source[i]
      }
    }
  }
  return target
}
```

上面版本实现了一个最基础的深拷贝，但是存在一下问题
- 没有对参数进行检验
- 对对象的判断不够严谨
- 没有考虑数组的情况

为了解决前两个问题，封装一个判断对象的方法
```js
function isObject(target) {
  return typeof target === 'object' && target !== null
}
```

改进以后
```js
function clone(source) {
  if (!isObject(source)) return source
  var target = {}
  for(var i in source) {
    if (source.hasOwnProperty(i)) {
      if (isObject(source[i])) {
        target[i] = clone(source[i])
      } else {
        target[i] = source[i]
      }
    }
  }
  return target
}
```

考虑数组的情况, 稍微改动一下就好了
```js
function clone(source) {
  // ...
  var target = Array.isArray(source) ? [] : {}
  // for...
}
```

### 解决一些问题

**循环引用问题**

```js
var source = {
  a: 1
}
source.b = source
```

对象里面有值引用了自身，在控制台执行```clone(target)```, 会造成栈溢出。

![20200116121208-2020-1-16-12-12-9.png](http://qiniumovie.hasakei66.com/images/20200116121208-2020-1-16-12-12-9.png)

原因就是递归的时候， 每次碰到属性b， 又重新进入了一次新的循环，解决办法是通过声明一个字典，将source对象作为key，新的target作为值，每次clone的时候在字典查找，如果有就直接返回储存的值，而不是重新调用clone方法
```js
function clone(source, map = new Map()) {
  if (!isObject(source)) return source
  var target = Array.isArray(source) ? [] : {}

  // 利用map可以用对象作为key的特性
  if (map.get(source)) {
    return map.get(source)
  }
  map.set(source, target)

  for(var i in source) {
    if (source.hasOwnProperty(i)) {
      if (isObject(source[i])) {
        target[i] = clone(source[i], map)
      } else {
        target[i] = source[i]
      }
    }
  }
  return target
}
```

另外我们可以用WeakMap替代Map提高性能
[WeakMap](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)

简单来说，Map内部有两个数组，一个存放所有键，一个存放所有值，因为数组会一直引用着每个键和值，这种引用使得垃圾回收算法不能回收处理他们，而WeakMap映射的 key 只有在其没有被回收时才是有效的。

**深拷贝方法支持Map，Set**
- 判断source的类型，根据数据源的类型，初始化一个同类型的target
```js
function getInit(target) {
    const Ctor = target.constructor;
    return new Ctor();
}
```
- 单独处理map，set的情况
```js
source.forEach(value => {
  target.add(clone(value, map));
});

// 克隆map
source.forEach((value, key) => {
  target.set(key, clone(value, map));
});
```
比较完整的实现可以参考下面掘金的文章，对深拷贝的问题都考虑得比较全面。

### 参考资料
- [深拷贝的终极探索](https://yanhaijing.com/javascript/2018/10/10/clone-deep/)
- [如何写出一个惊艳面试官的深拷贝?](https://juejin.im/post/5d6aa4f96fb9a06b112ad5b1#heading-3)