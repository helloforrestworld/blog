---
title: '多页应用打包'
---

:::tip
[本章配置代码](https://github.com/helloforrestworld/webpack-stuff/tree/multiple-page/guide)
:::

多页面配置需要写在```webpack.common.js```，思路非常简单。

- 配置多个入口文件。
- ```html-webpack-plugin```根据入口文件生成多个html文件。
- 手动配置每个html需要依赖的chunk。

```js
// webpack.common.js
const entry = {
  index: './src/index.js',
  list: './src/list.js'
}

const plugins = [
  new CleanWebpackPlugin(),
]

Object.keys(entry).forEach(key => {
  plugins.push(new HtmlWebpackPlugin({
    template: path.resolve(__dirname, '../public/index.html'),
    filename: `${key}.html`,
    chunks: ['vendors', 'common', key]
  }))
})

module.exports = {
  entry,
  plugins
  // ...
}
```

chunks里面的vendors和common对应splitChunks的配置，存放多个页面的公共第三方模块。

这样多个页面之间既有自己独立的html和入口，也有公共模块。

```js
// webpack.prod.js
module.exports = {
  // ...
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 30000,
      maxSize: 0,
      minChunks: 1,
      maxAsyncRequests: 5,
      maxInitialRequests: 3,
      automaticNameDelimiter: '~',
      name: true,
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          name: 'vendors'
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
          name: 'common'
        }
      }
    }
  },
}
```
