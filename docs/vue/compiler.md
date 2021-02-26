---
nav:
  title: 博客
  order: 1
group:
  title: Vue
  order: 1
title: 模板编译原理
order: 3
---

![20200221173344-2020-2-21-17-33-45.png](http://qiniumovie.hasakei66.com/images/20200221173344-2020-2-21-17-33-45.png)

- 系列文章：

  - [💡（一）响应式原理-vue 源码动手写系列](https://juejin.im/post/5e4fd875f265da574111ff2f)
  - [💡（二）虚拟 Dom+Diff--Vue 源码动手写系列](https://juejin.im/post/5e53c9c051882549150ea5d3)

在上一篇文章，我们介绍了虚拟 Dom 的内容，创建 vnode 需要调用 createElement 去生成，但是在日常的开发当中，我们很少去写一堆复杂的`createElement`代码去描述页面，在 Vue 中通常是写一个 template 模板，而最终我们会把这个模板编译成一个渲染函数，用这个渲染函数去生成 vnode，这个过程就是模板编译的过程，通常由 webpack `vue-loader`完成，当然你也可以引入 Vue 的`runtime + compiler`版本，在运行时才去编译，但是一般不推荐这样做，除非你确实有项目运行期间编译模板的需求，不然都是选择一个不带编译器的 vue 版本去减少代码体积。

模板编译的过程到底干了什么到现在你可能还不是很清楚，这里简单放一段伪代码去说明一下总体的编译流程吧，现在我们有一个这样的模板：

```html
<div>
  <p>{{name}}</p>
</div>
```

1️⃣ 首先第一步，编译器会去进行一些词法分析，逐段字符串去解析，最终生成一个`抽象语法树（AST）`：

```js
{
  tag: "div"
  type: 1,
  staticRoot: false,
  static: false,
  plain: true,
  parent: undefined,
  attrsList: [],
  attrsMap: {},
  children: [
      {
      tag: "p"
      type: 1,
      staticRoot: false,
      static: false,
      plain: true,
      parent: {tag: "div", ...},
      attrsList: [],
      attrsMap: {},
      children: [{
          type: 2,
          text: "{{name}}",
          static: false,
          expression: "_s(name)"
      }]
    }
  ]
}

```

2️⃣ 第二步主要是一些优化工作，它会去编译我们生成的`AST`，然后标记一下静态节点和静态根节点。

```js
static: true,
staticRoot: false
```

3️⃣ 第三步是代码字符串生成，它同样会去遍历这个`AST`，然后根据节点的类型去调用不同的 vnode 生成方法如`createElement`，`createTextNode`去拼接渲染函数，下面最终生成的结果，其中`_c` ， `_v`是`createElement`,`createTextNode`的简写，`_s`暂时可以理解为增加版的 toString 方法。

```js
`with(this)(return _c('div', [_c('p', [_v(_s(name))])]))`;
```

所以编译的流程可以划分为三大模块，对应 vue 源码中的`parse`,`optimize`,`generate`三个方法：

- 解析器
- 优化器
- 代码生成器

到这里我们只需要对它们有一个总体认识即可，下面的篇幅将会对每个模块的原理详细的分析，文章通读过后再回来看看总体的流程就会非常清晰了。

## 解析器（parse）

### 1️⃣HTML 解析器

解析器的作用就是把模板解析成抽象语法树 AST，入口是一个`parseHTML`方法，方法里面会有一个`while`循环，这个循环会通过一些正则去截取模板中的内容，根据匹配到内容的不同再去调用钩子函数去生成不同类型的 AST 树的节点，包括`start`,`end`,`chars`,`comment`， 这几个钩子分别处理`开始标签`、`结束标签`、`文本`、`注释`，过程中会不断截取一小段字符串，待整个模板 html 都被清空后模板才解析完成，看下面的伪代码：

```js
function parseHTML(html, options) {
  while (html) {
    if (匹配到开始标签) {
      options.start(tag, attrs, unary);
      continue;
    }
    if (匹配到结束标签) {
      options.end();
      continue;
    }
    if (匹配到文本) {
      options.chars(text);
      continue;
    }
    if (匹配到注释) {
      options.start(text);
      continue;
    }
  }
}
```

```js
parseHTML(template, {
  start(tag, attrs, unary) {
    // 每当解析到标签的开始位置时，触发该函数
  },
  end() {
    // 每当解析到标签的结束位置时，触发该函数
  },
  chars(text) {
    // 每当解析到文本时，触发该函数
  },
  comment(text) {
    // 每当解析到注释时，触发该函数
  },
});
```

为了方便理解，这里再手动模拟一下 HTML 解析器的运行过程，首先我们有一个模板内容：

```html
<div>
  <p>{{name}}</p>
</div>
```

最初的模板：

```js
`<div>
	<p>{{name}}</p>
</div>`;
```

第一次循环时，截取一小段字符串`<div>`，并且触发钩子函数`start`，截取后模板剩下：

```js
`
	<p>{{name}}</p>
</div>`;
```

第二次循环，截取了一段换行内容：

```js
`
	`;
```

并且触发钩子函数`chars`，截取后的模板剩下：

```js
`<p>{{name}}</p>
</div>`;
```

第三轮循环，截取字符串`<p>`，并且触发`start`钩子，截取后的模板剩下：

```js
`{{name}}</p>
</div>`;
```

第四轮循环，截取出字符串`{{` `name` `}}`，并且触发`chars`钩子，截取后的模板剩下：

```js
`</p>
</div>`;
```

第五轮循环时，截取出字符串`</p>`，并且触发`end`钩子，截取后的模板剩下：

```js
`
</div>`;
```

第六次循环，截取了一段换行内容并且触发`chars`钩子，此时模板剩下：

```js
`</div>`;
```

最后，截取了字符串`</div>`，并且触发`end`钩子，此时字符串为空，跳出循环，解析完成。

了解整个`parseHTML`的过程后，接下来我们来分析一下它们是如何匹配到一串特定的字符串和实现这几个钩子函数的。

---

### 2️⃣ 匹配开始标签

开始标签首先得是`<`开头，所以首先找到模板中的第一个`<`的位置`textEnd`，当`textEnd===0`，模板才有可能是开始标签开头。

```js
let textEnd = html.indexOf('<');
if (textEnd === 0) {
}
```

但是模板以`<`开头并不能充分说明它是一个开始标签开头，它也有可能是文本中的`<`，例如`<hello,world<div></div>`,也有可能是`html注释`或者`结束标签`，它们同样都是`<`开头，这个时候需要增加一些正则匹配。

```js
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`; // 以字母或者_开头再拼接上特定的字符任意个
const qnameCapture = `((?:${ncname}\\:)?${ncname})`; // 匹配aaa:aaa的情况
const startTagOpen = new RegExp(`^<${qnameCapture}`); // 最终拼接成匹配开始标签的正则

const start = html.match(startTagOpen);
```

这里写正则的时候注意，new RegExp 接受的是一个字符串，注意双重转义，如`[\\-\\.0-9`注意里面的双反斜杠。

`startTagOpen`我们用于匹配开始标签，匹配成功后我们就能拿到标签名。

```js
let textEnd = html.indexOf('<');
if (textEnd === 0) {
  const start = html.match(startTagOpen);
  if (start) {
    const match = {
      tagName: start[1],
      attrs: [],
    };
  }
}
```

`'<div class="box"></div>'.match(startTagOpen)`匹配后的输出为：

```js
['<div', 'div'];
```

现在我们访问`start[1]`就能拿到当前匹配的标签名，它现在我们得到的仅仅是开始标签的一小部分，我们还需要去继续处理标签上的属性，匹配出来后存入`attrs`中。

**解析标签属性**

继续以上面的`<div class="box"></div>`为例子，经过`startTagOpen`匹配成功后会把已经匹配的部分从字符串中截走，现在剩下`class="box"></div>`，我们现在要截取标签上的属性，同样需要一段正则来匹配。

```js
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
```

简单解析一下这段正则，如果还是没理解的话可以看这里[attribute 正则解释](https://juejin.im/post/5aa797076fb9a028dc40b164)，上面的正则分为四个部分：

- `^\s*`任意个空格开头, 因为属性名前面可能带空格。
- `([^\s"'<>\/=]+)`,这段是匹配属性名的，非空格非`<`等字符的才能是属性名。
- `\s*(=)\s*`，匹配等号，但是等号前后可能会有空格。
- `` (?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)) `` ，匹配属性值，属性值可以有三种写法，单引号或者双引号，还有不带引号的属性值。

`' class="box"></div>'.match(attribute)` 输出结果为：

```js
['  class="box"', 'class', '=', 'box'];
```

把 class 属性和前面的空格都匹配了，并且有三个匹配分组，分别是属性名，等号，属性值，那现在已经能处理属性匹配了，但是还有一个问题，属性可能是多个的，例如，`class="box" id="app"></div>`，这段模板用上面的正则匹配下来后也只能拿到 class 一项。

解决思路也很简单，就是放入一个循环内，用同样的方法，每次截取一小段属性，当剩余模板不符合属性特征时，才说明属性都解析完毕。

```js
let attr;
while ((attr = html.match(attribute))) {
  html = html.substring(attr[0].length);
  match.attrs.push(attr);
}
```

我们处理完属性过后，模板就剩下`></div>`，还需要把开头这个`>`处理掉，这里我们还要顺便判断一下，是否为`<input />`这种`自闭合标签`，如果是的话需要标记一下，因为它是没有子元素的，所以上面的代码还需要改造一下。

```js
const startTagClose = /^\s*(\/?)>/;
let attr, end;
while ((!(end = html.match(startTagClose)) && attr = html.match(attribute))) {
  html = html.substring(attr[0].length);
  match.attrs.push(attr);
}
if (end) {
  // 如果是自闭合标签： match: { unarySlash: '/' }
  // 如果不是：match: { unarySlash: '' }
  match.unarySlash = end[1];
  html = html.substring(end[0].length);
}
```

匹配过后上面的模板就剩下`</div>`了，到此开始标签的流程已经梳理完了，主要包括两部分，一个是标签名，另外一个是标签属性，标签属性需要逐个截取。

---

### 3️⃣ 匹配结束标签

结束标签的匹配相对简单一下，因为它不需要处理标签属性和自闭合的问题，同样的，它也是一个以`<`为开头的字符串，我们先看它的匹配正则，`qnameCapture`是 xml 标签名匹配规则，上面处理开始标签时用过。

```js
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);
```

当分辨出结束标签后，需要做两件事，一件是截出字符的内容，另外是调用`end`钩子。

```js
const endTagMatch = html.match(endTag);
if (endTagMatch) {
  html = html.substring(endTagMatch[0].length);
  options.end(endTagMatch[1]);
  continue; // 进入下一轮循环
}
```

---

### 4️⃣ 匹配注释

html 中的注释长这样`<!-- 我是注释 -->`，处理起来也是非常简单，有一点需要注意的是，Vue 中有一个`shouldKeepComment`的参数可以控制编译时是否把注释去掉。

```js
const comment = /^<!--/;
if (comment.test(html)) {
  const commentEnd = html.indexOf('-->');
  if (commentEnd >= 0) {
    if (options.shouldKeepComment) {
      options.comment(html.substring(4, commentEnd));
    }
    html = html.substring(commentEnd + 3);
    continue;
  }
}
```

---

### 5️⃣ 匹配文本

文本需要考虑两种，一种是常规的不以`<`开头的，这种就非常简单了，我们只需要找到第一个`<`的位置，把它前面的所有内容都截出来就是文本了，🌰：`text<div></div>`，找到 div 前面的`<`，它往前的所有都是文本。

```js
while (html) {
  let text;
  let textEnd = html.indexOf('<');
  if (textEnd >= 0) {
    text = html.substring(0, textEnd);
    html = html.substring(textEnd);
  }

  // 如果根本就找不到<，说明剩下的全是文本！
  if (textEnd < 0) {
    text = html;
    html = '';
  }

  // 触发chars钩子生成文本ast节点
  if (options.chars && text) {
    options.chars(text);
  }
}
```

另外我们还需要考虑一种情况就是文本时以`<`开头的情况，如`<2</div>`这种比较奇葩的模板，这种情况下 Vue 也进行了处理，思路就是，当模板开头不符合开始标签、属性、结束标签、注释，那它其实就是一个文本，下面贴一下 Vue 的源码。

```js
let text, rest, next;
if (textEnd >= 0) {
  rest = html.slice(textEnd);
  while (
    !endTag.test(rest) &&
    !startTagOpen.test(rest) &&
    !comment.test(rest) &&
    !conditionalComment.test(rest)
  ) {
    // < in plain text, be forgiving and treat it as text
    next = rest.indexOf('<', 1);
    if (next < 0) break;
    textEnd += next;
    rest = html.slice(textEnd);
  }
  text = html.substring(0, textEnd);
}
```

循环的过程中，遇到符合文本规则的（也就是不符合其他类型规则的）不断去累加`textEnd`，直到把文本内容都匹配完。

---

### 6️⃣ 文本解析器

上一小节中，我们讲了如何去截取文本内容， 但是它们不都是纯文本的内容，还会有`hello, {{name}}`，这样的带变量或者表达式的内容，因为渲染虚拟 DOM 的时候需要知道取到真实的值，所以我们要稍作处理，这就是文本解析器（parseText）要做的事情。

假设现在有一个的模板：

```html
你好{{name}}，我今年{{age}}岁啦
```

我们的目标是生成的文本 AST 长这样的：

```js
{
  type: 2,
  expression: '"你好" + _s(name) + "，我今年" + _s(age) + "岁啦"',
  text: '你好{{name}}，我今年{{age}}岁啦'
}
```

里面有一个 type 属性标记是否为纯文本，并且增加一个`expression`，这个表达式能够在渲染的时候执行返回真实的文本，所以`parseText`就是去分析原字符串，取出`{{}}`然后重新拼接的过程，下面来说一下怎么实现。

首先得有一个正则去匹配`{{}}`里面的内容，它可以是任意字符或换行，并且出现一次以上，注意这只能是非贪婪模式，因为我们是对文本全局匹配。

```js
const tagRE = /\{\{((?:.|\n))+?\}\}/g;
```

如果匹配不上的话，说明是纯文本内容，就不需要后续处理了。

```js
if (!tagRE.test(text)) {
  return;
}
```

下面就是核心的部分了，在循环中不断执行`RegExp.exec`，把匹配到的变量转换一下放进数组里面，除了处理变量，普通的文本也需要放进数组里，最后拼接出完整的字符串。

```js
function parseText(text) {
  const tagRE = /\{\{((?:.|\n))+?\}\}/g;
  if (!tagRE.test(text)) {
    return;
  }
  const tokens = [];
  let lastIndex = (tagRE.lastIndex = 0);
  let match, index;
  while ((match = tagRE.exec(text))) {
    index = match.index;
    // 先把 {{ 前面的文本放入tokens
    if (index > lastIndex) {
      tokens.push(JSON.stringify(text.slice(lastIndex, index)));
    }

    // 把变量改成_s(x)，然后放入tokens
    tokens.push(`_s(${match[1].trim()})`);

    // 更新lastIndex
    lastIndex = index + match[0].length;
  }

  // 当所有变量都处理完成后，后面还剩下文本，就直接添加到tokens后面
  if (lastIndex < text.length) {
    tokens.push(JSON.stringify(text.slice(lastIndex)));
  }

  return tokens.join('+');
}
```

---

### 7️⃣ 维护 DOM 层级关系

上面我们讲了一堆解析不同类型 AST 节点的方法，但我们最终要生成的是一个 AST 树，它们是有父子关系的，其实在内部我们会维护一个栈，每次解析到开始标签的时候就往栈推进去一个，当解析到结束标签时，推出栈的最后一个，这样栈的最后一项永远是指向当前正在解析节点的父节点，这样我们就能正确的拿到父节点，能够往里面的`children`添加子节点。

下面我们结合一个模板 🌰 分析一下：

```html
<div><h1>text</h1></div>
```

- 一开始，匹配到开始标签 div，调用钩子 start 生成 div 节点，当前 stack 为空，所以 div 节点的 parent 为空，然后往 stack 推入 div 节点。

- 然后匹配到开始标签 h1，同样调用钩子函数 start 生成 h1 节点，此时 stack 中有一个 div，然后把这个新创建的节点添加到 div 节点的 children 中同时把 div 节点挂载在自己的 parent 属性上，最后再往 stack 推入 p 节点。

- 然后匹配到 text 文本，调用 chars 钩子生成文本节点，在栈中找到最后一个节点，也就是 h1，往里面的 children 添加当前文本节点。

- 再往后匹配到结束标签 h1, 推出 stack 末端的节点 h1，h1 解析完毕。

- 最后匹配到结束标签 div，推出 stack 的最后一个节点 div，div 解析完毕，此时 stack 为空，整个模板解析完成。

最后 AST 解析完成后，AST 节点就有了父子关系：

```js
{
  tag: "div"
  parent: undefined,
  children: [
    {
      tag: "p"
      parent: {tag: "div", ...},
      children: [{
          text: "text",
      }]
    }
  ]
}
```

这个栈还有另外一个作用就是检查元素是否正确闭合了，例如`<div><p></div>`，解析到结束标签 div 时，发现栈的最后一个是 p 节点，此时在 Vue 会在开发环境发出警告 ⚠️。

---

到这里解析器的原理和执行过程大致都说了一遍，其中核心是 HTML 解析器，内部会根据模板的特征不同调用不同的钩子生成不同类型的 AST 节点，每次处理后都会截取一段字符串，待整个字符串模板都被截取空时，AST 树就生成完毕了。

在解析过程中遇到带变量的文本，需要通过文本解析器进一步处理，把`{{` `name` `}}`这种文本转为可执行的表达式`_s(name)`。

在解析的过程中是通过一个 stack 来维护树的层级关系的，栈的最后一项就是当前正在构建节点的父节点。

## 优化器（optimize）

通过解析器 parse 对模板进行编译后，我们得到一个完整的抽象语法树 AST，此时 Vue 会做一些优化工作，去标记哪些是静态节点，为什么要去标记，主要有两个好处：

- 每次重新渲染时，不需要为静态节点创建新节点。主要体现在状态变化后，需要生成新的 vnode 去对比，如果节点被标记为静态节点后，在生成新 vnode 的过程会忽略此节点，它会直接克隆旧 vnode 的节点，从而节省一定的性能开销。
- 在虚拟 DOM 中 patching 过程可以忽略静态节点，因为它首次渲染后就不会变化，不需要去 diff。

实际上的优化过程需要打两个标记：

- 静态节点：静态节点是指的是不会随状态的变更而变化的节点。
- 静态根节点：如果一个节点下面所有节点都是静态节点，并且它的父级是动态节点。

举个 🌰：

```html
<div>
  <!-- 静态根节点 -->
  <ul>
    <!-- 静态节点 -->
    <li>列表1</li>
    <!-- 静态节点 -->
    <li>列表2</li>
    <!-- 静态节点 -->
  </ul>
</div>
```

### 1️⃣ 静态节点

首先我们看判断是否为静态节点的代码：

```js
function isStatic(node: ASTNode): boolean {
  if (node.type === 2) {
    // expression 带表达式的文本肯定就不是一个静态节点
    return false;
  }
  if (node.type === 3) {
    // text 纯文本，可以确定是一个静态节点
    return true;
  }
  return !!(
    node.pre ||
    (!node.hasBindings && // no dynamic bindings 没有动态绑定
    !node.if &&
    !node.for && // not v-if or v-for or v-else 没有v-if v-for指令
    !isBuiltInTag(node.tag) && // not a built-in 不是内置标签，也就是不能是slot或者component
    isPlatformReservedTag(node.tag) && // isHTMLTag(tag) || isSVG(tag) 必须是html或者svg的保留标签
    !isDirectChildOfTemplateFor(node) && // 没有指令
      Object.keys(node).every(isStaticKey)) // 节点中不存在只有动态节点才有的属性
  );
}
```

接下来就是遍历这个 AST 树，用`isStatic`方法来判断是否为静态节点然后打上标记。

```js
function markStatic(node) {
  node.static = isStatic(node);
  if (node.type === 1) {
    // 元素节点才会去遍历children
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i];
      markStatic(child);
      if (!child.static) {
        // 遍历完成后需要再校验一下
        node.static = false;
      }
    }
  }
}
```

上面有一地方需要注意一下：

```js
if (!child.static) {
  node.static = false;
}
```

静态节点的所有子节点理论上都应该是静态节点，在遍历的过程中，我们首先给父节点标记了`static: true`后，然后去遍历子元素时发现有一个子元素是动态节点，需要把父节点的`static`置为`false`这才符合逻辑。

### 2️⃣ 静态根节点

标记完静态节点后，还需要标记静态根节点，从上面可以知道静态节点的所有子节点都是静态节点，所以我们标记静态根节点时，只需要从上往下，找到第一个静态节点，这个节点肯定就是静态根节点，并且不必再往 children 遍历了，因为一个树或者子树只有一个根节点。

说完大体的思路，再补充一下下面代码实现的几个细节问题。

- 第一就是有 children 的节点才有可能被标记为静态根节点。
- 第二就是这个节点只有一个静态文本节点的情况下就没有必要去标记静态根节点了，例如`<p>我只有一个文本节点</p>`， 主要是没有什么收益，节点本身简单。
- 第三就是当前节点不是静态根节点的时候还需要去 children 里头找有没有静态根节点。

```js
function markStaticRoots(node) {
  if (node.type === 1) {
    if (
      node.static &&
      node.children.length &&
      !(node.children.length === 1 && node.children[0].type === 3)
    ) {
      node.staticRoot = true;
      return;
    } else {
      node.staticRoot = false;
    }
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for);
      }
    }
  }
}
```

## 代码生成器（generate）

最后我们需要把 AST 转化为渲染函数的内容。

```js
const root = {
  // AST root
  type: 1,
  tag: 'div',
  atttsList: [
    {
      name: 'id',
      value: 'el',
    },
  ],
  attrsMap: {
    id: 'el',
  },
  children: [
    {
      type: 2,
      expression: '"Hello " + _s(name)',
      text: 'Hello, {{name}}',
      static: true,
    },
  ],
  plain: false, // 这个节点时编译时标上去的，发现节点没有属性，打一个plain: true的标记，否则为false
  attrs: [
    {
      name: 'id',
      value: '"el"',
    },
  ],
  static: false,
  staticRoot: false,
};
let code = generate(root);
let render = `with(this){return ${code}}`;
let renderFn = new Function(render);
```

上面的 AST 经过`generate`后，输出的代码字符串是这样的：

```js
'with(this){return _c("div", {attrs:{"id": "el"}},[_v("hello" + _s(name))])}';
```

接下来我们探究一下`generate`函数的原理。

现在我们有三个创建 vnode 的方法，它们的简写如下表格：

| 类型     | 创建方法        | 别名 |
| -------- | --------------- | ---- |
| 元素节点 | createElement   | \_c  |
| 文本节点 | createTextNode  | \_v  |
| 注释节点 | createEmptyNode | \_e  |

`generate`的大体思路就是遍历 AST 树，根据节点的类型生成调用上面三种方法的字符串代码，如果是元素节点，需要递归处理，将返回的字符串代码同样拼接到 children 上。

```js
`_c(<tagname>, <data>, <children>)`;
```

```js
const children = genChildren(vnode.children);
const data = genData(vnode)`_c(<tagname>${data ? `,${data}` : ''}${
  children ? `,${children}` : ''
})`;
```

下面来看具体实现，首先看入口的文件 genNode，它会根据节点的类型去调用不同的方法。

```js
function genNode(node, state) {
  if (node.type === 1) {
    return genElement(node, state);
  } else if (node.type === 3 && node.isComment) {
    return genComment(node);
  } else {
    return genText(node);
  }
}
```

`genElement`方法，它会去解析 data 和 children。

```js
function genElement(el, state) {
  // 如果是el.plain = true，说明这个节点时没有属性的
  const data = el.plain ? undefined : genData(el, state);
  const children = genChildren(el, state);

  let code = `_c('${el.tag}')${data ? `,${data}` : ''}${
    children ? `,${children}` : ''
  }`;
  return code;
}
```

然后看看`genData`方法，它返回一个类似`'{key:"a"}'`这样的字符串。

```js
function genData(el, state) {
  let data = '{';
  if (el.key) {
    data += `key:${el.key},`;
  }
  if (el.ref) {
    data += `ref:${el.ref},`;
  }
  // 后面还有很多如: attrs等
  return data.replace(/,$/, '') + '}';
}
```

然后再来看`genChildren`，它的作用就是循环 children，去调用`genNode`，返回一个类似`'[_c( "p", [_v("hello, world")])]'`的字符串。

```js
function genChildren(el, state) {
  const children = el.children;
  if (children.length) {
    return `[${children.map(c => genNode(c, state)).join(',')}]`;
  }
}
```

最后再看看`genComment`,`genText`这两个方法，它也比较简单，注意下文本内容需要调用`JSON.stringify`转换一下。

因为我们预期中的代码是这样的`'_v("hello,world")'`而不是`'_v(hello,world)'`

```js
function genText(text) {
  return `_v(${text.type === 2 ? text.expression : JSON.stringify(text.text)})`;
}

function genComment(comment) {
  return `_e(${JSON.stringify(comment.text)})`;
}
```

---

模板编译的目的是将 html 模板转为成一个渲染函数，第一步需要对模板做词法分析，生成一个抽象语法树，然后 Vue 中还对这个语法树做了一些优化，标记了静态节点，最后就是根据生成的语法树去拼接一个生成 vnode 的代码字符串。

其中比较复杂的是`parse`的过程，上文探究了元素节点、文本节点、注释节点获取 tokens 的原理，在 Vue 源码中实际上还有更多的考虑，例如`条件注释，`还有对`script`、`style`等标签里面的内容作纯文本处理，感兴趣的可以去通读一下源码中 compiler 部分。

最后，奉上一个简单版本的模板编译器[源码](https://github.com/helloforrestworld/vue-source/blob/compiler/source/vue/complier.js)，如果觉得有帮助的话麻烦点个 👍 或者给个 star 呗，感谢！

**参考资料**

- [深入浅出 Vue.js](https://book.douban.com/subject/32581281/)
- [Vue.js 源码揭秘](https://ustbhuangyi.github.io/vue-analysis/)
