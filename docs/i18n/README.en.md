# CRX Viewer

<p align="right">
  <a href="../../README.md">中文</a> | <a href="README.en.md">English</a>
</p>

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