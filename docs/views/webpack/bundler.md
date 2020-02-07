---
title: 写一个简单的bundler
---

## 总览

现在我们有三个非常简单的文件，显然这些代码不能直接在浏览器运行，因为浏览器并不认识```import``` ```export```等语法，现在我们的目的是写一个简易的打包器，将它们打包成一个可正常运行的JS代码。
```js
// index.js
import message from './message.js'
console.log(message)

// message.js
import { word } from './word.js'
const message = 'say: ' + word

export default message

// word.js
export const word = 'hello'
```
目录结构
```
├── src
│   ├── index
    ├── message
    ├── word
|──bundler.js
```
当运行```node bundler.js ```时执行打包。

下面将分模块讲解bundler的代码和思路。


## bundleAnalyser(模块分析)

读取目标文件内容。
```js
const fs = require('fs')
const content = fs.readFileSync(filename, 'utf-8')
```
引入[@babel/parser](https://babeljs.io/docs/en/babel-parser)，将文件内容解析成ast。
```js
const ast = parser.parse(content, {
  sourceType: 'module'
})
```
现在我们以入口文件index.js为🌰，输出一下ast。
```js
Node {
  type: 'File',
  start: 0,
  end: 56,
  loc: SourceLocation {
    start: Position { line: 1, column: 0 },
    end: Position { line: 3, column: 20 }
  },
  errors: [],
  program: Node {
    type: 'Program',
    start: 0,
    end: 56,
    loc: SourceLocation { start: [Position], end: [Position] },
    sourceType: 'module',
    interpreter: null,
    body: [ [Node], [Node] ],
    directives: []
  },
  comments: []
}
```
接下来我们需要通过分析ast，抽象出:
- dependencies(模块依赖)
- code(模块代码)

先处理模块依赖，可以看到上面ast中program.body里面有两个Node节点，对应源码中的两个语句，然后我们打印出这两个Node。
```js
[
  Node {
    type: 'ImportDeclaration',
    start: 0,
    end: 34,
    loc: SourceLocation { start: [Position], end: [Position] },
    specifiers: [ [Node] ],
    source: Node {
      type: 'StringLiteral',
      start: 20,
      end: 34,
      loc: [SourceLocation],
      extra: [Object],
      value: './message.js'
    }
  },
  Node {
    type: 'ExpressionStatement',
    start: 36,
    end: 56,
    loc: SourceLocation { start: [Position], end: [Position] },
    expression: Node {
      type: 'CallExpression',
      start: 36,
      end: 56,
      loc: [SourceLocation],
      callee: [Node],
      arguments: [Array]
    }
  }
]
```
两个节点分别为```ImportDeclaration```和```ExpressionStatement```类型。

找到所有```ImportDeclaration```类型节点，把节点source.value提取出来，得到的就是这个模块依赖。

这里我们直接用babel提供的[traverse模块](https://babeljs.io/docs/en/babel-traverse)。
```js
const dependencies = {}
traverse(ast, {
  ImportDeclaration({ node }) {
    // 文件的路径如import message from './message.js'
    // 这些都是相对当前文件的路径
    // bundler无法正确识别
    // 需要转化为相对bundler的路径
    const dirname = path.dirname(filename)
    const newFile = './' + path.join(dirname, node.source.value)

    // 为了方便后续代码执行，同时也将原始路径储存为key
    dependencies[node.source.value] = newFile
  }
})
```
依赖处理完了, 将ast翻译成js代码，这里用到[@babel/core](https://babeljs.io/docs/en/babel-core)里面的[transformFromAst](https://babeljs.io/docs/en/babel-core#transformfromast)方法。
```js
const { code } = core.transformFromAst(ast, null, {
  presets: ['@babel/preset-env']
})
```
完整bundleAnalyser方法。
```js
const bundleAnalyser = (filename) => {
  const content = fs.readFileSync(filename, 'utf-8')
  const ast = parser.parse(content, {
    sourceType: 'module'
  })
  const dependencies = {}
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(filename)
      const newFile = './' + path.join(dirname, node.source.value)
      dependencies[node.source.value] = newFile
    }
  })
  const { code } = core.transformFromAst(ast, null, {
    presets: ['@babel/preset-env']
  })
  return {
    filename,
    dependencies,
    code
  }
}
```

## makeDependenciesGraph(生成依赖图谱)
现在我们可以通过bundleAnalyser方法，传入一个文件路径，输出该模块的依赖和转换后的代码。

上述方法只处理了单个模块，接下来我们需要根据入口文件的依赖，继续调用bundleAnalyser分析，通常的处理方式是递归，但是如果模块的依赖层级比较深时容易造成栈溢出。

另一种方法用循环来处理。
1. 首先解析入口文件，返回结果放入数组graphArray。
2. 循环graphArray，遍历dependencies，调用bundleAnalyser逐个分析，把结果添加到graphArray后面。
3. 如果第2步添加了新模块解析，循环继续，直到所有的嵌套的依赖都被解析完。

```js
const makeDependenciesGraph = (entry) => {
  const entryModule = bundleAnalyser(entry)
  const graphArray = [ entryModule ]
  for (let i = 0; i < graphArray.length; i++) {
    const { dependencies } = graphArray[i]
    for(let key in dependencies) {
      graphArray.push(bundleAnalyser(dependencies[key]))
    }
  }

  // 转换一下数据格式，将数组转换为更好被查询的对象，以文件路径作为key。
  const graph = {}
  graphArray.forEach(item => {
    graph[item.filename] = {
      dependencies: item.dependencies,
      code: item.code
    }
  })

  return graph
}
```

执行makeDependenciesGraph后，我们得到这样的依赖图谱。
```js
{
  './src/index.js': {
    dependencies: { './message.js': './src/message.js' },
    code: '"use strict";\n' +
      '\n' +
      'var _message = _interopRequireDefault(require("./message.js"));\n' +
      '\n' +
      'function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }\n' +
      '\n' +
      'console.log(_message["default"]);'
  },
  './src/message.js': {
    dependencies: { './word.js': './src/word.js' },
    code: '"use strict";\n' +
      '\n' +
      'Object.defineProperty(exports, "__esModule", {\n' +
      '  value: true\n' +
      '});\n' +
      'exports["default"] = void 0;\n' +
      '\n' +
      'var _word = require("./word.js");\n' +
      '\n' +
      "var message = 'say: ' + _word.word;\n" +
      'var _default = message;\n' +
      'exports["default"] = _default;'
  },
  './src/word.js': {
    dependencies: {},
    code: '"use strict";\n' +
      '\n' +
      'Object.defineProperty(exports, "__esModule", {\n' +
      '  value: true\n' +
      '});\n' +
      'exports.word = void 0;\n' +
      "var word = 'hello';\n" +
      'exports.word = word;'
  }
}
```

## generateCode(生成可执行代码)

要让上面依赖中的code能执行，首先我们需要一个require方法，从依赖里取出code，然后```eval(code)```执行， 返回exports。
```js
function require(module) {
  var code = graph[module].code
  var exports = {}
  eval(code)
  return exports
}
require('./src/index.js')
```

也就是会执行这段代码。
```js
"use strict";
var _message = _interopRequireDefault(require("./message.js"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
console.log(_message["default"]);
```
执行```require("./message.js")```会报错，因为graph只有```"./src/message.js"```这个依赖，所以我们还需要改造一下require方法。
- 模块在闭包中执行。
- 传递拼接路径后的require方法。
```js
function require(module) {
  var code = graph[module].code
  function localRequire(relativePath) {
    return require(graph[module].dependencies[relativePath])
  }
  var exports = {};
  (function(require, exports, code) {
    eval(code)
  })(localRequire, exports, graph[module].code)
  return exports
}
```
完整的generateCode。
```js
const generateCode = (entry) => {
  const graph = JSON.stringify(makeDependenciesGraph(entry))
  return `
    (function(graph) {
      function require(module) {
        function localRequire(relativePath) {
          return require(graph[module].dependencies[relativePath])
        }
        var exports = {};
        (function(require, exports, code) {
          eval(code)
        })(localRequire, exports, graph[module].code)
        return exports;
      }
      require('${entry}')
    })(${graph})
  `
}
```

## 调试打包后的代码
最后，为了梳理清楚打包后的文件是如何运行的，我们利用chrome断点逐步执行一下代码。
我们将generateCode的输出写入到js文件中。

```js
const code = generateCode('./src/index.js')
fs.writeFile('index.js', code, 'utf8', function(error){
  if(error){
      console.log(error)
      return false;
  }
  console.log('打包完成。')
})
```

运行```node --inspect --inspect-brk index.js```，你会在终端看到这一段输出```Debugger listening on ws://127.0.0.1:9229/292c6351-060a-44e0-bbdc-9fb78a216a9f```， 然后我们打开chrome浏览器控制台，可以看到左上角Node图标变绿色了，点击一下，就可以进入调试界面，一直F11，逐步执行一下代码。
![20200208010650-2020-2-8-1-6-50.png](http://qiniumovie.hasakei66.com/images/20200208010650-2020-2-8-1-6-50.png)

最后，bundler的功能非常简陋，项目也没有什么实际的意义，只是作为一个简单的梳理，理解打包的原理，供大家参考[源码地址](https://github.com/helloforrestworld/webpack-stuff/tree/master/bundler)。