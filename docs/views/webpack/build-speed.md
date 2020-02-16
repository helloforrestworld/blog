---
title: 提高构建速度
---

:::tip
[本章配置代码](https://github.com/helloforrestworld/webpack-stuff/tree/build-performance/guide)
:::

:::tip
通常，升级webpack和node版本显著有效地提升构建性能。
:::

## 让 webpack 少干点活

提升 webpack 构建速度本质上就是想办法让 webpack 少干点活，活少了速度自然快了，尽量避免 webpack 去做一些不必要的事情。

### 减少resolve的解析

如果我们可以精简 resolve 配置，让 webpack 在查询模块路径时尽可能快速地定位到需要的模块，不做额外的查询工作，那么 webpack 的构建速度也会快一些，下面举个例子，介绍如何在 resolve 这一块做优化：

```js
resolve: {
  modules: [
    path.resolve(__dirname, 'node_modules'), // 使用绝对路径指定 node_modules，不做过多查询
  ],

  // 删除不必要的后缀自动补全，少了文件后缀的自动匹配，即减少了文件路径查询的工作
  // 其他文件可以在编码时指定后缀，如 import('./index.scss')
  extensions: [".js"],

  // 避免新增默认文件，编码时使用详细的文件路径，代码会更容易解读，也有益于提高构建速度
  mainFiles: ['index'],
},
```

### 把 loader 应用的文件范围缩小

我们在使用 loader 的时候，尽可能把 loader 应用的文件范围缩小，只在最少数必须的代码模块中去使用必要的 loader，例如 node_modules 目录下的其他依赖类库文件，基本就是直接编译好可用的代码，无须再经过 loader 处理了：

```js
rules: [
  {
    test: /\.jsx?/,
    include: [
      path.resolve(__dirname, 'src'),
    ],
    // exclude: /node_modules/, // 或者排除一些不需要使用loader目录
    use: 'babel-loader',
  },
  // ...
],
```

如上边这个例子，如果没有配置 include，所有的外部依赖模块都经过 Babel 处理的话，构建速度也是会收很大影响的。

### 减少 plugin 的消耗

webpack 的 plugin 会在构建的过程中加入其它的工作步骤，如果可以的话，适当地移除掉一些没有必要的 plugin。

- 使用官方推荐的插件，其本身的质量较高，有一定的性能保障。
- 不同环境配置本身必须的插件，例如```TerserJSPlugin```， ```OptimizeCSSAssetsPlugin``` 等压缩插件只需要在生产环境配置就好了，再比如```HotModuleReplacementPlugin```这些插件只配置在开发环境就可以。

### 换种方式处理图片

压缩图片可以用 webpack 的 [image-webpack-loader](https://github.com/tcoopman/image-webpack-loader) 来压缩图片，在对 webpack 构建性能要求不高的时候，这样是一种很简便的处理方式，但是要考虑提高 webpack 构建速度时，这一块的处理就得重新考虑一下了，思考一下是否有必要在 webpack 每次构建时都处理一次图片压缩。

这里介绍一种解决思路，我们可以直接使用 [imagemin](https://github.com/imagemin/imagemin-cli) 来做图片压缩，编写简单的命令即可。然后使用 pre-commit 这个类库来配置对应的命令，使其在 git commit 的时候触发，并且将要提交的文件替换为压缩后的文件。

这样提交到代码仓库的图片就已经是压缩好的了，以后在项目中再次使用到的这些图片就无需再进行压缩处理了，image-webpack-loader 也就没有必要了。


## dll

将不常用并且体积较大的第三库库单独打包，并且通过[DllPlugin](https://webpack.docschina.org/plugins/dll-plugin/)，生成打包后的资源映射```manifest.json```，在项目打包的时候加入[DllReferencePlugin](https://webpack.docschina.org/plugins/dll-plugin/#dllreferenceplugin)去解析```manifest.json```，将原本指向```node_modules```的模块直接用之前打包后的dll包代替，从而提高构建效率。

### 编写dll构建脚本

在build目录下新建```webpack.dll.js```， 在package.json添加```"build:dll": "webpack  --config ./build/webpack.dll.js",```。
```js
// webpack.dll.js
const path = require('path')
const webpack = require('webpack')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = {
  mode: 'production',
  entry: {
    vendors: ['react', 'react-dom', 'lodash']
  },
  output: {
    filename: '[name].dll.js',
    library: '[name]_[hash]', // dll需要以库的形式导出
    path: path.resolve(__dirname, '../dll')
  },
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.DllPlugin({
      name: '[name]_[hash]', // 与导出的library名字保持一致
      path: path.resolve(__dirname, '../dll/manifest.json')
    })
  ]
}

```
运行```npm run build:dll```后，将会打包生成一个dll目录， 目录里有两个文件：
- vendors.dll.js： ```react```，```react-dom```代码。
- manifest.json：```vendors.dll.js```内容与```node_modules```的映射。

### 添加dll文件到html中

在```webpack.prod.js```添加插件[AddAssetHtmlWebpackPlugin](https://github.com/SimenB/add-asset-html-webpack-plugin)，将打包好的dll文件插入到html中。

```js
// webpack.prod.js
module.exports = {
  plugin: [
    // ...
    new AddAssetHtmlWebpackPlugin({
      filepath: path.resolve(__dirname, '../dll/vendors.dll.js')
    })
  ]
}
```
运行```npm run build```后，可以看到html文件中添加了一个script引入```vendors.dll.js```。
```html
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Document</title>
</head>
<body>
  <div id="root"></div>
<script type="text/javascript" src="vendors.dll.js"></script><script type="text/javascript" src="vendors~main-4dadf1f53131e9d7c1c6.js"></script><script type="text/javascript" src="main-bf35780cd4adb7019081.js"></script></body>
</html>
```
打开这个文件你会发现window上多了一个变量，这个变量就是```webpack.dll.js```配置的library。
![20200216122532-2020-2-16-12-25-33.png](http://qiniumovie.hasakei66.com/images/20200216122532-2020-2-16-12-25-33.png)

### 插入manifest.json

通过[DllReferencePlugin](https://webpack.docschina.org/plugins/dll-plugin/#dllreferenceplugin)加载```manifest.json```。

webpack 会根据这个 ```manifest``` 文件的信息，分析出哪些模块无需打包，直接从另外的文件暴露出来的内容中获取。

```js
module.exports = {
  plugin: [
    // ...
    new webpack.DllReferencePlugin({
      manifest: path.resolve(__dirname, '../dll/manifest.json')
    })
  ]
}
```

这样调整后，打包时间有2.5s左右提升到2.3秒左右，到这里，dll的内容基本已经完成，按上面的配置，把```react```等依赖替换成你需要打包成dll的模块，已经能够处理大部分的项目。

下面还有一些拓展。

### 拆分vendors

目前我们把所有模块都打包进去vendors里面。
```js
module.exports = {
  entry: {
    vendors: ['react', 'react-dom', 'lodash']
  },
}
```

有时候我们可能需要将dll拆分成多个。

```js
module.exports = {
  entry: {
    vendors: ['lodash'],
    react: ['react', 'react-dom']
  },
}
```
然后在DllPlugin的path改成```path.resolve(__dirname, '../dll/[name].manifest.json')```。
```js
new webpack.DllPlugin({
  name: '[name]_[hash]',
  path: path.resolve(__dirname, '../dll/[name].manifest.json')
})
```
这样配置过后打包后将会生成四个文件：
- react.dll.js
- react.manifest.json
- vendors.dll.js
- vendors.manifest.json

然后修改```webpack.prod.js```，通过读取dll的目录，根据文件的数量动态添加多个```AddAssetHtmlWebpackPlugin```和```DllReferencePlugin```插件。

```js
const plugins = [
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, '../','src/index.html')
  }),
  new CleanWebpackPlugin()
]

const files = fs.readdirSync(path.resolve(__dirname, '../dll/'))
files.forEach(file => {
  if (/\.dll\.js$/.test(file)) {
    plugins.push(new AddAssetHtmlWebpackPlugin({
      filepath: path.resolve(__dirname, '../dll/', file)
    }))
  }
  if (/\.manifest\.json$/.test(file)) {
    plugins.push(new webpack.DllReferencePlugin({
      manifest: path.resolve(__dirname, '../dll/', file)
    }))
  }
})

module.exports = {
  // ...
  plugin: plugin
}
```

### 总结

dll的作用跟```optimization.splitChunks``` 很相似，都是把不常修改的第三库单独打包起来，不同的是dll的内容不需要每次都重新构建，只需要执行一次```webpack.dll.js```打包输出文件后供项目引入即可。相比```optimization.splitChunks```有显著的构建性能提升，但是dll 的缺点也非常明显，首先就是构建的脚本变复杂了，另外我们还需要去关注项目的依赖是否升级了，从而决定是否再重新打包dll
，这是一种取舍，需要我们根据项目的实际情况采用合适的做法，当然这俩也可以配合使用，把需要构建时间长的模块抽离到dll中，其余的模块用```optimization.splitChunks```处理。


:::tip
当我们需要去考虑 webpack 的构建性能问题时，往往面对的是项目过大，涉及的代码模块过多的情况，可以换一个角度去处理：

例如，拆分项目的代码，根据一定的粒度，把不同的业务代码拆分到不同的代码库去维护和管理，这样子单一业务下的代码变更就无须整个项目跟着去做构建，这样也是解决因项目过大导致的构建速度慢的一种思路，并且如果处理妥当，从工程角度上可能会给你带来其他的一些好处，例如发布异常时的局部代码回滚相对方便等等。
:::