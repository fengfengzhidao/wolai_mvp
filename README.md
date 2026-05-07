# wolai_mvp

一个围绕最小闭环构建的个人笔记 MVP。

第一版只验证：

- 创建页面
- 输入标题和块级正文
- 保存内容
- 从页面列表再次打开
- 继续编辑

当前版本采用 Vue 3 + Vite 实现，正文使用最小块级编辑器，数据保存在浏览器 `localStorage` 中。

当前块编辑只支持普通文本块：

- 回车新增下一个块
- 空块按 Backspace 删除当前块
- 自动保存块内容

## 开发命令

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```
