# CRX Viewer

<p align="right">
  <a href="#chinese">中文</a> | <a href="#english">English</a>
</p>

<a id="chinese"></a>

> Chrome/Edge 浏览器扩展安全分析工具 — 在线下载、本地扫描、安全审计、AI 摘要

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)
![license](https://img.shields.io/badge/license-MIT-blue)
![last commit](https://img.shields.io/github/last-commit/ChenYiming-aaa/crx-viewer)
![languages](https://img.shields.io/github/languages/count/ChenYiming-aaa/crx-viewer)

## 功能特性

- **多入口加载** — 支持商店 URL、扩展 ID、本地已安装扩展三种方式加载扩展源码
- **安全扫描** — 权限分析、CSP 检查、30+ 种可疑代码模式检测、混淆识别、外部通信审计
- **AI 安全摘要** — 自动生成风险报告，包含风险等级统计、问题分类和文件级钻取
- **源码浏览器** — 树形文件导航、语法高亮代码查看器、风险项点击跳转、一键 ZIP 下载

## 快速开始

### 前置要求

- Node.js >= 18
- npm

### 安装并运行（桌面应用）

```bash
cd app/resources/app
npm install
npx electron electron/main.mjs
```

### 仅启动 Web 服务

```bash
cd app/resources/app/server
npm install
node index.js
# 浏览器打开 http://localhost:3001
```

### 构建安装包

```bash
cd app/resources/app
npm run build:client
npx electron-builder --win --x64
# 输出在 dist/ 目录
```

## 使用指南

### 从商店 URL 加载

粘贴 Chrome Web Store 或 Edge Add-ons 扩展详情页 URL，或使用 API：

```bash
curl -X POST http://localhost:3001/api/extensions/from-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://chromewebstore.google.com/detail/..."}'
```

### 通过扩展 ID 加载

```bash
curl -X POST http://localhost:3001/api/extensions/from-id \
  -H "Content-Type: application/json" \
  -d '{"id": "abcdefghijklmnop", "store": "chrome"}'
```

### 扫描本地扩展

列出已安装扩展：

```bash
curl http://localhost:3001/api/extensions/local
```

加载并扫描：

```bash
curl -X POST http://localhost:3001/api/extensions/from-local \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/extension"}'
```

### 安全扫描

```bash
curl -X POST http://localhost:3001/api/security/scan-extension \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "<session-id>"}'
```

## 安全扫描规则

### 权限风险等级

| 等级 | 权限示例 |
|------|----------|
| **高** | `<all_urls>`, `debugger`, `proxy`, `nativeMessaging`, `management` |
| **中** | `webRequest`, `tabs`, `cookies`, `history`, `downloads`, `identity` |
| **低** | `storage`, `notifications`, `alarms`, `contextMenus` |

### 代码模式检测

检测 `chrome.*` API 调用、`eval()`/`Function()` 动态执行、`sendBeacon` 数据外泄、Canvas 指纹、Base64 解码等 30+ 种模式。

### 混淆评分

- 单行超过 2000 字符 → 中风险
- 非字母字符占比超过 60% → 高风险
- 超过 2 处 Base64 长字符串 → 高风险

## API 参考

### 扩展接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/extensions/from-url` | 从商店 URL 加载 |
| POST | `/api/extensions/from-id` | 从扩展 ID 加载 |
| GET | `/api/extensions/local` | 列出本地扩展 |
| POST | `/api/extensions/from-local` | 加载本地扩展 |
| GET | `/:sid/file` | 获取文件内容 |
| GET | `/:sid/manifest` | 获取 manifest.json |
| GET | `/:sid/download` | 下载源码 ZIP |

### 安全接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/security/scan-extension` | 全量安全扫描 |
| POST | `/api/security/scan/file` | 扫描单个文件 |
| POST | `/api/security/scan-directory` | 扫描本地目录 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Electron 33 |
| 后端 | Node.js + Express |
| 前端 | Vanilla JS（无框架，无构建步骤） |
| 样式 | CSS 变量，深色主题 |

## 项目结构

```
crx-viewer/
├── app/
│   └── resources/app/
│       ├── electron/
│       │   ├── main.mjs       # Electron 主进程
│       │   └── preload.js     # 预加载脚本
│       ├── server/
│       │   ├── index.js       # Express 服务器入口
│       │   ├── routes/        # API 路由
│       │   └── services/      # 核心服务
│       ├── client/
│       │   └── dist/          # 前端构建产物
│       └── package.json
└── db/                        # 数据库文件
```

## 网络说明

- **Chrome Web Store** 下载可能需要代理，在首页底部设置代理地址
- **Edge Add-ons** 通常可直接下载
- 代理格式：`http://127.0.0.1:7890`

## 贡献指南

欢迎贡献代码！请提交 Issue 或 Pull Request。

## 许可证

MIT。详见 [LICENSE](LICENSE) 文件。

---

<a id="english"></a>
# CRX Viewer

> Chrome/Edge extension security analysis tool with download, inspection, scanning, and AI reporting

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)
![license](https://img.shields.io/badge/license-MIT-blue)
![last commit](https://img.shields.io/github/last-commit/ChenYiming-aaa/crx-viewer)
![languages](https://img.shields.io/github/languages/count/ChenYiming-aaa/crx-viewer)

## Features

- **Multi-Entry Loading** — Load extensions via Chrome Web Store URL, extension ID, or scan locally installed extensions
- **Security Scanning** — Permission analysis, CSP checks, 30+ suspicious code patterns, obfuscation detection, and external communication audit
- **AI Security Summary** — Auto-generated risk reports with severity levels, risk classification, and file-level drill-down
- **Source Code Browser** — Tree-based file navigation, syntax-highlighted code viewer, click-to-jump from risk items, and one-click ZIP download

## Quick Start

### Prerequisites

- Node.js >= 18
- npm

### Install & Run (Desktop App)

```bash
cd app/resources/app
npm install
npx electron electron/main.mjs
```

### Run (Web-Only Mode)

```bash
cd app/resources/app/server
npm install
node index.js
# Open http://localhost:3001
```

### Build Installer

```bash
cd app/resources/app
npm run build:client
npx electron-builder --win --x64
# Output in dist/
```

## Usage

### Load from Store URL

Paste a Chrome Web Store or Edge Add-ons extension page URL into the app, or use the API:

```bash
curl -X POST http://localhost:3001/api/extensions/from-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://chromewebstore.google.com/detail/..."}'
```

### Load by Extension ID

```bash
curl -X POST http://localhost:3001/api/extensions/from-id \
  -H "Content-Type: application/json" \
  -d '{"id": "abcdefghijklmnop", "store": "chrome"}'
```

### Scan Local Extensions

List installed extensions:

```bash
curl http://localhost:3001/api/extensions/local
```

Load and scan:

```bash
curl -X POST http://localhost:3001/api/extensions/from-local \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/extension"}'
```

### Run Security Scan

```bash
curl -X POST http://localhost:3001/api/security/scan-extension \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "<session-id>"}'
```

## Security Scan Rules

### Permission Risk Levels

| Level | Examples |
|-------|----------|
| **High** | `<all_urls>`, `debugger`, `proxy`, `nativeMessaging`, `management` |
| **Medium** | `webRequest`, `tabs`, `cookies`, `history`, `downloads`, `identity` |
| **Low** | `storage`, `notifications`, `alarms`, `contextMenus` |

### Code Pattern Detection

Detects 30+ patterns including `chrome.*` API calls, dynamic execution (`eval()`/`Function()`), data exfiltration (`sendBeacon`), Canvas fingerprinting, and Base64 decoding.

### Obfuscation Scoring

- Line > 2000 chars → Medium
- Non-alphabetic ratio > 60% → High
- More than 2 Base64 long strings → High

## API Reference

### Extensions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/extensions/from-url` | Load from store URL |
| POST | `/api/extensions/from-id` | Load by extension ID |
| GET | `/api/extensions/local` | List local extensions |
| POST | `/api/extensions/from-local` | Load local extension |
| GET | `/:sid/file` | Get file content |
| GET | `/:sid/manifest` | Get manifest.json |
| GET | `/:sid/download` | Download source ZIP |

### Security

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/security/scan-extension` | Full security scan |
| POST | `/api/security/scan/file` | Scan single file |
| POST | `/api/security/scan-directory` | Scan local directory |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Shell | Electron 33 |
| Backend | Node.js + Express |
| Frontend | Vanilla JS (no framework, no build step) |
| Styling | CSS custom properties, dark theme |

## Project Structure

```
crx-viewer/
├── app/
│   └── resources/app/
│       ├── electron/
│       │   ├── main.mjs       # Electron main process
│       │   └── preload.js     # Preload script
│       ├── server/
│       │   ├── index.js       # Express server entry
│       │   ├── routes/        # API routes
│       │   └── services/      # Core services
│       ├── client/
│       │   └── dist/          # Built frontend
│       └── package.json
└── db/                        # Database files
```

## Network Notes

- **Chrome Web Store** downloads may require a proxy in some regions. Set proxy address at the bottom of the app's home page.
- **Edge Add-ons** usually works without a proxy.
- Proxy format: `http://127.0.0.1:7890`

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## License

MIT. See [LICENSE](LICENSE) for details.