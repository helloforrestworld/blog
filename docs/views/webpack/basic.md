---
title: 搭建基础开发环境
---

:::tip
[本章配置代码](https://github.com/helloforrestworld/webpack-stuff/tree/basic-set/guide)
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
  mode: 'development',
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

## webpack-dev-server
```bash
npm i webpack-dev-server -D
```
配置devServer
```js
module.exports = {
  // ...
  devServer: {
    port: '3001',
    contentBase: path.resolve(__dirname, 'dist'),
    proxy: {
      changeOrigin: true
    }
  },
}
```

添加script。
```js
// package.json
{
  // ...
  "scripts": {
    "start": "webpack-dev-server"，
    "build": "webpack --mode production"
  },
}

```

- 运行```npm run start```就可以运行开发环境。
- 运行```npm run build```可以打包项目。

也可以自己写一个node服务器，通过[webpack-dev-middleware](https://webpack.docschina.org/guides/development/#%E4%BD%BF%E7%94%A8-webpack-dev-server)把 webpack 处理过的文件发送到一个 server。

## 处理图片资源&iconfont

使用```url-loader``` ```file-loader```，将图片文件打包到images目录下，字体文件打包到fonts下。

这俩的的区别就是```url-loader```多了limit的配置，可以将较小的文件打包到js文件中，减少url请求。

```js
module.exports = {
  module: {
    rules: [
      // ...
      {
        test: /\.(jpg|png|gif)$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 2048, // 小于2kb以DataUrl打包
            outputPath: 'images/',
            name: '[name]-[hash].[ext]',
          },
        },
      },
      {
        test: /\.(eot|ttf|svg|woff|woff2)$/,
        loader: 'file-loader',
        options: {
          outputPath: 'fonts/',
          name: '[name]-[hash].[ext]',
        },
      },
    ]
  }
}
```

## 打包样式文件
### 配置css
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
    'postcss-import': {}, // 让css文件能直接@import "normalize.css";
    'postcss-preset-env': {}, // 包含一些autoprefixer css-next等。
    'cssnano': {} // 压缩css
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

### @babel/preset-env

安装需要的依赖。
```bash
npm i babel-loader @babel/core @babel/preset-env -D
```
配置```babel-loader```。
```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      // ...
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
      }
    ]
  }
}

```
根目录新建一个.babelrc文件。
```js
// .babelrc
{
  "presets": [
    ["@babel/preset-env", {}]
  ]
}
```

这样能正确编译const、箭头函数等，然后还需要处理一些如```Promise```、```Array.include```等polyfill, 可以直接安装```@babel/polyfill```, 然后在入口文件引入。
但是这样会全局引入polyfill包， 代码体积会增加几百k。

实际上要做到按需引入，配置非常简单，只需要配置```@babel/preset```的useBuiltIns，然后安装```corejs```， 然后可以把```@babel/polyfill```删除了。

> Since ```@babel/polyfill``` was deprecated in 7.4.0, we recommend directly adding core-js and setting the version via the corejs option.

core-js是什么
- 它是JavaScript标准库的polyfill
- 它尽可能的进行模块化，让你能选择你需要的功能
- 它可以不污染全局空间
- 它和babel高度集成，可以对core-js的引入进行最大程度的优化

```bash
  # 选择不同版本
  npm install core-js@3 --save
  npm install core-js@2 --save
```
我们可以选择不同版本去安装，这里推荐```core-js@3```
- 对于一些已经加入到ES2016-ES2019中的提案，现在已经被标记为稳定功能。
- 增加了proposals配置项，对处在提案阶段的api提供支持。(但这些慎用，随时会改变)。
- 增加了对一些web标准的支持，比如URL 和 URLSearchParams。
- 删除了一些过时的特性。

事实上，如果没有用 ECMAScript 2018，ECMAScript 2019的需求的话也可以选择```core-js@2```，因为它的体积更小。

[core-js@3](https://github.com/zloirock/core-js/blob/master/docs/2019-03-19-core-js-3-babel-and-a-look-into-the-future.md)

[致我们学前端的小时光—corejs与env、runtime的不解之缘](https://juejin.im/post/5ce693b45188252db303ff23#heading-5)

```js
// .babelrc
{
  "presets": [
    ["@babel/preset-env", {
      "useBuiltIns": "usage",
      "corejs": 3
    }]
  ]
}
```

### @babel/runtime

什么情况用 @babel/runtime, 它解决了什么问题？

Babel转译后的代码需要和源代码实现相同的功能，需要引入一些帮助函数，例如：
```js
const name = 'forrest';
const obj = { [name]: 'javascript' };
```
Babel转译后。
```js
'use strict';
function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var name = 'forrest'
var obj = _defineProperty({}, name, 'JavaScript');

```
```_defineProperty```这类工具函数可能在多个模块中重复声明，导致编译后代码体积变大。Babel 为了解决这个问题，提供了单独的包 babel-runtime 供编译时复用的工具函数库。

```js
'use strict';
// 之前的 _defineProperty 函数已经作为公共模块 `babel-runtime/helpers/defineProperty` 使用
var _defineProperty2 = require('babel-runtime/helpers/defineProperty');
var _defineProperty3 = _interopRequireDefault(_defineProperty2);
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var obj = (0, _defineProperty3.default)({}, 'name', 'JavaScript');
```

另外就是API的重写问题，例如```Object.assign```，babel转译会重写这个方法，对于编写第三库，我们不希望这样做，```@babel/runtime```可以帮我们解决这个问题。
```js
const obj = {}
Object.assign(obj, { age: 30 })
```
使用```@babel/runtime```后将会转成：
```js
'use strict';
// 使用了 core-js 提供的 assign
var _assign = require('babel-runtime/core-js/object/assign');
var _assign2 = _interopRequireDefault(_assign);
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var obj = {};
(0, _assign2.default)(obj, {
  age: 30
});
```

**如何使用？**

安装```@babel/runtime```。
corejs option	| Install  | command
| ------ | ------ | ------ |
false	| npm install --save | @babel/runtime
2 |	npm install --save | @babel/runtime-corejs2
3	| npm install --save | @babel/runtime-corejs3

> Please note that corejs: 2 only supports global variables (e.g. Promise) and static properties (e.g. Array.from), while corejs: 3 also supports instance properties (e.g. [].includes)。

corejs2支持Promise全局函数和Array.from等静态方法。corejs3支持实例的方法，这里直接使用``` @babel/runtime-corejs3 ```就完事！

```@babel/runtime```仅仅是一个帮助工具函数库，要在babel编译过程转换还需要用到插件```@babel/plugin-transform-runtime```。
```bash
npm i @babel/plugin-transform-runtime -D
```
配置.babelrc。
```js
{
  plugins: [
    ["@babel/transform-runtime", {
      corejs: 3, // 指定垫片， 这里同样可以配置使用提案阶段的API{ version: 3, proposals: true }
      helpers: true, // 默认：true，工具函数是否通过require导入，如果设置为false则直接注入代码片段。
      polyfill: true, //  // 默认：true，这块babel7移除了，默认支持polyfill。
      useBuiltIns: true, // 默认：true，这块babel7移除了，默认支持按需导入。
      regenerator: true, // 默认：true 是否开启通过require的免污染全局的方式兼容generation/async
      useESModules: false, // 默认：false 是否编译成esModule，false则编译成commonjs module。
      absoluteRuntime: false, // 默认：true 设置值时，将从指定的文件中查找 runtime 垫片。
    }]
  ]
}
```
为了方便说明才把所有配置列出来，事实上我们只需要配置一下corejs就可以，其他按默认的就没问题。

**总结**

所以，开发第三库时，为了不污染全局变量，可以这样配置。
```js
// .babelrc
{
  "presets": [
    "@babel/preset-env" // 处理const () => {}等基础转换
  ],
  "plugins": [
    ["@babel/transform-runtime", { // 处理API兼容
      "corejs": 3
    }]
  ]
}
```
如果是开发项目的话，可以不使用```runtime```。
```js
// .babelrc
{
  "presets": [
    ["@babel/preset-env", {
      "useBuiltIns": "usage",
      "corejs": 3
    }]
  ]
}
```

## react

让你的项目支持react，需要用到[@babel/preset-react](https://babeljs.io/docs/en/babel-preset-react#installation)

```bash
npm i @babel/preset-react -D
```

接着上面的```.babelrc```配置，增加一个presets。
```js
{
  "presets": [
    ["@babel/preset-env", {
      "useBuiltIns": "usage",
      "corejs": 3
    }],
    "@babel/preset-react"
  ]
}
```
## eslint

### eslint安装和配置
```bash
npm i eslint eslint-loader -D

npx eslint --init
```

我的选择:
- To check syntax, find problems, and enforce code style
- JavaScript modules (import/export)
- React
- Does your project use TypeScript? n
- Browser
- Use a popular style guide
- Standard: https://github.com/standard/standard
- JavaScript

eslint初始化后，会自动创建已给.eslintrc配置文件，可以在rules配置规则覆盖设置好的规则。

接下来创建一个```.eslintignore```，添加eslint忽略检查的目录或文件。
```
**/node_modules/**
dist
```
### webpack中配置eslint

配置```eslint-loader```
```js
module.exports = {
  module: {
    // ...
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader', 'eslint-loader'],
      },
      // ...
    ]
  }
}
```
这时候运行打包会自动检测出错误。

配置overlay。
```js
// webpack.config.js
module.exports = {
  devServer: {
    port: 3001,
    overlay: true, // 增加overlay, 可以让错误在浏览器显示，如果需要警告级别的检测都显示的话，这样配置 overlay: { warnings: true, errors: true }
    contentBase: path.resolve(__dirname, 'dist'),
    proxy: {
      changeOrigin: true,
    },
  },
}
```
有错误后，浏览器会出现一个弹层。
![20200212081924-2020-2-12-8-19-27.png](http://qiniumovie.hasakei66.com/images/20200212081924-2020-2-12-8-19-27.png)

如果你使用```vscode```，可以再安装一个eslint扩展，完成后在```setting.json```添加如下配置。
```js
{
  // ...
  "eslint.enable": true, // 是否开启eslint检测
  "eslint.format.enable": true, // 是否将eslint作为formatter
  "eslint.probe": [ // 插件作用于哪些类型的文件
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "html",
    "vue"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll": true // 代码保存自动格式化
  },
}
```
配置完成后，vscode不仅能根据你目录```.eslintrc*```检测你的代码， 并且保存代码会自动修正不符合规范的代码。

:::tip
如果要让```eslint```识别```import()```等实验性语法可以参考[代码分割](/views/webpack/optimization.html#%E4%BB%A3%E7%A0%81%E5%88%86%E5%89%B2-code-splitting)里面的动态加载模块。
:::

### pre-commit钩子
如果项目使用了git,可以通过使用pre-commit钩子在每次提交前检测，如果检测失败则禁止提交。可以在很大一定程度上保证代码质量。

这里我们使用了pre-commit git包来帮助我们实现这一目标。

```bash
npm i pre-commit -D
```

首先在package.json中添加script命令。
```js
{
  "scripts": {
    "eslint": "eslint --ext .js,.jsx src",
    "fix": "eslint --fix --ext .js,.jsx src" // 运行fix后自动修复。
  }
  "pre-commit": [
    "eslint"
  ]
}
```


## 其他设置

### resolve解析
```js
module.exports = {
  resolve: {
    extensions: ['js', 'jsx'],// import a from '../a/core' 默认去找core.js core.jsx
    mainFiles: ['index', 'main'], // import a from '../a/' 默认去找index main文件
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
}

```

### source-map
webpack 打包源代码时，可能会很难追踪到 error(错误) 和 warning(警告) 在源代码中的原始位置。

JavaScript 提供了 source map 功能，可以将编译后的代码映射回原始源代码。[devtool](https://webpack.docschina.org/configuration/devtool)。

官网提供了十多种的组合方式，每种在构建速度，源码质量上都表现不同。

官网的devtool类型都是以组合形式给出的，实际上webpack中的sourcemap的基本类型包括：eval，cheap,moudule，inline,source-map。其他的类型都是根据这5个基本类型组合而来。我们来具体分析一下这5个基本类型。

- eval: 将每一个module模块用eval执行，执行后不会生成sourcemap文件，仅仅是在每一个模块后，增加sourceURL来关联模块处理前后的对应关系。
- source-map: source-map会为每一个打包后的模块生成独立的soucemap文件。
- inline: 与source-map不同，增加inline属性后，不会生成独立的.map文件，而是将.map文件以dataURL的形式插入。
- cheap: cheap生成的.map文件会忽略原始代码中的列信息。
- module: 包含了loader模块之间的sourcemap。

对于开发环境，通常希望更快速的 source map，需要添加到 bundle 中以增加体积为代价，但是对于生产环境，则希望更精准的 source map，需要从 bundle 中分离并独立存在。

**在不同的环境中如何选择sourcemap的类型**
- 首先在源代码的列信息是没有意义的，只要有行信息就能完整的建立打包前后代码之间的依赖关系。因此不管是开发环境还是生产环境，我们都会选择增加cheap基本类型来忽略模块打包前后的列信息关联。
- 其次，不管在生产环境还是开发环境，我们都需要定位debug到最最原始的资源，比如定位错误到jsx，coffeeScript的原始代码处，而不是编译成js的代码处，因此，不能忽略module属性。
- 再次我们希望通过生成.map文件的形式，因此要增加source-map属性。

**推荐的配置**
- 开发环境： 'cheap-module-eval-source-map'
- 生产环境： 'cheap-module-source-map'

这里需要补充说明的是，eval-source-map组合使用是指将.map以DataURL的形式引入到打包好的模块中，类似于inline属性的效果，我们在生产中，使用eval-source-map会使打包后的文件太大，因此在生产环境中不会使用eval-source-map。但是因为eval的rebuild速度快，因此我们可以在本地环境中增加eval属性。

:::warning
你应该将你的服务器配置为，不允许普通用户访问 source map 文件！
:::

[Webpack中的sourcemap以及如何在生产和开发环境中合理的设置sourcemap的类型](https://blog.csdn.net/liwusen/article/details/79414508)
