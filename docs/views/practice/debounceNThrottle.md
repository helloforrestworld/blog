---
title: 防抖与节流
---

## 防抖（debounce）

:::tip
在一定时间内，把多次的函数触发合并成一次。
:::

![2017-12-16-debounce-2020-1-15-20-19-18.png](http://qiniumovie.hasakei66.com/images/2017-12-16-debounce-2020-1-15-20-19-18.png)

### 基础版本

```js
function debounce(func, wait) {
    var timeout;
    return function () {
        clearTimeout(timeout)
        timeout = setTimeout(func, wait);
    }
}
```
每次执行方法，清空定时器，取消上一次执行，重新触发新的定时器。

### 处理this

```js
function debounce(func, wait) {
  var timeout;
  return function () {
    var context = this

    clearTimeout(timeout)
    timeout = setTimeout(function() {
      func.apply(context)
    }, wait)
  }
}
```

### 填充参数

```js
function debounce(func, wait) {
  var timeout;
  return function () {
    var context = this
    var args = arguments

    clearTimeout(timeout)
    timeout = setTimeout(function() {
      func.apply(context, args)
    }, wait)
  }
}
```

### 立即执行
上面的防抖实现后， ```document.onmousemove = debounce(handler, 3000)```, 如果鼠标一直移动，```handler```函数始终不会执行，直到鼠标停止移动后3秒。

有时候我们需要函数立即执行第一遍

```js
function debounce(func, wait, immediate) {
  var timeout

  return function() {
    var context = this
    var args = arguments
    clearTimeout(timeout)

    if (immediate) {
      var callNow = !timeout
      timeout = setTimeout(function() {
        timeout = null
        func.apply(context, args)
      }, wait)
      if (callNow) func.apply(context, args)
    } else {
      timeout = setTimeout(function() {
        func.apply(context, args)
      }, wait)
    }
  }
}
```

### es6版本

```js
function debounce(func, wait = 300, immediate) {
  let timeout = null

  return (...args) => {
    clearTimeout(timeout)

    if (immediate) {
      let callNow = !timeout

      timeout = setTimeout(() => {
        timeout = null
        func.apply(this, args)
      }, wait)

      if (callNow) func.apply(this, args)
    } else {
      timeout = setTimeout(() => {
        func.apply(this, args)
      }, wait)
    }
  }
}
```

### 应用

对于函数防抖，有以下几种应用场景：
- 给按钮加函数防抖防止表单多次提交。
- 对于输入框连续输入进行AJAX验证时，用函数防抖能有效减少请求次数。
- 判断scroll是否滑到底部，滚动事件+函数防抖

> 总的来说，适合多次事件一次响应的情况

## 节流(throttle)


:::tip
节流就像水坝，可以控制水流的速度。
函数高频被调用，按照一定的时间间隔逐次执行
:::

![2017-12-16-throttle-2020-1-15-20-18-27.png](http://qiniumovie.hasakei66.com/images/2017-12-16-throttle-2020-1-15-20-18-27.png)

### 时间戳节流
```js
function throttle(func, threshold = 300) {
  let start = Date.now()

  return (...args) => {
    let current = Date.now()
    if (current - start > threshold) {
      fn.apply(this, args)
      start = current
    }
  }
}
```

### 定时器版本
```js
function throttle(func, threshold = 300) {
  let timeout = null
  return function(...args) {
    if (!timeout) {
      timeout = setTimeout(() => {
        func.apply(this, ...args)
        timeout = null
      }, threshold)
    }
  }
}
```

### 综合版本

- 第一种事件会立刻执行，第二种事件会在 n 秒后第一次执行
- 第一种事件停止触发后没有办法再执行事件，第二种事件停止触发后依然会再执行一次事件

```js
function throttle(func, threshold) {
    let start = 0
    let timeout = null

    return function(...args) {
        var now = Date.now();
        //下次触发 func 剩余的时间
        var remaining = threshold - (now - start);
          // 如果没有剩余的时间
        if (remaining <= 0) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            start = now;
            func.apply(this, args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
              timeout = null;
              func.apply(this, args)
            }, remaining);
        }
    };
}
```

对于函数节流，有如下几个场景：
- 游戏中的刷新率
- DOM元素拖拽
- Canvas画笔功能

> 总的来说，适合大量事件按时间做平均分配触发。

## 参考
- [JavaScript专题之跟着 underscore 学节流](https://github.com/mqyqingfeng/Blog/issues/26)
- [轻松理解JS函数节流和函数防抖](https://juejin.im/post/5a35ed25f265da431d3cc1b1)

