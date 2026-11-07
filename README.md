# dsh-session-folders · 会话归位

**每个会话一个时间文件夹，产物不再堆在工作区根目录。**
**One dated folder per DSH session, so artifacts stop piling up in the workspace root.**

```
D:\AI\DSHwenjian\
├─ 26-11-07_1930\          ← 会话一
│  ├─ _会话说明.md
│  └─ ...产物
├─ 26-11-07_2015\          ← 会话二
└─ AGENTS.md
```

---

## 装

```sh
# 桌面版
dsh plugin --profile desktop add dsh-session-folders

# Web 版
dsh plugin --profile web add dsh-session-folders
```

装好后在 DSH 的插件设置里能看到 `session-folders` 一行，配置项就在那里改；不想要时把
`enabled` 关掉即可（一键关，不需要卸载）。

## 用

插件的模型侧工具叫 `session_folder`，人用的命令是 `/folder`（别名 `/sf`）：

```
/folder            # 建本会话的时间文件夹并进入，顺带写 _会话说明.md
/folder 整理工作区  # 同一个动作，标签写进会话说明
```

模型在每个会话开头会被系统提示要求先调用 `session_folder`，之后所有产物都落在返回的目录里。
目录名由插件生成（默认 `yy-MM-dd_HHmm`），不靠模型拼，所以不会拼错、不会重名。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 一键开关；关掉后不注册工具、命令与提示 |
| `root` | 空 = 会话工作区目录 | 时间文件夹建在哪；支持 `~` 和相对路径 |
| `format` | `yy-MM-dd_HHmm` | 目录名格式，支持 `yyyy yy MM dd HH mm ss` |
| `timezone` | 空 = 跟随系统 | IANA 时区，例如 `Asia/Shanghai` |
| `writeSessionNote` | `true` | 是否自动写 `_会话说明.md` |
| `collisionSuffix` | `-2` | 同分钟重名时的后缀，递增到 `-3`、`-4`… |

## 边界（先看这里再用）

- **不改会话的 `header.cwd`。** DSH 没有官方的"创建时改 cwd"接缝，所以本插件走公开的
  `workingDirectory` 服务：目录建好后会话的工作目录切过去，工具、终端、系统提示都指向它，
  但侧栏里会话仍归原来那个工作区。这是刻意的取舍——不碰非官方补丁，DSH 升级不会把插件搞坏。
- **不会移动你已有的文件。** 只建新目录、写说明；整理历史文件不在这版范围内。
- **`_会话说明.md` 只写一次。** 已存在就跳过，避免覆盖你手写的内容。
- 每次切目录会在对话里留下一条"工作目录已变更"的系统消息，这是 DSH 自身行为。

## 开发

```sh
npm install      # 只需要 @deepseek-ai/schemastery 做类型/校验
npm test         # 纯 node:test，无额外测试框架
```

```
lib/index.js    插件入口：工具、命令、系统提示段
lib/naming.js   目录名格式化与重名处理（纯函数）
lib/note.js     _会话说明.md 模板（纯函数）
test/           命名、模板、假 ctx 的接线测试
```

## License

MIT © QAQ-Eleen
