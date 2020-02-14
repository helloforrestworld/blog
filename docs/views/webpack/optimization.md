---
title: 优化资源加载
---

:::tip
[本章配置代码](https://github.com/helloforrestworld/webpack-stuff/tree/optimization/guide)
:::

## 代码分割 Code Splitting

Code Splitting本质上和webpack没有啥关系，但是webpack有工具和插件能够轻松实现。

目前我们把所有的代码，不管是js文件还是css文件都统一打包在一个main.js里面，这样做的缺点也是显而易见的，首先，bundle文件会非常大，加载速度很慢。
另外，假设我们上线后需要修改代码，稍微改动一下样式文件或者其他业务代码，重新打包后，浏览器的缓存又失效了，用户再次访问需要重新加载所有文件。

事实上，一些不常改动的第三库模块或者样式文件完全可以抽离出来，这样就可以充分利用浏览器的缓存，提升网页效率，这就是所谓的Code Splitting。

所以把代码分离到不同的 bundle 中，然后可以按需加载或并行加载这些文件。代码分离可以用于获取更小的 bundle，以及控制资源加载优先级和充分利用浏览器缓存，如果使用合理，会极大影响加载时间。

### css单独打包

安装[MiniCssExtractPlugin](https://webpack.docschina.org/plugins/mini-css-extract-plugin/#minimizing-for-production)

```js
npm install --save-dev mini-css-extract-plugin
```
配置插件
```js
// webpack.prod.js
{
  // ...
  plugins: [
    new MiniCssExtractPlugin({
      // 这里的配置跟webpack的output很相似
      filename: "[name].css",
      chunkFilename: "[id].css"
    })
  ]
}
```
生产环境打包时把```style-loader```替换成```MiniCssExtractPlugin.loader```
```js
// webpack.common.js
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const getStyleLoaders = (cssOption, ...args) => {
  let loaders = [
    isEnvDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
    { loader: 'css-loader', options: cssOption },
    'postcss-loader',
  ]
  if (args.length) {
    loaders = [...loaders, ...args]
  }
  return loaders
}
```

### js代码分割

3.x 以前的版本是使用 CommonsChunkPlugin 来做代码分离的，而 webpack 4.x 则是把相关的功能包到了 optimize.splitChunks 中，直接使用该配置就可以实现代码分离。

官方推荐的配置。
```js
module.exports = {
  // ... webpack 配置

  optimization: {
    splitChunks: {
      chunks: "all", // 所有的 chunks 代码公共的部分分离出来成为一个单独的文件
    },
  },
}
```
看起来上面只设置了```chunks: all```， 但是插件会自动合并下面的默认配置。
```js
module.exports = {
  //...
  optimization: {
    splitChunks: {
      chunks: 'async', // 决定哪些类型的模块会被分割。'async'表示只处理异步模块，'initial'只处理同步模块，'all'同时处理同步和异步模块。并且能公用。
      minSize: 30000, // 单位bytes, 至少达到minSize大小的模块才能被分割。
      maxSize: 0, // 告诉webpack大于maxSize的模块将会继续被分割，不常用。
      minChunks: 1, // 至少被重复引用minChunks次的模块才会被分割。
      maxAsyncRequests: 5, // 按需加载并发最大请求数
      maxInitialRequests: 3, // 一个入口最大的并行请求数
      automaticNameDelimiter: '~', // 打包的chunk名字连接符
      name: true, // 打包后的名称，此选项可接收 function或者布尔值，设置为true基于cacheGroups的名称生成名字。
      cacheGroups: { // 设置 chunks分组，可以自定义一些分组规则，例如下面的设置，来自node_modules的都打包进去vendors分组，其他的打包到default分组。
        vendors: {
          test: /[\\/]node_modules[\\/]/, // 匹配的规则 path.resolve(__dirname, "node_modules")也可以设置一个路径。
          priority: -10 // 权重，当两个以上分组的规则同时匹配时，看权重。
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true // 可设置是否重用该chunk
        }
      }
    }
  }
};
```
需要说明的是，cacheGroups里面的配置会继承自上一层的设置，也可以给每个cacheGroups的选项设置```chunks```, ```maxAsyncRequests```等所有值。

### 动态加载模块

旧版本```babel```要识别```import()```需要使用[ Syntax Dynamic Import Babel Plugin](https://babel.docschina.org/docs/en/babel-plugin-syntax-dynamic-import/#installation)

新版本```babel```默认支持。

另外还需要```eslint```能够正确识别。

安装[babel-eslint](https://www.npmjs.com/package/babel-eslint)，然后修改```.eslintrc```，增加```parse```配置。

```js
{
  // ...
  "parser": "babel-eslint",
  "parserOptions": {
    "ecmaFeatures": {
      "jsx": true
    },
    "ecmaVersion": 2018,
    "sourceType": "module"
  },
  // ...
}
```
配置完成后，能够正常使用```import()```并且```eslint```也不会报错了。

```import()```动态加载模块会自动进行代码分割。

```js
const button = document.createElement('button')
button.textContent = '加载'
document.body.append(button)

button.addEventListener('click', () => {
  import(/* webpackChunkName: 'jquery' */'jquery').then(({ default: $ }) => {
    console.log($)
  })
})
```
打包后会生成一个```jquery```的chunk，这个模块在按钮点击的时候会加载。

你可能会注意到，上面有一个```webpackChunkName```的注释，这个注释在webpack编译时是有实际意义的，指定了chunk的名称[magic-comments](https://webpack.js.org/api/module-methods/#magic-comments)。

配置多个```magic-comment```。
```js
import(
  /* webpackInclude: /\.json$/ */
  /* webpackExclude: /\.noimport\.json$/ */
  /* webpackChunkName: "my-chunk-name" */
  /* webpackMode: "lazy" */
  /* webpackPrefetch: true */
  /* webpackPreload: true */
  `./locale/${language}`
);
```

### 预取/预加载模块

webpack v4.6.0+ 添加了预取和预加载的支持。

在声明 import 时，使用下面这些内置指令，可以让 webpack 输出 "resource hint(资源提示)"，来告知浏览器。

```js
import(
  /* webpackPrefetch: true */
  /* webpackPreload: true */
  `./locale/${language}`
);
```

- prefetch(预取)：将来某些导航下可能需要的资源，空闲时下载。
- preload(预加载)：当前导航下可能需要资源，会在父 chunk 加载时，以并行方式开始加载。

这块参考[预取/预加载模块](https://webpack.docschina.org/guides/code-splitting/#%E9%A2%84%E5%8F%96-%E9%A2%84%E5%8A%A0%E8%BD%BD%E6%A8%A1%E5%9D%97-prefetch-preload-module-)，里面说的非常详细了。

一些页面弹窗代码等不是立即用到的可以用```webpackPrefetch```让浏览器在空闲时间再加载，有助于提高页面加载速度。

## 压缩代码

**最小化 CSS**

关于css的压缩前几章[搭建基础开发环境](/views/webpack/basic.html#配置postcss)时已经通过```postcss```实现了，里面配置了一个```cssnano```的插件，对重复无用的css代码去除和压缩代码。

除了通过```postcss```来处理之外，也可以安装一个```optimize-css-assets-webpack-plugin```的webpack插件。

这个插件底层也是通过```cssnano```实现对代码的压缩。

```js
const TerserJSPlugin = require("terser-webpack-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
module.exports = {
  optimization: {
    minimizer: [
      new TerserJSPlugin({}), // 这个是对js代码压缩的，webpack4已经内置了，但是这里重写了minimizer选项，需要补充上。
      new OptimizeCSSAssetsPlugin({})
    ]
  },
  // ...
}
```

> While webpack 5 is likely to come with a CSS minimizer built-in, with webpack 4 you need to bring your own. To minify the output, use a plugin like optimize-css-assets-webpack-plugin. Setting optimization.minimizer overrides the defaults provided by webpack, so make sure to also specify a JS minimizer

也就是```webpack5```后```OptimizeCSSAssetsPlugin```也会内置。


## Tree Shaking

```Tree Shaking```是一个术语，通常用于描述移除 JavaScript 上下文中的未引用代码(dead-code)。它依赖于 ES2015 模块语法的 静态结构 特性，例如 import 和 export。

就是说index.js引入了child.js的其中一个模块，最终打包并不会把child.js的所有内容打包进去。

理想情况是所有代码都是基于```pure(纯的 ES2015 模块)```，这样webpack就非常容易分析哪些代码被引用了，由此可以安全地删除文件中未使用的部分。

然而，我们的项目无法达到这种纯度，所以```webpack4.x```扩展了此检测能力，通过 package.json 的 "sideEffects" 属性作为标记，表明哪些模块是有副作用的，即使没有```export```也不能被删除，反之，如果设置```sideEffects: false```，则表明所有模块都无副作用，可以安全地进行shaking。

:::tip
webpack设置```mode```为```production```时，默认会在```optimization```加入```usedExports: true```选项开启```Tree Shaking```，所以我们只需要在```package.json```中设置```sideEffects: false```就能正常的进行```Tree Shaking```。
:::

简单设置```sideEffects:false```后，打包以下代码webpack会把```@babel/polyfill```, ```index.css```都给干掉，原因是静态分析时发现没有从这俩引入任何模块。
```js
import '@babel/polyfill';
import './index.css'
```
处理这种有副作用的模块，我们需要显式地在```sideEffects```中声明。

```js
// package.json
{
  "sideEffects": [
    '@babel/polyfill',
    "*.css"
  ]
}
```

