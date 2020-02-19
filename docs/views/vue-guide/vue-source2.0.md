---
title: vue2.x响应式系统
---

:::tip
[项目源码](https://github.com/helloforrestworld/vue-source)
:::

## 准备工作

**目录结构**

```
├── public
│   ├── index.html // 模版文件
├── src
│   ├── index.js // 测试页面
├── source
│   ├── vue // vue代码
├── webpack.config.js
```
**配置resolve**

让项目中```import Vue from 'vue'```指向source目录的vue。
```js
// webpack.config.js
module.exports = (env) => {
  return {
    // ...
    resolve: {
      modules: [path.resolve(__dirname, 'source'), path.resolve(__dirname, 'node_modules')]
    },
  }
}
```
