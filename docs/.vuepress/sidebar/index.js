module.exports = {
  '/views/react-guide/': [
    {
      title: '实战',
      collapsable: false,
      children: [
        '组件逻辑复用',
        '组织css',
        '状态管理',
        '路由管理',
        '脚手架搭建',
        '项目目录设计'
      ]
    },
    {
      title: '进阶',
      collapsable: false,
      children: [
        'fiber架构',
        'hooks实战'
      ]
    }
  ],
  '/views/notes/': [
    {
      title: 'JS基础',
      collapsable: true,
      children: [
        'debounceNThrottle',
        'shuffle',
        'copy'
      ]
    }
  ],
  '/views/algorithm/': [
    {
      title: '基础部分',
      collapsable: false,
      children: [
        'string'
      ]
    }
  ],
  '/views/webpack/': [
    {
      title: 'Webpack笔记',
      collapsable: true,
      children: [
        'concept',
        'basic',
        'env',
        'hmr',
        'optimization',
        'build-speed',
        'multiple-build'
      ]
    },
    {
      title: 'Webpack实战',
      collapsable: true,
      children: [
        'bundler'
      ]
    }
  ],
  '/views/vue-guide/': [
    {
      title: '基础',
      collapsable: false,
      children: [
      ]
    },
    {
      title: '进阶',
      collapsable: false,
      children: [
        'vue-source2.0',
      ]
    }
  ],
}