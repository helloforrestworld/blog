---
title: 字符串
---

## 557.反转字符串中的单词-iii

利用split分割开单词
```js
const reverseWords = function(s) {
  return s.split(' ').map(item => {
    return item.split('').reverse().join('')
  }).join(' ')
};
```