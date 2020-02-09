---
title: webpack核心概念
---

[webpack](https://webpack.js.org/) 本质上是一个打包工具，它会根据代码的内容解析模块依赖，帮助我们把多个模块的代码打包。借用 webpack 官网的图片:
![20200209005634-2020-2-9-0-56-35.png](http://qiniumovie.hasakei66.com/images/20200209005634-2020-2-9-0-56-35.png)
[一个简单的打包器](/views/webpack/bundler.html)，实现了对JS模块的简单打包，Webpack不仅能打包JS代码，对于其他类型如：图片、CSS、字体文件、Vue文件，也能通过Loader去解析，这个概念下面会讲到。

## 安装和使用
```bash
npm install webpack webpack-cli -g

# 或者
yarn global add webpack webpack-cli

# 然后就可以全局执行命令了
webpack --help
```

个人不推荐全局安装，而是在项目里安装，因为这样能够保证项目应用的webpack版本一致，减少一些因为版本迭代后的错误。

## entry

webpack 构建的入口。webpack 会读取这个文件，并从它开始解析依赖，然后进行打包。一开始我们使用 webpack 构建时，默认的入口文件就是 ./src/index.js。

```js
module.exports = {
  entry: './src/index.js'
}

// 上述配置等同于
module.exports = {
  entry: {
    main: './src/index.js'
  }
}

// 或者配置多个入口
module.exports = {
  entry: {
    foo: './src/page-foo.js',
    bar: './src/page-bar.js',
    // ...
  }
}
```
多个入口文件通常用于配置多页面打包，后面会结合[HtmlWebpackPlugin](https://webpack.docschina.org/plugins/html-webpack-plugin/), 进行多页面配置讲解。

## loader

webpack 只能理解 JavaScript 和 JSON 文件。loader 让 webpack 能够去处理其他类型的文件，并将它们转换为有效 模块，以供应用程序使用，以及被添加到依赖图中。

举个🌰，假如需要让webpack识别css文件。
```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      { test: /\.css$/, use: 'css-loader' }
    ]
  }
}

// 你也可以为这个规则配置多个loader
// 执行顺序从下到上，从右向左。
{
  test: /\.css$/,
  use: ['style-loader', 'css-loader']
}

// 同时每个loader可以配置一些选项
{
  test: /\.css$/,
  use: ['style-loader', {
    loader: 'css-loader',
    options: {
      modules: true
    }
  }]
}
```

## plugin
loader 用于转换某些类型的模块，而插件则可以用于执行范围更广的任务。包括：打包优化，资源管理，注入环境变量。

plugin会在打包的各个生命周期干一些事情，例如[HtmlWebpackPlugin](https://webpack.docschina.org/plugins/html-webpack-plugin/)会在打包结束后创建一个HTML文件，官网提供了详细完整的[hook](https://webpack.js.org/api/compiler-hooks/)和[API](https://webpack.js.org/api/)。

## output

output配置打包输出的文件名、路径等。
```js
const path = require('path') // node核心模块
module.exports = {
  output: {
    filename: 'index.js', // 默认
    path: path.resolve(__dirname, 'dist') // path需要配置绝对路径
  }
}
```
这样打包后后将文件输出到dist/index.js。

## 其他概念和术语

- 模块(module)：在webpack中，被打包的对象一切皆为模块。
- Chunk：Webpack打包过程中，一堆module的集合。
- Bundle： 由多个不同的模块生成，bundles 包含了早已经过加载和编译的最终源文件版本。

[Chunk Vs Bundle](https://juejin.im/post/5d2b300de51d45775b419c76)

大多数情况下，一个chunk会生产一个bundle。但有时候也不完全是一对一的关系，比如我们把 devtool配置成'source-map'。

这样的配置，会产生一个Chunk，但是会产生两个bundle。
