# Changelog

## 0.1.1

- 修复：`session_folder` 的工具结果读取失败（`content.some is not a function`）——`render` 现在返回内容块数组，而不是裸对象。
- 新增测试：校验 `render` 的输出形状。

## 0.1.0

- 首版：`session_folder` 工具、`/folder` 与 `/sf` 命令、双语系统提示注入。
- 目录名默认 `yy-MM-dd_HHmm`，同分钟重名自动加 `-2`。
- workspace 的 `_会话说明.md` 自动生成。
- 配置：`enabled`、`root`、`format`、`timezone`、`writeSessionNote`、`collisionSuffix`。
