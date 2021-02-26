---
nav:
  title: 博客
  order: 1
group:
  title: Vue
  order: 1
title: 虚拟dom diff
order: 2
---

![20200221173344-2020-2-21-17-33-45.png](http://qiniumovie.hasakei66.com/images/20200221173344-2020-2-21-17-33-45.png)

系列文章：

- [💡（一）响应式原理-vue 源码动手写系列](https://juejin.im/post/5e4fd875f265da574111ff2f)
- [💡（三）complier 模板编译-vue 源码动手写系列](https://juejin.im/post/5e57df48e51d4527271e99c9)

## 1.什么是虚拟 DOM

Virtual DOM 是对 DOM 的抽象, 在 Web 中我们用 JS 对象来描述 DOM，把 DOM 从浏览器抽离出来后，我们得到一个更加轻便且灵活的描述对象，不依赖于 HTML 解析器我们更加容易做到组件的复用和跨平台。虚拟 DOM 相当于一个中间层，连接我们编写的代码和真实的 DOM，在真实渲染之前我们有空间去做更多优化工作，例如 DOM Diff，后面会在 Diff 的章节中详细讲述 Vue DOM Diff 的优化。

![20200224112818-2020-2-24-11-28-18.png](http://qiniumovie.hasakei66.com/images/20200224112818-2020-2-24-11-28-18.png)

[图片来源](<[https://www.cxymsg.com/guide/virtualDom.html#virtual-dom%E7%9A%84%E5%85%B3%E9%94%AE%E8%A6%81%E7%B4%A0](https://www.cxymsg.com/guide/virtualDom.html#virtual-dom的关键要素)>)

通常我们会有一个 createElement 方法来创建 vnode，也就是上图右边的描述对象，例如 React.createElement。举个 🌰，我们要生成虚拟 DOM，需要不断调用这个函数来生成对象。

```js
createElement('ul', { id: 'list' }, [{
  createElement('li', { class: 'item' }, ['Item 1']),
  createElement('li', { class: 'item' }, ['Item 2']),
  createElement('li', { class: 'item' }, ['Item 3']),
}])
```

这里面的三个参数分别是标签名，节点的属性，和子元素，当然在 react 和 vue 中的创建函数中其他额外的配置。但是通常我们不会这样写这种又长又臭的代码，这里面的工作通常是编译时 webpack 通过 loader 来完成转换，React 中的 JSX 和 Vue 中的 template 最终都会转化为一堆`createElement`的调用。

![code1-2020-2-24-11-54-38.png](http://qiniumovie.hasakei66.com/images/code1-2020-2-24-11-54-38.png)
![code2-2020-2-24-11-54-48.png](http://qiniumovie.hasakei66.com/images/code2-2020-2-24-11-54-48.png)

另外我们还需要一个渲染方法，将虚拟 DOM 渲染成真实的 DOM，首次渲染把 vnode 挂载在容器上标记已经进行初次挂载，当 vnode 更新时，调用 patch 方法去比对更新。

```js
function render(vnode, container) {
  // 区分首次渲染和再次渲染
  if (container.vnode) {
    patch(container.vnode, vnode, container);
  } else {
    mount(vnode, container);
  }
  container.vnode = vnode;
}
```

## 2.为什么 Vue 要引入虚拟 DOM？

事实上，Angular 和 Reat 的变化侦测有一个共同点，那就是他们不知道哪些状态(state)变了。因此，就需要进行比较暴力的比对，React 是通过虚拟 DOM 的的比对，Angular 是使用脏检查的流程。

Vue.js 的变化侦测和它们都不一样，它在一定程度上知道具体哪些状态发生了变化，这样就可以通过更细粒度的绑定来更新视图。也就是说，在 Vue.js 中，当状态发生变化时，它在一定程度上知道哪些节点使用了该状态，从而对这节点进行更新操作，根本不需要比对。事实上，在 Vue.js1.0 的时候就是这样实现的。

但是这样做其实也有一定的代价。因为粒度太细，每个绑定都会有一个对应的 watcher 来观察状态的变化，这样就会有一些内存开销以及依赖追踪的开销。当状态被越多的节点使用时，或者也没越复杂时，性能表现便不那么理想。

因此，Vue.js2.0 开始选择了一个中等粒度的解决方案，那就是引入虚拟 DOM。组件级别的 watcher 实例，也就是说即使组件内有 10 个节点使用了某个状态，但其实也只有一个 watcher 来观察这个状态，组件内的所有状态变更都会触发组件的渲染 watcher 执行，在更新组件的时候虚拟 DOM 被派上用场，更新的过程会去比对新旧 vnode 的差异，仅对更变的节点内容做操作，尽量去减少 DOM 操作，用 js 的运算成本去较少 DOM 的操作成本。

## 3.实现一个虚拟 DOM

### 1️⃣createElement

createElement 方法接受三个参数，分别是标签名，节点的属性，和子元素集合，最基本的结构如下 👇。

```js
function createElement(tag, data, children = null) {
  return {
    tag,
    data,
    children,
  };
}
```

然后我们添加为对象添加一个 flag，属性标记 vnode 的类型，目前有 HTML、TEXT、COMPONENT 三种类型，这里我们只考虑元素节点和文本节点。

```js
const vnodeType = {
  HTML: 'HTML',
  TEXT: 'TEXT',
  COMPONENT: 'COMPONENT',
};

function createElement(tag, data, children = null) {
  let flag;
  if (typeof tag === 'string') {
    flag = vnodeType.HTML;
  } else if (typeof tag === 'function') {
    flag = vnodeType.COMPONENT;
  } else {
    flag = vnodeType.TEXT;
  }
  return {
    flag,
    tag,
    data,
    children,
  };
}
```

为了方便后续 patch，在创建 vnode 的过程中，给 children 也做一个标记，这里把 children 的类型分为三类。

- EMPTY 空：当没有传入 children 或者传入了一个空数组时。
- MULTIPLE 多个：当传入的是数组，并且数组不为空，哪怕里面只有一个元素。
- SINGLE 单个：当传入的参数 children 不为数组，如果遇到一些字符串、数字等，默认为它创建一个文本节点，如 createElement('div', {id: 'box'}, '文本')。

最后我们还要添加一个 key 和 el，key 是用户传入的，用过 react 和 vue 的同学都知道，它是元素的唯一标记，通常用于提高列表 patch 性能。el 默认为空，在渲染真实 DOM 的时候会把真实元素存入 el 中。

```js
const childType = {
  EMPTY: 'EMPTY',
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE',
};

function createElement(tag, data, children = null) {
  let flag;
  if (typeof tag === 'string') {
    flag = vnodeType.HTML;
  } else if (typeof tag === 'function') {
    flag = vnodeType.COMPONENT;
  } else {
    flag = vnodeType.TEXT;
  }

  let childrenFrag;
  if (children === null) {
    childrenFrag = childType.EMPTY;
  } else if (Array.isArray(children)) {
    const length = children.length;
    if (length === 0) {
      childrenFrag = childType.EMPTY;
    } else {
      childrenFrag = childType.MULTIPLE;
    }
  } else {
    childrenFrag = childType.SINGLE;
    if (isPrimitive(children)) {
      children = createTextNode(children + '');
    }
  }
  return {
    flag,
    tag,
    data,
    key: data && data.key,
    children,
    childrenFrag,
    el: null,
  };
}
```

---

### 2️⃣render

把虚拟 DOM 挂载到指定的容器中，首次渲染直接解析 vnode，然后 appendChild```到容器中，当再次渲染时条用 patch 方法去对比新旧 vnode，替换需要变更的内容。

```js
function render(vnode, container) {
  // 区分首次渲染和再次渲染
  if (container.vnode) {
    patch(container.vnode, vnode, container);
  } else {
    mount(vnode, container);
  }
  container.vnode = vnode;
}
```

我们先实现 mount 方法，让页面能够渲染 vnode，然后 patch 部分在下一节 diff 中继续探讨。

mount 方法接受三个参数，vnode 需要挂载的对象，container 挂载容器，flagNode 参考元素，如果传入 flagNode，会调用 insertBefore 在该元素前面插入 DOM，如果没有则默认使用 appendChild，把元素放在容器 container 最后。

```js
function mount(vnode, container, flagNode) {
  const { flag } = vnode;
  if (flag === vnodeType.HTML) {
    mountElement(vnode, container, flagNode);
  } else if (flag === vnodeType.TEXT) {
    mountText(vnode, container);
  }
}
```

mountElement，mountText 会分别调用 document.createElement 和 document.createTextNode 创建真实的 DOM 节点然后添加到 vnode 的 el 上，再往页面插入，与 mountText 不同，mountElement 还需要额外处理节点的 data 和挂载 children。

```js
function mountElement(vnode, container, flagNode) {
  const { tag, data, children, childrenFrag } = vnode;
  const dom = document.createElement(tag);
  vnode.el = dom;

  if (data) {
    for (const key in data) {
      patchData(dom, key, null, data[key]);
    }
  }

  if (childrenFrag !== childType.EMPTY) {
    if (childrenFrag === childType.SINGLE) {
      mount(children, dom);
    } else if (childrenFrag === childType.MULTIPLE) {
      for (let i = 0; i < children.length; i++) {
        mount(children[i], dom);
      }
    }
  }

  flagNode ? container.insertBefore(dom, flagNode) : container.appendChild(dom);
}

function mountText(vnode, container) {
  const dom = document.createTextNode(vnode.children);
  vnode.el = dom;
  container.appendChild(dom);
}
```

这里我们再简单说一下 patchData 方法，它的作用就是解析 data，然后根据 key 类型的不同选择不同的挂载方法，例如 style，会去遍历 style 对象，逐个把它设置到 el.style 上，再如下面的@事件绑定，取出事件名和回调函数，往节点身上去绑定。

另外 patchData 还接受 prev 和 next 参数，会去清除旧的数据，用 next 新数据覆盖。

```js
function patchData(el, key, prev, next) {
  switch (key) {
    case 'style':
      for (const k in next) {
        el.style[k] = next[k];
      }
      for (const k in prev) {
        if (!next || !next.hasOwnProperty(k)) {
          el.style[k] = '';
        }
      }
      break;
    case 'class':
      el.className = next;
      break;
    default:
      if (key[0] === '@') {
        if (prev) {
          el.removeEventListener(key.slice(1), prev);
        }
        if (next) {
          el.addEventListener(key.slice(1), next);
        }
      } else {
        el.setAttribute(key, next);
      }
  }
}
```

到目前为止页面已经能正常渲染虚拟 DOM 了，接下来我们来研究一下数据更新是如何进行 Diff 以达最小单位地修改视图。

## 4.patch

### 1️⃣diff 算法

diff 算法是 patch 里面的核心算法，在我们实际操作 DOM 的过程中，很少有跨级元素的复用，因此 vue 和 react 的 diff 算法都是通过同层的树节点进行比较而非对树进行逐层搜索遍历的方式，所以时间复杂度只有 O(n)。
![20200224154204-2020-2-24-15-42-4.png](http://qiniumovie.hasakei66.com/images/20200224154204-2020-2-24-15-42-4.png)
![20200224154220-2020-2-24-15-42-20.png](http://qiniumovie.hasakei66.com/images/20200224154220-2020-2-24-15-42-20.png)

[图片来源]([https://github.com/answershuto/learnVue/blob/master/docs/VirtualDOM%E4%B8%8Ediff(Vue%E5%AE%9E%E7%8E%B0).MarkDown](<https://github.com/answershuto/learnVue/blob/master/docs/VirtualDOM与diff(Vue实现).MarkDown>)

在比较子节点的时候，vue 在 updateChildren 做了一些优化，主要是去猜 children 的头尾节点，因为我们大多数操作都是把元素移动到头部或者尾部，或者在头尾或者其他位置插入一些元素，后面会在 updateChildren 一节中将会详细分析如何实现的。

---

### 2️⃣patch 方法

首先在 patch 入口中先做一下分支处理，如果 vnode 的类型的不一样，比如旧的是一个文本节点，新的是一个元素节点，这种情况就没有对比的必要了，直接 replaceVnode 整个替换掉就好了。

当 vnode 类型都为元素节点时，调用 patchElement 方法，这是后续要说的重点，当 vnode 类型都为文本节点是调用 patchText，这个处理就比较简单了，去比较文本是否相同，不同的话直接替换旧文本。

```js
function patch(prev, next, container) {
  const nextFlag = next.flag;
  const prevFlag = prev.flag;

  // vnode类型不一样，直接替换新的。
  if (nextFlag !== prevFlag) {
    replaceVnode(prev, next, container);
  } else if (nextFlag === vnodeType.HTML) {
    patchElement(prev, next, container);
  } else if (nextFlag === vnodeType.TEXT) {
    patchText(prev, next);
  }
}
```

接下来我们讲一下 patchElement 方法，这里面做的事情也不多，它会去比较 tag 是否相同，不同的话直接替换旧节点，相同的话去更新 data，然后去继续比对 children。

```js
function patchElement(prev, next, container) {
  // 标签不一样，直接替换新的
  if (prev.tag !== next.tag) {
    replaceVnode(prev, next, container);
  }
  // 更新data
  const el = (next.el = prev.el);
  const nextData = next.data;
  const prevData = prev.data;
  if (nextData) {
    // 新增或覆盖旧属性
    for (const key in nextData) {
      const prevVal = prevData[key];
      const nextVal = nextData[key];
      patchData(el, key, prevVal, nextVal);
    }
  }
  if (prevData) {
    // 删除新vnode没有的属性
    for (const key in prevData) {
      const prevVal = prevData[key];
      if (prevVal && !nextData.hasOwnProperty(key)) {
        patchData(el, key, prevVal, null);
      }
    }
  }
  // 更新子元素
  patchChildren(
    prev.childrenFrag,
    next.childrenFrag,
    prev.children,
    next.children,
    el,
  );
}
```

`patchChildren`我们传入了`childrenFrag`，根据我们定义的 childrenFrag 分类处理，一共有三种 children 类型，两组对比就是 3\*3 九种情况，我们用两层`switch case`去处理。

```JS
const childType = {
  EMPTY: 'EMPTY',
  SINGLE: 'SINGLE',
  MULTIPLE: 'MULTIPLE'
}
```

```js
function patchChildren(
  prevChildFrag,
  nextChildFrag,
  prevChildren,
  nextChildren,
  container,
) {
  switch (prevChildFrag) {
    case childType.SINGLE:
      switch (nextChildFrag) {
        case childType.SINGLE:
          patch(prevChildren, nextChildren, container);
          break;
        case childType.EMPTY:
          container.removeChild(prevChildren.el);
          break;
        case childType.MULTIPLE:
          container.removeChild(prevChildren.el);
          for (let i = 0; i < nextChildren.length; i++) {
            mount(nextChildren[i], container);
          }
          break;
      }
      break;
    case childType.EMPTY:
      switch (nextChildFrag) {
        case childType.SINGLE:
          mount(nextChildren, container);
          break;
        case childType.EMPTY:
          break;
        case childType.MULTIPLE:
          for (let i = 0; i < nextChildren.length; i++) {
            mount(nextChildren[i], container);
          }
          break;
      }
      break;
    case childType.MULTIPLE:
      switch (nextChildFrag) {
        case childType.SINGLE:
          for (let i = 0; i < prevChildren.length; i++) {
            container.removeChild(prevChildren[i].el);
          }
          mount(nextChildren, container);
          break;
        case childType.EMPTY:
          for (let i = 0; i < prevChildren.length; i++) {
            container.removeChild(prevChildren[i].el);
          }
          break;
        case childType.MULTIPLE:
          updateChildren(prevChildren, nextChildren, container);
      }
      break;
  }
}
```

![20200224144534-2020-2-24-14-45-35.png](http://qiniumovie.hasakei66.com/images/20200224144534-2020-2-24-14-45-35.png)

1. prev 和 next 都是 single 的时候只有一个节点，直接 patch 一下这两个节点。
2. prev 为 single，next 为 empty，需要删除旧节点。
3. prev 为 single，next 为 multiple 的时候，需要删除旧节点，循环 nextChilren 逐个 mount。
4. prev 为 empty，next 为 single 时，直接挂在 next 这一个节点。
5. prev 为 empty，next 为 empty 时，啥也不用干。
6. prev 为 empty，next 为 multiple 时，循环 nextChilren 逐个 mount。
7. prev 为 multiple, next 为 single 时，需要循环删除 prev 的每一个节点，然后挂在单个元素。
8. prev 为 multiple，next 为 empty 时，需要循环删除 prev 的每一个节点。
9. prev 为 multiple，next 也为 multiple 时，这种情况也是最常见且最复杂的，这个是下一节 updateChildren 的内容。

---

### 3️⃣updateChildren 方法

updateChildren 的方法看起来比较复杂，但是目标只有一个就是去优先复用节点而不是去新建一个，整个遍历过程是一个双指针的遍历，大致流程分为三个部分：

- 首尾互相对比(4 种情况)。
- 寻找 key 相同的节点。
- 循环结束，补齐或者删除多余元素。

这里看不懂不要紧，下面我们将逐点结合代码分析。

```js
function updateChildren(prevChildren, nextChildren, container) {
  let oldStartIdx = 0;
  let oldEndIdx = prevChildren.length - 1;
  let newStartIdx = 0;
  let newEndIdx = nextChildren.length - 1;

  let oldStartVnode = prevChildren[0];
  let oldEndVnode = prevChildren[oldEndIdx];
  let newStartVnode = nextChildren[0];
  let newEndVnode = nextChildren[newEndIdx];
  let oldKeyToIdx, vnodeToMove;

  /* 新旧只要有一个左游标超出右游标，循环结束 */
  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    if (oldStartVnode === undefined) {
      /* 因为后面对比key的时候如果找到相同会把它置为undefined，循环到该节点直接跳过 */
      oldStartVnode = prevChildren[++oldStartIdx];
    } else if (oldEndVnode === undefined) {
      /* 因为后面对比key的时候如果找到相同会把它置为undefined，循环到该节点直接跳过 */
      oldEndVnode = prevChildren[--oldEndIdx];
    } else if (sameVnode(oldStartVnode, newStartVnode)) {
      /* 旧头和新头都相同，patch旧节点 */
      patch(oldStartVnode, newStartVnode, container);
      oldStartVnode = prevChildren[++oldStartIdx];
      newStartVnode = nextChildren[++newStartIdx];
    } else if (sameVnode(oldEndVnode, newEndVnode)) {
      /* 旧尾和新尾都相同，patch旧节点 */
      patch(oldEndVnode, newEndVnode, container);
      oldEndVnode = prevChildren[--oldEndIdx];
      newEndVnode = nextChildren[--newEndIdx];
    } else if (sameVnode(oldStartVnode, newEndVnode)) {
      /* 旧头和新尾相同，patch旧节点，把旧节点移动到右侧 */
      patch(oldStartVnode, newEndVnode, container);
      container.insertBefore(oldStartVnode.el, oldEndVnode.el.nextSibling);
      oldStartVnode = prevChildren[++oldStartIdx];
      newEndVnode = nextChildren[--newEndIdx];
    } else if (sameVnode(oldEndVnode, newStartVnode)) {
      /* 旧尾和新头相同，patch旧节点，把旧节点移动到左侧 */
      patch(oldEndVnode, newStartVnode, container);
      container.insertBefore(oldEndVnode.el, oldStartVnode.el);
      oldEndVnode = prevChildren[--oldEndIdx];
      newStartVnode = nextChildren[++newStartIdx];
    } else {
      /* 头尾对比完毕，开始对比key */
      if (!newStartVnode.key) {
        /* newStartVnode没有key，创建新元素 */
        mount(newStartVnode, container, oldStartVnode.el);
      } else {
        /*
          oldKeyToIdx: oldChildren key的映射对象
          例如[{tag: 'div', key: 'key1'}, {tag: 'div', key: 'key2'}] => {key1: 0, key2: 1}
        */
        if (!oldKeyToIdx)
          oldKeyToIdx = createKeyToOldIdx(prevChildren, oldStartIdx, oldEndIdx);

        let idxInOld = oldKeyToIdx[newStartVnode.key];
        if (!idxInOld) {
          /* newStartVnode有key，但是在旧的vnode没找着，同样创建新元素 */
          mount(newStartVnode, container, oldStartVnode.el);
        } else {
          vnodeToMove = prevChildren[idxInOld];
          if (sameVnode(vnodeToMove, newStartVnode)) {
            /* 找到可以被复用的元素 */
            patch(vnodeToMove, newStartVnode, container);
            /* 旧vnode置为undefined */
            prevChildren[idxInOld] = undefined;
            /* 移动找到的元素 */
            container.insertBefore(vnodeToMove.el, oldStartVnode.el);
          } else {
            /* 找到相同key，但是是不是用一个元素，可能tag不同等，同样创建新元素 */
            mount(newStartVnode, container, oldStartVnode.el);
          }
        }
      }
      /* 更新一下游标循环继续 */
      newStartVnode = nextChildren[++newStartIdx];
    }
  }
  /* while循环结束 */
  if (oldStartIdx > oldEndIdx) {
    /* 旧vnode节点集合先被遍历完成，说明还有新节点需要加入 */
    for (; newStartIdx <= newEndIdx; newStartIdx++) {
      /* nextChildren[newEndIdx + 1] === undefined，newEndIdx在最右边，这个时候flagNode = null，默认会appendChild */
      const flagNode =
        nextChildren[newEndIdx + 1] === undefined
          ? null
          : nextChildren[newEndIdx + 1].el;
      mount(nextChildren[newStartIdx], container, flagNode);
    }
  } else if (newStartIdx > newEndIdx) {
    /* 新vnode节点集合先被遍历完成，说明需要移除多余的节点 */
    for (; oldStartIdx <= oldEndIdx; oldStartIdx++) {
      container.removeChild(prevChildren[oldStartIdx].el);
    }
  }
}
```

**首尾互相对比**

我们为 prevChildren 和 nextChildren 都定义了两个首尾的游标，遍历的过程中，左右游标都会向中间靠拢，当其中一个左游标超出右游标后结束循环。

所以我们现在有了四对：

- oldStartIdx => oldStartVnode
- oldEndIdx => oldEndVnode
- newStartIdx => newStartVnode
- newEndIdx => newEndVnode

下面用一个 🌰 去说明执行过程，假设现在初次渲染页面有了 a，b，c，d 四个节点，然后数据更新，输入 d，b，e，c，a。图示是 diff 的过程。

![diff2-2020-2-24-18-34-23.jpg](http://qiniumovie.hasakei66.com/images/diff2-2020-2-24-18-34-23.jpg)

1.第一次循环，命中 sameVnode(oldStartVnode, newEndVnode)，发现 oldStartVnode 和 newEndVnode 都是 a，于是去 patch 更新一下旧节点 oldStartVnode，然后把它往右侧移动，oldStartIdx，newEndIdx 游标向中间靠拢一格。

```js
else if (sameVnode(oldStartVnode, newEndVnode)) {
  /* 旧头和新尾相同，patch旧节点，把旧节点移动到右侧 */
  patch(oldStartVnode, newEndVnode, container)
  container.insertBefore(oldStartVnode.el, oldEndVnode.el.nextSibling)
  oldStartVnode = prevChildren[++oldStartIdx]
  newEndVnode = nextChildren[--newEndIdx]
}
```

2.第二次循环，命中 sameVnode(oldEndVnode, newStartVnode)，发现 oldEndVnode 和 newStartVnode 都是 d，于是去 patch 更新一下旧节点 oldEndVnode，然后把 dom d 移动往左侧移动，oldEndIdx，newStartIdx 游标向中间靠拢一格。

```js
 else if (sameVnode(oldEndVnode, newStartVnode)) {
   /* 旧尾和新头相同，patch旧节点，把旧节点移动到左侧 */
   patch(oldEndVnode, newStartVnode, container)
   container.insertBefore(oldEndVnode.el, oldStartVnode.el)
   oldEndVnode = prevChildren[--oldEndIdx]
   newStartVnode = nextChildren[++newStartIdx]
 }
```

3.第三次循环，命中 sameVnode(oldStartVnode, newStartVnode)，发现 oldStartVnode 和 newStartVnode 都是 b，于是直接去 patch 一下 oldStartVnode，oldStartIdx 和 newStartIdx 游标都向右一格。

```js
else if (sameVnode(oldStartVnode, newStartVnode)) {
  /* 旧头和新头都相同，patch旧节点 */
  patch(oldStartVnode, newStartVnode, container)
  oldStartVnode = prevChildren[++oldStartIdx]
  newStartVnode = nextChildren[++newStartIdx]
}
```

4.第四次循环，命中 sameVnode(oldEndVnode, newEndVnode)，发现 oldEndVnode 和 newEndVnode 都是 c，然后去 patch 一下 oldEndVnode，oldEndIdx 和 newEndIdx 都向左一格。

```js
else if (sameVnode(oldEndVnode, newEndVnode)) {
  /* 旧尾和新尾都相同，patch旧节点 */
  patch(oldEndVnode, newEndVnode, container)
  oldEndVnode = prevChildren[--oldEndIdx]
  newEndVnode = nextChildren[--newEndIdx]
}
```

**循环结束，补齐或者删除多余元素**

这个时候 oldStartIdx > oldEndIdx 循环结束，此时页面上 dom 为 d，b，c，a，还有一个 e 节点没有插入，这个需要批量插入未处理好的节点，那么插入到哪里呢？找到 newEndIdx，这个游标指向的是右侧未处理的节点，它的右侧都是被处理过的元素，找到 newEndIdx+1，然后往它前面 insert。

![20200224190223-2020-2-24-19-2-24.png](http://qiniumovie.hasakei66.com/images/20200224190223-2020-2-24-19-2-24.png)

```js
/* while循环结束 */
if (oldStartIdx > oldEndIdx) {
  /* 旧vnode节点集合先被遍历完成，说明还有新节点需要加入 */
  for (; newStartIdx <= newEndIdx; newStartIdx++) {
    /* nextChildren[newEndIdx + 1] === undefined，newEndIdx在最右边，这个时候flagNode = null，默认会appendChild */
    const flagNode =
      nextChildren[newEndIdx + 1] === undefined
        ? null
        : nextChildren[newEndIdx + 1].el;
    mount(nextChildren[newStartIdx], container, flagNode);
  }
}
```

同理，如果 newStartIdx > newEndIdx 时，新的 VNode 节点已经遍历完了，但是老的节点还有剩余，说明真实 DOM 节点多余了，需要从文档中删除，这时候将这些多余的真实 DOM 删除。

```js
 else if (newStartIdx > newEndIdx) {
    /* 新vnode节点集合先被遍历完成，说明需要移除多余的节点 */
    for (; oldStartIdx <= oldEndIdx; oldStartIdx++) {
      container.removeChild(prevChildren[oldStartIdx].el)
    }
  }
```

**寻找 key 相同的节点**

在循环的过程中，首尾都检索不到，这个时候会去查 key map `oldKeyToIdx`，它是`prevChildren` key 的映射对象，看里面有没有`newStartVnode`的 key，如果找到的话，patch 一下移动它的位置去复用，找不到的话新建一个节点。

```js
/* 头尾对比完毕，开始对比key */
if (!newStartVnode.key) {
  /* newStartVnode没有key，创建新元素 */
  mount(newStartVnode, container, oldStartVnode.el);
} else {
  /*
    oldKeyToIdx: prevChildren key的映射对象
    例如[{tag: 'div', key: 'key1'}, {tag: 'div', key: 'key2'}] => {key1: 0, key2: 1}
  */
  if (!oldKeyToIdx)
    oldKeyToIdx = createKeyToOldIdx(prevChildren, oldStartIdx, oldEndIdx);

  let idxInOld = oldKeyToIdx[newStartVnode.key];
  if (!idxInOld) {
    /* newStartVnode有key，但是在旧的vnode没找着，同样创建新元素 */
    mount(newStartVnode, container, oldStartVnode.el);
  } else {
    vnodeToMove = prevChildren[idxInOld];
    if (sameVnode(vnodeToMove, newStartVnode)) {
      /* 找到可以被复用的元素 */
      patch(vnodeToMove, newStartVnode, container);
      /* 旧vnode置为undefined */
      prevChildren[idxInOld] = undefined;
      /* 移动找到的元素 */
      container.insertBefore(vnodeToMove.el, oldStartVnode.el);
    } else {
      /* 找到相同key，但是是不是用一个元素，可能tag不同等，同样创建新元素 */
      mount(newStartVnode, container, oldStartVnode.el);
    }
  }
}
```

到这里整个 patch 的过程都过了一遍，过程比较复杂的部分都集中在`patchChildren`和`updateChildren`中，`patchChildren`根据 children 的不同类型进行处理，当新旧 vnode 都是列表的时候，需要`updateChildren`去遍历比对。

写法是参考 vue 源码的 patch 部分，去除了源码中的比较细粒度的分支后，留下比较核心的流程，这应该会有助于去理解这个 diff 的过程，当你有了一个总体的认识后，再回到源码就发现一切的非常熟悉了。

---

在最后附上[👉 源码地址](https://github.com/helloforrestworld/vue-source/tree/vdom-diff)，如果觉得文章有帮助的话点个赞不过分吧！

**参考文章**

- [VirtualDOM 与 diff](<https://github.com/answershuto/learnVue/blob/master/docs/VirtualDOM与diff(Vue实现).MarkDown>)
- [虚拟 DOM 原理](https://www.cxymsg.com/guide/virtualDom.html#什么是virtual-dom)
