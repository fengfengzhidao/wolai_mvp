# wolai_mvp

一个围绕最小闭环构建的个人笔记 MVP。

第一版只验证：

- 创建页面
- 输入标题和块级正文
- 保存内容
- 从页面列表再次打开
- 继续编辑

当前版本采用 Vue 3 + Vite 实现，正文使用最小块级编辑器，默认通过 Go + Gin 后端保存到 MySQL。仍可通过 `VITE_NOTES_STORAGE=local` 切回浏览器 `localStorage`。

当前块编辑支持：

- 回车新增下一个块
- 空块按 Backspace 删除当前块
- 自动保存块内容
- `# ` 转一级标题
- `## ` 转二级标题
- `- ` 转无序列表
- `1. ` 转有序列表
- `[] ` 或 `[ ] ` 转待办块
- 输入 `/` 打开块类型菜单
- 菜单支持上下键选择、Enter 确认、Esc 关闭

## 开发命令

```bash
npm install
npm run dev:backend
npm run dev
```

后端默认配置：

- API 地址：`http://127.0.0.1:8080`
- MySQL：`127.0.0.1:3306`
- 用户名 / 密码：`root` / `root`
- 数据库：`wolai_mvp`

可通过环境变量覆盖：`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`PORT`。

## 构建

```bash
npm run build
```
