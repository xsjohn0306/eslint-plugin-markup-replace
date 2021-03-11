# eslint-plugin-markup-replace

- 拷贝 [`eslint-plugin-php-markup`](https://github.com/tengattack/eslint-plugin-php-markup) 插件
- 添加 `php-custom-markup-regex` 配置
    - 用于配置正则表达式来替换后端模板标签
- 需要跟 [`eslint-plugin-html`](https://github.com/BenoitZugmeyer/eslint-plugin-html) 插件一起使用

## 安装

```sh
npm install --save-dev eslint-plugin-markup-replace
```

## 使用

- 添加插件 `markup-replace` 到 `.eslintrc` 文件的 `plugins` 中
- 添加配置 `php/php-custom-markup-regex`

```json
{
  "plugins": [
    "html",
    "markup-replace"
  ],
  "settings": {
    "html/html-extensions": [".html", ".tpl"],
    "php/php-extensions": [".tpl"],
    "php/php-custom-markup-regex": "(<\\?[\\s\\S]*?\\?>|{[$#].*?})"
  }
}
```

## License

MIT
