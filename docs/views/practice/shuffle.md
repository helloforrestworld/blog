---
title: 随机打乱数组
---

## 生成min - max 的随机整数

```js
function getRomdomInt(min, max) { // 生成min - max 的随机整数
  return Math.floor(Math.random() * (max - min + 1) + min);
};
```

## 随机打乱数组
```js
 function shuffle(arr) { // 随机打乱数组
  let _arr = arr.slice();
  for (let i = 0; i < _arr.length; i++) {
    let randomI = getRomdomInt(0, i);
    [_arr[i], _arr[randomI]] = [_arr[randomI], _arr[i]];
  };
  return _arr;
};
```