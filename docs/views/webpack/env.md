---
title: 开发与生产环境
---

:::tip
  [本章配置代码](https://github.com/helloforrestworld/webpack-stuff/tree/env/guide)
:::


## 拆分配置

开发环境和生产环境启动时读取不同的配置文件，而公共的配置文件写在```webpack.common.js```，通过```webpack-merge```合并。

基本的目录结构和脚本配置如下：
```
├── build
│   ├── webpack.common.js // 公共配置
    ├── webpack.dev.js  // 开发环境配置
    ├── webpack.prod.js // 生产环境配置
|──src
```
```js
// package.json
{
  // ...
  "scripts": {
    "start": "webpack-dev-server --config ./build/webpack.dev.js",
    "build": "webpack --config ./build/webpack.prod.js"
  },
}
```

首先安装```webpack-merge```。
```bash
npm install webpack-merge -D
```

**webpack.common.js**
```js
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const path = require('path')

const cssRegex = /\.css$/
const cssModuleRegex = /\.module\.css$/
const lessRegex = /\.less$/
const lessModuleRegex = /\.module\.less$/

const getStyleLoaders = (cssOption, ...args) => {
  let loaders = [
    'style-loader',
    { loader: 'css-loader', options: cssOption },
    'postcss-loader',
  ]
  if (args.length) {
    loaders = [...loaders, ...args]
  }
  return loaders
}

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'index.js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader', 'eslint-loader'],
      },
      {
        test: cssRegex,
        exclude: cssModuleRegex,
        use: getStyleLoaders({
          importLoaders: 1,
        }),
      },
      // ...
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, '../public/index.html'),
    }),
    new CleanWebpackPlugin(),
  ],
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  }
}

```

**webpack.dev.js**
```js
const merge = require('webpack-merge')
const path = require('path')
const commonConfig = require('./webpack.common')

const devConfig = {
  mode: 'development',
  devtool: 'cheap-module-eval-source-map',
  devServer: {
    port: 3001,
    overlay: true,
    contentBase: path.resolve(__dirname, '../dist'),
    proxy: {
      changeOrigin: true,
    },
  },
}

module.exports = merge(commonConfig, devConfig)

```

**webpack.prod.js**
```js
const merge = require('webpack-merge')
const commonConfig = require('./webpack.common')

const prodConfig = {
  mode: 'production',
  devtool: 'cheap-module-source-map'
}

module.exports = merge(commonConfig, prodConfig)
```

## 环境变量

webpack3.x的做法是通过```process.env.NODE_ENV```获取环境变量。

```js
{
  "scripts": {
    "build": "NODE_ENV=production webpack",
    "start": "NODE_ENV=development webpack-dev-server"
  }
}
```

webpack4.x提供更多的[环境变量配置](https://webpack.docschina.org/guides/environment-variables/)。

**script**
```js
webpack --env.NODE_ENV=local --env.production --progress --testing.a=3
```
**webpack.config.js**
配置文件不再导出一个对象，而是导出一个方法，第一个返回env，第二个返回所有参数集合，最终这个方法返回的对象就是导出的配置。
```js
module.exports = (env, args) => {
  console.log(env) // { NODE_ENV: 'local', production: true }
  console.log(args)
  /*
    {
      config: './build/webpack.prod.js',
      env: { NODE_ENV: 'local', production: true },
      process: true,
      testing: { a: 3 },
    }
  */
  return {

  }
}
```
