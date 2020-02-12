---
title: HMR模块热替换
---

:::tip
[本章配置代码](https://github.com/helloforrestworld/webpack-stuff/tree/hmr/guide)
:::

## 原理

模块热替换(HMR - hot module replacement)功能会在应用程序运行过程中，**替换、添加或删除 模块，而无需重新加载整个页面** ，主要是通过以下几种方式，来显著加快开发速度：

- 保留在完全重新加载页面期间丢失的应用程序状态。
- **只更新变更内容**，以节省宝贵的开发时间。
- 在源代码中对 CSS/JS 进行修改，会立刻在浏览器中进行更新，这几乎相当于在浏览器 devtools 直接更改样式。


![20200213060209-2020-2-13-6-2-10.png](http://qiniumovie.hasakei66.com/images/20200213060209-2020-2-13-6-2-10.png)
图片来源：[使用 webpack 定制前端开发环境](https://juejin.im/book/5a6abad5518825733c144469)

当代码更新时，```webpack-dev-server（以下简称WDS）```，会发送更新信号到HMR运行时，然后 HMR 再请求所需要的更新数据，请求的更新数据没有问题的话就应用更新。

上面提到WDS发送的更新信号包括：
- 更新后的 manifest (JSON)
- 一个或多个 updated chunk (JavaScript)

HMR收到这个信号后，会拉取更新资源，通过manifest分析需要更新的模块，然后完成替换。

然而仅仅替换了对应的模块还是不够的，我们还需要把更新后的结果实时地在浏览器上显示出来，例如我们常用的```style-loader```，里面也内置了更新代码，在监听到样式文件变化后，动态```patch```到页面的```style```中。

:::warning
HMR 不适用于生产环境，这意味着它应当用于开发环境。更多详细信息，请查看 [生产环境](https://webpack.docschina.org/guides/production) 指南。
:::

## 配置

首先通过webpack配置开启HMR。

- 第一步，在```devServer```添加```hot: true```。
- 第二步，添加```webpack.HotModuleReplacementPlugin```插件。

```js
module.export = {
  devServer: {
    hot: true,
    // ...
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ]
}
```
配置完成后，HMR已经能够监听代码的修改进行模块替换。

但是要把更新后的结果实时地反映在浏览器上，我们还需要使用HMR的API取更新页面上的视图。

现在我们有```index.js```、```counter.js```、```const.js```三个文件。

**index.js**
```js

import counter from './counter'
import constDiv from './const'
import './index.css'

counter()
constDiv()

```

**counter.js**
```js
export default function () {
  const div = document.createElement('div')
  div.id = 'counter'
  div.innerHTML = 0
  div.addEventListener('click', () => {
    div.innerHTML = parseInt(div.textContent, 10) + 1
  })
  document.body.append(div)
}

```

**const.js**
```js
export default function () {
  const div = document.createElement('div')
  div.id = 'const'
  div.innerHTML = 10000
  document.body.append(div)
}

```
运行代码，打开页面，点击```counter```按钮，数字增加，然后再修改```const```的数字，重新保存后，看到页面重新刷新了，```counter```的数字也归0了，不符合我们预期。

我们希望是修改```const```的内容，只替换自己部分的内容，而不是取刷新重置整个页面。

在```index```添加这段代码。

```js
//...

if (module.hot) {
  module.hot.accept('./const.js', () => {
    document.getElementById('const').remove()
    constDiv()
  })
}
```

这段代码非常简单，在```const.js```更新后，移除页面上的元素，然后重新添加，这样就实现了预期中的效果。

从代码上看，constDiv 都是同一个，这样的话并没有办法引用最新的模块代码，但是我们看一下上述代码在 webpack 构建后的结果：

```js
if (true) {
  module.hot.accept("./src/const.js", function(__WEBPACK_OUTDATED_DEPENDENCIES__) {
    /* harmony import */
    __WEBPACK_IMPORTED_MODULE_1__bar__ = __webpack_require__("./src/const.js");
    (() => {
      Object(__WEBPACK_IMPORTED_MODULE_1__bar__["default"])()
    })(__WEBPACK_OUTDATED_DEPENDENCIES__);
  })
}
```

这里可以发现，我们的 constDiv 已经重新使用 ```__webpack_require__``` 来引用了，所以可以确保它是最新的模块代码。

在我们日常开发```React```、```Vue```应用中，对应的loader已经把我们完成了那部分的代码，例如，React 在组件代码更新时可能需要触发重新 render 来实现实时的组件展示效果，想要实现更丰富的HMR功能，可参考[Hot Module Replacement API](https://webpack.js.org/api/hot-module-replacement/)。