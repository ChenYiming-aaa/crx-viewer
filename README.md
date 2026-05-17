# CRX Viewer v3

Chrome / Edge 浏览器扩展安全分析工具 — 在线下载、本地扫描、安全审计、AI 摘要。

## 功能概览

### 🔍 三大入口

| 入口 | 说明 |
|------|------|
| **商店链接** | 粘贴 Chrome Web Store 或 Edge Add-ons 扩展详情页 URL，直接下载源码 |
| **扩展 ID** | 输入 32 位扩展 ID，选择 Chrome 或 Edge 商店，一键加载 |
| **本地扩展** | 自动扫描 Chrome / Edge 已安装的扩展，点击即可查看源码 |

### 🛡 安全扫描

- **权限分析** — 检测 `<all_urls>`、`debugger`、`cookies`、`webRequest` 等危险权限
- **CSP 检查** — 识别 `unsafe-eval`、`unsafe-inline`、HTTP 脚本源等配置缺陷
- **代码模式检测** — 扫描 `eval()`、`chrome.webRequest`、`sendBeacon` 等 30+ 种可疑模式
- **混淆检测** — 识别高熵字符串、Base64 编码数据、超长行
- **外部通信分析** — 检测 `externally_connectable` 通配符、远程域名请求

### 📋 AI 安全摘要

扫描完成后自动生成安全分析报告，包括：
- 风险等级统计（高/中/低）
- 权限风险概要
- 代码安全问题
- 数据外泄风险
- 风险集中文件

### 📂 源码浏览

- 文件树浏览（侧边栏可折叠）
- 代码查看器（行号、等宽字体）
- 点击安全报告中的风险项直接跳转到对应代码行
- 一键下载完整源码 ZIP

## 项目结构

```
app/
├── electron/
│   ├── main.mjs          # Electron 主进程
│   └── preload.js        # 预加载脚本
├── server/
│   ├── index.js          # Express 服务器入口
│   ├── package.json      # 服务端依赖
│   ├── routes/
│   │   ├── extensions.js # 扩展加载 API
│   │   └── security.js   # 安全扫描 API
│   └── services/
│       ├── crxDownloader.js   # CRX 下载服务
│       ├── crxUnpacker.js     # CRX 解包服务
│       ├── localScanner.js    # 本地扩展扫描
│       └── securityScanner.js # 安全分析引擎
└── client/
    └── dist/
        ├── index.html    # 入口页面
        ├── app.css       # 样式表（深色主题）
        └── app.js        # 前端 SPA 逻辑
```

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Electron 33 |
| 后端 | Node.js + Express |
| 前端 | Vanilla JS（无框架，无构建步骤） |
| 样式 | CSS 自定义变量，深色主题 |
| 字体 | Inter + JetBrains Mono（Google Fonts） |

## 快速开始

### 环境要求

- Node.js >= 18
- npm

### 安装

```bash
# 安装 Electron 依赖
cd app
npm install

# 安装服务端依赖
cd app/resources/app/server
npm install
```

### 运行

```bash
# 方式一：Electron 桌面应用
cd app
npx electron resources/app/electron/main.mjs

# 方式二：仅启动 Web 服务（浏览器访问 http://localhost:3001）
cd app/resources/app/server
node index.js
```

### 从源码构建 Electron 打包版

```bash
cd app
npx electron-builder --win --x64
# 输出在 dist/ 目录
```

## API 参考

### 扩展接口 `/api/extensions`

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/from-url` | 从商店 URL 加载 | `{ url, proxy? }` |
| POST | `/from-id` | 从扩展 ID 加载 | `{ id, store?, proxy? }` |
| GET | `/local` | 列出本地已安装扩展 | — |
| POST | `/from-local` | 加载本地扩展 | `{ path }` |
| GET | `/:sid/file` | 获取文件内容 | query: `path` |
| GET | `/:sid/manifest` | 获取 manifest.json | — |
| GET | `/:sid/download` | 下载完整源码 ZIP | — |

### 安全接口 `/api/security`

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/scan-extension` | 安全扫描扩展 | `{ sessionId }` |
| POST | `/scan/file` | 扫描单个文件 | `{ sessionId, filePath }` |
| POST | `/scan-directory` | 扫描目录 | `{ dirPath }` |

### 响应格式

`/scan-extension` 返回：

```json
{
  "risks": [
    {
      "level": "High",
      "description": "危险权限: debugger",
      "filePath": "manifest.json",
      "lineNumber": 0
    }
  ],
  "scannedFiles": 18,
  "summary": "共扫描 18 个文件，发现 31 项安全风险..."
}
```

## 安全扫描规则

### 权限风险等级

| 等级 | 权限示例 |
|------|----------|
| **高** | `<all_urls>`, `debugger`, `proxy`, `nativeMessaging`, `management` |
| **中** | `webRequest`, `tabs`, `cookies`, `history`, `downloads`, `identity` |
| **低** | `storage`, `notifications`, `alarms`, `contextMenus` |

### 代码模式检测

检测 `chrome.*` API 调用、`eval()`/`Function()` 动态执行、`sendBeacon` 数据外泄、Canvas 指纹、`atob` Base64 解码等 30+ 种模式。

### 混淆评分

- 单行超过 2000 字符 → 中风险
- 非字母字符占比超过 60% → 高风险
- 超过 2 处 Base64 长字符串 → 高风险

## 网络说明

- **Chrome Web Store** 下载需要代理（国内网络限制），在首页底部设置代理地址
- **Edge Add-ons** 通常可直接下载，无需代理
- 代理格式：`http://127.0.0.1:7890`

## License

MIT
