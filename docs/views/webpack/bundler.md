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
入口文件长这样。
```js
import message from './message.js'

console.log(message)
```
输出的ast。
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

可以看到program的body里面有两个Node节点，对应源码中的两个语句, 具体再打印两个节点看看。
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

然后我们可以遍历所有的节点，将```ImportDeclaration```类型的节点提取出来，得出的就是这个模块依赖。

为了方便我们直接用babel提供的[traverse模块](https://babeljs.io/docs/en/babel-traverse)。
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
接下来，引入[@babel/core](https://babeljs.io/docs/en/babel-core), 调用里面的[transformFromAst](https://babeljs.io/docs/en/babel-core#transformfromast), 将代码转化为一下。
```js
const { code } = core.transformFromAst(ast, null, {
  presets: ['@babel/preset-env']
})
```
完整bundleAnalyser方法
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
1. 首先解析入口文件，返回结果放入graphArray
2. 循环graphArray, 遍历dependencies，向graphArray添加新解析的模块
3. 如果第2步添加了新模块，循环继续，直到所有的嵌套的依赖都被解析完

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

  // 转换一下数据格式
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

首先我们需要一个require方法, 从依赖里取出code, 然后```eval(code)```执行, 返回exports。
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
执行```require("./message.js")```会报错，因为graph只有```"./src/message.js"```这个依赖，所以我们还需要改造一下require方法
- 模块在闭包中执行。
- 传递拼接路径后的require方法
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