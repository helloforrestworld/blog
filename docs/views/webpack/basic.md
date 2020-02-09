---
title: 搭建基础开发环境
---

:::tip
React、Less、Eslint、Postcss
:::

## HTML模版

创建目录public加入index.html模板文件。

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
</body>
</html>
```

使用[html-webpack-plugin](https://webpack.docschina.org/plugins/html-webpack-plugin/) [clean-webpack-plugin](https://github.com/johnagan/clean-webpack-plugin)插件。
```js
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js'
  },
  plugins: [
    new HtmlWebpackPlugin({ // 创建html文件并引入chunk
      template: path.resolve(__dirname, './public/index.html')
    }),
    new CleanWebpackPlugin() // 打包前删除dist目录
  ]
}
```

## 样式

支持基本的css，并且通过```style-loader```插入到html中。
```js
module.export = {
  // ...
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  }
}
```
### 配置css-module

```js
const cssRegex = /\.css$/
const cssModuleRegex = /\.module\.css$/

module.exports = {
  module: {
    rules: [
      {
        test: cssRegex,
        exclude: cssModuleRegex,
        use: ['style-loader', 'css-loader']
      },
      {
        test: cssModuleRegex,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[path][name]__[local]--[hash:base64:5]'
              },
              // localIdentName: '[path][name]__[local]--[hash:base64:5]' 注意：css-loader这项配置被移入modules里面了。https://github.com/rails/webpacker/issues/2197
            }
          }
        ]
      }
    ]
  }
}

```

### 配置less

```bash
npm i less less-loader -D
```

新增匹配规则，增加两项配置。

```js
const lessRegex = /\.less$/
const lessModuleRegex = /\.module\.less$/

module.exports = {
  // ..
  module: {
    // ..
    {
      test: lessRegex,
      exclude: lessModuleRegex,
      use: ['style-loader', 'css-loader', 'less-loader']
    },
    {
      test: lessModuleRegex,
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            modules: {
              localIdentName: '[path][name]__[local]--[hash:base64:5]'
            }
          }
        },
        'less-loader'
      ]
    }
  }
}

```

### 配置postcss

```bash
npm i postcss-loader postcss-preset-env cssnano postcss-import -D
```

新建postcss.config.js。
```js
module.exports = {
  plugins: {
    'postcss-import': {},
    'postcss-preset-env': {},
    'cssnano': {}
  }
}
```
配置postcss-loader。
```js
// webpack.config.js
module.exports = {
  // ...
  module: {
    rules: [
      {
        test: cssRegex,
        exclude: cssModuleRegex,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: { importLoaders: 1 }
          },
          'postcss-loader'
        ]
      },
      {
        test: cssModuleRegex,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              modules: {
                localIdentName: '[path][name]__[local]--[hash:base64:5]'
              }
            }
          },
          'postcss-loader'
        ]
      },
      {
        test: lessRegex,
        exclude: lessModuleRegex,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: { importLoaders: 2 }
          },
          'postcss-loader',
          'less-loader'
        ]
      },
      {
        test: lessModuleRegex,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 2,
              modules: {
                localIdentName: '[path][name]__[local]--[hash:base64:5]'
              }
            }
          },
          'postcss-loader',
          'less-loader'
        ]
      }
    ]
  }
}

```
现在处理样式的loader配置重复比较多，将```style-loader``` ```css-loader``` ```postcss-loader```抽离出来，参考```create-react-app```的```getStyleLoaders```方法。

```js
const getStyleLoaders = (cssOption, ...args) => {
  let loaders = [
    'style-loader',
    { loader: 'css-loader', options: cssOption },
    'postcss-loader'
  ]
  if (args.length) {
    loaders = [...loaders, ...args]
  }
  return loaders
}

module.exports = {
  // ...
  module: {
    rules: [
      {
        test: cssRegex,
        exclude: cssModuleRegex,
        use: getStyleLoaders({
          importLoaders: 1
        })
      },
      {
        test: cssModuleRegex,
        use: getStyleLoaders({
          importLoaders: 1,
          modules: {
            localIdentName: '[path][name]__[local]--[hash:base64:5]'
          }
        })
      },
      {
        test: lessRegex,
        exclude: lessModuleRegex,
        use: getStyleLoaders({
          importLoaders: 2
        }, 'less-loader')
      },
      {
        test: lessModuleRegex,
        use: getStyleLoaders({
          importLoaders: 2,
          modules: {
            localIdentName: '[path][name]__[local]--[hash:base64:5]'
          }
        }, 'less-loader')
      }
    ]
  }
  // ...
}
```


在package.json配置browserslist。
- [browserslist](https://github.com/browserslist/browserslist#queries)
- [前端工程基础知识点--Browserslist (基于官方文档翻译）](https://juejin.im/post/5b8cff326fb9a019fd1474d6)
```js
"browserslist": [
  ">0.2%",
  "not dead",
  "not ie <= 11",
  "not op_mini all"
]
```



## es6+语法

## react

## eslint

## dev-server