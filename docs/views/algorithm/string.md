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

## 696. 计数二进制子串
```js
var countBinarySubstrings = function(s) {
  let result = 0;

  // 字符串匹配算法
  // 给定任意子输入都返回第一个符合条件的子串
  let match = (str) => {
    let j = str.match(/^(0+|1+)/)[0]
    let o = (j[0] ^ 1).toString().repeat(j.length)
    return str.startsWith(`${j}${o}`)
  }

  // 循环计算每个子串中出现符合条件的字符情况，如果找到就+1，并break到下一个子串
  for (let index = 0; index < s.length-1; index++) {
    let subString = s.slice(index)
    if (match(subString)) {
      result += 1;
    }
  }

  return result
};
```

性能比较好
```js
let countBinarySubstrings = function (s) {
  let n = 0, // 满足要求的子串的个数
      pre = 0, // 前一个字符出现的次数
      cur = 1 // 当前的字符出现的次数
  for (let i = 0, len = s.length; i < len - 1; i++) {
    if (s[i] == s[i+1]) {
      cur++
    } else {
      pre = cur
      cur = 1
    }
    // 前一个字符个数 >= 当前字符个数时，就找到一个答案
    if (pre >= cur) n++
  }
  return n
}
```