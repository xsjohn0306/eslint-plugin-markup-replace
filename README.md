# eslint-plugin-markup-replace

复制了 [`eslint-plugin-php-markup`](https://github.com/tengattack/eslint-plugin-php-markup) 插件
开放php-custom-markup-regex配置, 用于配置正则表达式来替换后端模板标签

需要跟 [`eslint-plugin-html`](https://github.com/BenoitZugmeyer/eslint-plugin-html) 插件一起使用

## 安装

```sh
npm install --save-dev eslint-plugin-markup-replace
```

## 使用

添加 `markup-replace` 到 `.eslintrc` 文件的 `plugins` 配置中

```js
{
  // ...
  "plugins": [
    "html",
    "markup-replace"
  ],
  "settings": {
    'html/html-extensions': ['.html', '.tpl'],
    'php/php-extensions': ['.tpl'],
    'php/php-custom-markup-regex': '(<\\?[\\s\\S]*?\\?>|{[$#].*?})'
  },
  // ...
}
```

License

MIT
