import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

const DANGEROUS_PERMISSIONS = {
  high: [
    { name: '<all_urls>', desc: '访问所有网站 — 可读取任意页面数据' },
    { name: 'debugger', desc: '调试权限 — 可注入代码到任意标签页' },
    { name: 'proxy', desc: '代理控制 — 可重定向全部网络流量' },
    { name: 'nativeMessaging', desc: '原生消息 — 可执行系统命令' },
    { name: 'management', desc: '扩展管理 — 可安装/卸载其他扩展' },
    { name: 'fileSystemProvider', desc: '文件系统提供程序 — 可访问本地文件' },
    { name: 'enterprise.deviceAttributes', desc: '企业设备属性 — 可读取设备标识' },
    { name: 'certificateProvider', desc: '证书提供程序 — 可拦截 TLS 连接' },
  ],
  medium: [
    { name: 'webRequest', desc: '网络请求拦截 — 可修改响应内容或注入数据' },
    { name: 'webRequestBlocking', desc: '网络请求拦截 — 可屏蔽/修改任意请求' },
    { name: 'tabs', desc: '标签页访问 — 可读取浏览历史和标签页信息' },
    { name: 'cookies', desc: 'Cookie 访问 — 可读取/写入所有网站的 Cookie' },
    { name: 'history', desc: '历史记录访问 — 可读取/删除浏览历史' },
    { name: 'bookmarks', desc: '书签访问 — 可读取/修改书签' },
    { name: 'downloads', desc: '下载管理 — 可读取下载记录和文件' },
    { name: 'downloads.open', desc: '下载文件打开 — 可打开已下载的文件' },
    { name: 'clipboardRead', desc: '剪贴板读取 — 可读取剪贴板内容' },
    { name: 'identity', desc: '身份识别 — 可获取用户身份令牌' },
    { name: 'identity.email', desc: '邮箱信息 — 可获取用户邮箱地址' },
    { name: 'serial', desc: '串口访问 — 可读写串行设备' },
    { name: 'hid', desc: 'HID 设备访问 — 可读写人机交互设备' },
    { name: 'usb', desc: 'USB 设备访问 — 可读写 USB 设备' },
    { name: 'bluetooth', desc: '蓝牙设备访问 — 可读写蓝牙设备' },
    { name: 'desktopCapture', desc: '桌面捕获 — 可录制屏幕' },
    { name: 'tabCapture', desc: '标签页捕获 — 可录制标签页音视频' },
    { name: 'fileBrowserHandler', desc: '文件浏览器 — 可在系统中打开文件' },
    { name: 'pageCapture', desc: '页面捕获 — 可将页面保存为 MHTML' },
    { name: 'privacy', desc: '隐私设置 — 可更改浏览器隐私配置' },
    { name: 'contentSettings', desc: '内容设置 — 可更改网站权限设置' },
  ],
  low: [
    { name: 'storage', desc: '本地存储 — 可持久化存储数据' },
    { name: 'unlimitedStorage', desc: '无限存储 — 可存储大量数据（指纹追踪）' },
    { name: 'notifications', desc: '通知 — 可发送伪造的系统通知诱导点击' },
    { name: 'alarms', desc: '定时器 — 可在后台定期执行代码' },
    { name: 'geolocation', desc: '地理位置 — 可获取用户位置' },
    { name: 'contextMenus', desc: '右键菜单 — 可读取点击的页面内容' },
    { name: 'activeTab', desc: '活动标签页 — 当前标签页的临时权限' },
  ],
};

const HOST_WILDCARDS = [
  { pattern: '<all_urls>', severity: 'high', desc: '所有 URL 权限 — 可访问任意网站' },
  { pattern: '*://*/*', severity: 'high', desc: '通配 URL 权限 — 可访问任意网站' },
  { pattern: 'http://*/*', severity: 'medium', desc: '所有 HTTP 网站权限' },
  { pattern: 'https://*/*', severity: 'medium', desc: '所有 HTTPS 网站权限' },
  { pattern: 'http://*/', severity: 'medium', desc: '所有 HTTP 站点权限' },
  { pattern: 'https://*/', severity: 'medium', desc: '所有 HTTPS 站点权限' },
  { pattern: '<all_url>', severity: 'high', desc: '可能的 <all_urls> 笔误' },
];

