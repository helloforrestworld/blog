module.exports = {
  '/views/react-guide/': [
    {
      title: '基础',
      collapsable: false,
      children: [
        'basic/form',
        'basic/jsx'
      ]
    },
    {
      title: '进阶',
      collapsable: true,
      children: [
        'advanced/hook',
        'advanced/styled-components',
        'advanced/test'
      ]
    },
    {
      title: '其他',
      collapsable: true,
      children: [
        'other/open-source'
      ]
    }
  ]
}