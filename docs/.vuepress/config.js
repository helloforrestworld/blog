const nav = require('./nav')
const sidebar = require('./sidebar')

module.exports = {
  title: "老农爱盐碱地",
  description: "寻找范式、刻意练习、及时反馈、垂直打透、横向迁移、深度复盘。",
  dest: "public",
  head: [
    [
      "link",
      {
        rel: "icon",
        href: "/idea.png"
      }
    ],
    [
      "meta",
      {
        name: "viewport",
        content: "width=device-width,initial-scale=1,user-scalable=no"
      }
    ]
  ],
  theme: "reco",
  themeConfig: {
    nav,
    sidebar,
    type: "blog",
    blogConfig: {
      category: {
        location: 2,
        text: "目录"
      },
      tag: {
        location: 3,
        text: "标签"
      }
    },
    valineConfig: {
      appId: 'P5DHVQeM0wHBOvjeMDnDA6wL-9Nh9j0Va',
      appKey: '1SrDlXl0Lxnngu8XinKttQch',
      placeholder: '填写邮箱可以收到回复提醒哦！',
      recordIP: true
    },
    sidebarDepth: 2,
    logo: "/idea.png",
    search: true,
    searchMaxSuggestions: 10,
    sidebarDepth: 2,
    lastUpdated: "Last Updated",
    author: "helloforrestworld",
    authorAvatar: "/idea.png",
    startYear: "2017"
  },
  markdown: {
    lineNumbers: true
  }
}