const EXFIL_PATTERNS = [
  { regex: /navigator\.sendBeacon\s*\(/g, severity: 'medium', title: 'Beacon 数据发送', desc: '使用 sendBeacon 可能在后台向外发送数据' },
  { regex: /new\s+Image\s*\([^)]*\)/g, severity: 'low', title: '图片 Beacon', desc: '通过 Image 对象发送数据请求' },
  { regex: /XMLHttpRequest\s*\(/g, severity: 'low', title: 'XHR 请求', desc: '使用 XMLHttpRequest 发送网络请求' },
  { regex: /fetch\s*\(/g, severity: 'info', title: 'Fetch 请求', desc: '使用 Fetch API 发送网络请求' },
];

const SUSPICIOUS_PATTERNS = [
  { regex: /chrome\.runtime\.sendMessage\s*\([^)]+/g, severity: 'medium', title: '外部消息通信', desc: '向外发送 Chrome 运行时消息' },
  { regex: /chrome\.runtime\.connect\s*\([^)]+/g, severity: 'medium', title: '外部连接', desc: '建立 Chrome 运行时连接' },
  { regex: /chrome\.identity\.getAuthToken/g, severity: 'medium', title: '身份令牌获取', desc: '获取 OAuth 身份认证令牌' },
  { regex: /chrome\.identity\.getProfileUserInfo/g, severity: 'medium', title: '用户信息获取', desc: '获取用户个人信息' },
  { regex: /atob\s*\(/g, severity: 'low', title: 'Base64 解码', desc: '运行时解码 Base64 数据' },
  { regex: /eval\s*\(/g, severity: 'high', title: '动态代码执行', desc: '使用 eval 执行动态代码' },
  { regex: /Function\s*\(/g, severity: 'high', title: '动态函数构造', desc: '使用 Function 构造函数执行动态代码' },
  { regex: /document\.write\s*\(/g, severity: 'medium', title: '动态内容写入', desc: '动态写入页面内容' },
  { regex: /innerHTML\s*=/g, severity: 'low', title: 'HTML 注入', desc: '通过 innerHTML 注入 HTML' },
  { regex: /setTimeout\s*\(\s*["'`]/g, severity: 'medium', title: '动态定时器', desc: '将字符串传递给 setTimeout 执行' },
  { regex: /setInterval\s*\(\s*["'`]/g, severity: 'medium', title: '动态间隔执行', desc: '将字符串传递给 setInterval 执行' },
  { regex: /chrome\.webRequest\.onBeforeRequest/g, severity: 'high', title: '请求拦截器', desc: '拦截并分析所有网络请求' },
  { regex: /chrome\.webRequest\.onCompleted/g, severity: 'medium', title: '请求完成监听', desc: '监听所有请求完成事件' },
  { regex: /chrome\.webRequest\.onBeforeSendHeaders/g, severity: 'high', title: '请求头修改', desc: '可修改 HTTP 请求头（包括 Cookie）' },
  { regex: /chrome\.webRequest\.onHeadersReceived/g, severity: 'high', title: '响应头修改', desc: '可修改 HTTP 响应头' },
  { regex: /chrome\.tabs\.query\s*\(\s*\{/g, severity: 'medium', title: '标签页查询', desc: '可查询所有标签页信息' },
  { regex: /chrome\.tabs\.executeScript/g, severity: 'high', title: '脚本注入', desc: '可向任意标签页注入脚本' },
  { regex: /chrome\.tabs\.sendMessage/g, severity: 'low', title: '标签页通信', desc: '可向标签页发送消息' },
  { regex: /chrome\.storage\..*sync/g, severity: 'low', title: '同步存储', desc: '使用同步存储（数据可能跨设备同步）' },
  { regex: /navigator\.webdriver/g, severity: 'low', title: 'WebDriver 检测', desc: '可检测浏览器自动化状态' },
  { regex: /navigator\.languages/g, severity: 'info', title: '语言信息收集', desc: '可收集浏览器语言设置进行指纹识别' },
  { regex: /navigator\.hardwareConcurrency/g, severity: 'info', title: 'CPU 核心数收集', desc: '可收集 CPU 信息进行指纹识别' },
  { regex: /navigator\.deviceMemory/g, severity: 'info', title: '内存信息收集', desc: '可收集内存信息进行指纹识别' },
  { regex: /navigator\.platform/g, severity: 'info', title: '平台信息收集', desc: '可收集操作系统信息' },
  { regex: /screen\.(width|height|colorDepth)/g, severity: 'info', title: '屏幕信息收集', desc: '可收集屏幕分辨率进行指纹识别' },
  { regex: /canvas\S*\.toDataURL/g, severity: 'low', title: 'Canvas 指纹', desc: 'Canvas 指纹识别技术' },
  { regex: /navigator\.getBattery/g, severity: 'info', title: '电池信息收集', desc: '可收集电池状态进行指纹识别' },
];

const MINIFIED_THRESHOLD = 0.4;  // 单行超过此比例的非字母字符视为混淆

function detectObfuscation(content, filePath) {
  const risks = [];
  const lines = content.split('\n');

  // 检查单行过长
  const longLines = lines.filter(l => l.length > 2000);
  if (longLines.length > 0) {
    risks.push({
      type: 'obfuscation',
      severity: 'medium',
      title: '代码混淆',
      description: `发现 ${longLines.length} 行超长代码（>2000字符），可能经过混淆处理`,
      file: filePath,
      detail: `第 ${lines.indexOf(longLines[0]) + 1} 行 ${longLines[0].length} 字符`,
    });
  }

  // 检查非字母字符比例
  let nonAlphaCount = 0;
  for (const ch of content) {
    if (!/[a-zA-Z\s]/.test(ch)) nonAlphaCount++;
  }
  const ratio = nonAlphaCount / Math.max(content.length, 1);
  if (ratio > MINIFIED_THRESHOLD) {
    risks.push({
      type: 'obfuscation',
      severity: ratio > 0.6 ? 'high' : 'medium',
      title: ratio > 0.6 ? '高度混淆代码' : '代码压缩/混淆',
      description: `非字母字符占比 ${(ratio * 100).toFixed(1)}%，超过安全阈值`,
      file: filePath,
      detail: `总字符 ${content.length}，非字母 ${nonAlphaCount}`,
    });
  }

  // 检查 Base64 编码的长字符串
  const b64Matches = content.match(/[A-Za-z0-9+/]{100,}={0,2}/g);
  if (b64Matches && b64Matches.length > 2) {
    risks.push({
      type: 'obfuscation',
      severity: 'high',
      title: 'Base64 编码数据',
      description: `发现 ${b64Matches.length} 处疑似 Base64 编码的长字符串，可能隐藏恶意载荷`,
      file: filePath,
    });
  }

  return risks;
}

function checkManifest(manifest) {
  const risks = [];
  if (!manifest) return risks;

  const permissions = manifest.permissions || [];
  const hostPermissions = manifest.host_permissions || manifest.optional_permissions || [];
  const contentSecurity = manifest.content_security_policy;
  const externallyConnectable = manifest.externally_connectable;
  const manifestVersion = manifest.manifest_version;

  // 检查危险权限
  for (const [severity, perms] of Object.entries(DANGEROUS_PERMISSIONS)) {
    for (const perm of perms) {
      if (permissions.includes(perm.name)) {
        risks.push({
          type: 'permission',
          severity,
          title: `危险权限: ${perm.name}`,
          description: perm.desc,
          detail: `manifest.json → permissions`,
        });
      }
    }
  }

  // 检查主机权限
  for (const hp of hostPermissions) {
    for (const wp of HOST_WILDCARDS) {
      if (hp.includes(wp.pattern)) {
        risks.push({
          type: 'permission',
          severity: wp.severity,
          title: `通配主机权限: ${hp}`,
          description: wp.desc,
          detail: `manifest.json → host_permissions`,
        });
      }
    }
  }

  // 检查 host_permissions 是否匹配所有网址
  const allHostMatch = permissions.some(p =>
    p === '<all_urls>' || p === '*://*/*'
  );
  if (allHostMatch) {
    risks.push({
      type: 'permission',
      severity: 'high',
      title: '全局主机权限',
      description: '扩展可访问所有网站的数据，存在数据泄露风险',
      detail: `manifest.json → permissions`,
    });
  }

  // 检查 permissions 中的通配符
  for (const perm of permissions) {
    if (perm.includes('://') && (perm.includes('*') || perm.includes('//*'))) {
      risks.push({
        type: 'permission',
        severity: 'high',
        title: `通配 URL 权限: ${perm}`,
        description: '扩展可访问匹配模式下的所有网站',
        detail: `manifest.json → permissions`,
      });
    }
  }

  // 统计权限总数
  if (permissions.length >= 10) {
    risks.push({
      type: 'permission',
      severity: 'medium',
      title: '权限过多',
      description: `扩展申请了 ${permissions.length} 项权限，超过建议阈值（10项）`,
      detail: `manifest.json → permissions: ${permissions.join(', ')}`,
    });
  }

  // 检查 CSP
  if (contentSecurity) {
    const cspStr = typeof contentSecurity === 'string'
      ? contentSecurity
      : contentSecurity.extension_pages || '';

    if (/script-src\s+['"]unsafe-eval['"]/.test(cspStr)) {
      risks.push({
        type: 'csp',
        severity: 'high',
        title: 'CSP 允许 unsafe-eval',
        description: '内容安全策略允许 eval() 动态执行代码，增加代码注入风险',
        detail: `CSP: ${cspStr.substring(0, 200)}`,
      });
    }
    if (/script-src\s+['"]unsafe-inline['"]/.test(cspStr)) {
      risks.push({
        type: 'csp',
        severity: 'high',
        title: 'CSP 允许 unsafe-inline',
        description: '内容安全策略允许内联脚本执行',
        detail: `CSP: ${cspStr.substring(0, 200)}`,
      });
    }
    if (/script-src\s+https?:/.test(cspStr)) {
      risks.push({
        type: 'csp',
        severity: 'high',
        title: 'CSP 允许 HTTP 脚本加载',
        description: '内容安全策略允许从 HTTP 源加载脚本（可能被 MITM 攻击）',
        detail: `CSP: ${cspStr.substring(0, 200)}`,
      });
    }
  } else if (manifestVersion >= 3) {
    // MV3 默认 CSP 较严格，不触发警告
  } else {
    risks.push({
      type: 'csp',
      severity: 'medium',
      title: '缺少内容安全策略 (CSP)',
      description: '未设置 CSP，扩展页面可能面临 XSS 攻击风险',
    });
  }

  // 检查 externally_connectable
  if (externallyConnectable) {
    const matches = externallyConnectable.matches || [];
    const ids = externallyConnectable.ids || [];

    if (matches.length > 0) {
      const allStar = matches.some(m => m.includes('*'));
      risks.push({
        type: 'remote_code',
        severity: allStar ? 'high' : 'medium',
        title: '外部连接配置',
        description: allStar
          ? '允许所有外部网站与扩展通信，可能被任意网站利用'
          : `允许 ${matches.length} 个外部网站与扩展通信`,
        detail: `externally_connectable: ${matches.join(', ')}`,
      });
    }
    if (ids.includes('*')) {
      risks.push({
        type: 'remote_code',
        severity: 'high',
        title: '允许所有扩展通信',
        description: '任何扩展都可以与此扩展通信，可能被恶意利用',
        detail: 'externally_connectable.ids 包含通配符 *',
      });
    }
  }

  // 检查 background 脚本 (MV2 中 persistent background)
  const background = manifest.background;
  if (background) {
    if (background.persistent === true) {
      risks.push({
        type: 'background',
        severity: 'medium',
        title: '持久后台脚本',
        description: '后台脚本始终在运行，持续消耗内存并监听浏览器事件',
        detail: 'background.persistent: true',
      });
    }
  }

  return risks;
}

export function scanJavaScript(content, filePath) {
  const risks = [];
  if (!content || content === '[binary]') return risks;

  // 检查可疑模式
  for (const pattern of SUSPICIOUS_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      // 查找匹配的源代码行号
      const lines = content.split('\n');
      let lineNumber = -1;
      for (let i = 0; i < lines.length; i++) {
        if (pattern.regex.test(lines[i])) {
          lineNumber = i + 1;
          break;
        }
      }
      // 重置 regex 状态
      pattern.regex.lastIndex = 0;

      risks.push({
        type: 'suspicious_code',
        severity: pattern.severity,
        title: pattern.title,
        description: `${pattern.desc}（发现 ${matches.length} 处）`,
        file: filePath,
        detail: lineNumber > 0 ? `第 ${lineNumber} 行` : undefined,
      });
    }
  }

  // 检测混淆
  const obfRisks = detectObfuscation(content, filePath);
  risks.push(...obfRisks);

  return risks;
}

function checkRemoteDomains(content, filePath) {
  const risks = [];
  if (!content || content === '[binary]') return risks;

  // 扫描明显的远程 URL 模式
  const urlPatterns = [
    /https?:\/\/(?!localhost|127\.0\.0\.1|chrome\.google\.com|clients[0-9]?\.google\.com)[a-zA-Z0-9.-]+\.(com|org|net|io|app|dev|ru|cn|top|xyz)\/[^"')\s]*/g,
  ];

  for (const pattern of urlPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      const uniqueUrls = [...new Set(matches)];
      const suspiciousUrls = uniqueUrls.filter(url => {
        // 过滤掉常见的 CDN 和合法服务
        const safe = [
          'googleapis.com', 'gstatic.com', 'cloudflare.com',
          'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com',
          'github.com', 'githubusercontent.com',
        ];
        return !safe.some(s => url.includes(s));
      });

      if (suspiciousUrls.length > 3) {
        risks.push({
          type: 'data_exfil',
          severity: 'medium',
          title: '远程请求目标',
          description: `发现 ${suspiciousUrls.length} 个外部域名请求`,
          file: filePath,
          detail: suspiciousUrls.slice(0, 5).join(', ') + (suspiciousUrls.length > 5 ? `...等 ${suspiciousUrls.length} 个` : ''),
        });
      }
    }
  }

  return risks;
}

export function scanExtensionFiles(files, manifest) {
  const risks = [];

  // 1. 检查 manifest 风险
  const manifestRisks = checkManifest(manifest);
  risks.push(...manifestRisks);

  // 2. 扫描所有 JS 文件
  let scannedFiles = 0;
  for (const file of files) {
    const ext = file.path.split('.').pop().toLowerCase();
    if (!['js', 'jsx', 'ts', 'tsx', 'html', 'htm'].includes(ext)) continue;
    if (file.size === 0) continue;

    scannedFiles++;

    const jsRisks = scanJavaScript(file.content, file.path);
    risks.push(...jsRisks);

    const domainRisks = checkRemoteDomains(file.content, file.path);
    risks.push(...domainRisks);
  }

  // 3. 检查 HTML 文件
  for (const file of files) {
    const ext = file.path.split('.').pop().toLowerCase();
    if (!['html', 'htm'].includes(ext)) continue;
    if (file.size === 0) continue;

    // 检查 HTML 中的内联脚本
    if (/<script[^>]*>[\s\S]*?<\/script>/i.test(file.content)) {
      const inlineScripts = file.content.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
      for (const script of inlineScripts) {
        // 跳过外部脚本
        if (/src\s*=/.test(script)) continue;
        const body = script.replace(/<script[^>]*>/, '').replace(/<\/script>/i, '').trim();
        if (body.length > 50) {
          const scriptRisks = scanJavaScript(body, file.path);
          risks.push(...scriptRisks);
        }
      }
    }
  }

  return {
    risks,
    scannedFiles,
    totalRisks: risks.length,
  };
}
