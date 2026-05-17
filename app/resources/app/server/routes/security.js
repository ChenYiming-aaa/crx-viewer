import { Router } from 'express';
import { join, dirname } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { scanExtensionFiles, scanJavaScript } from '../services/securityScanner.js';

const r = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE1 = join(__dirname, '..', 'store');
const STORE2 = join(__dirname, '..', '..', '..', '..', 'store');

function readStoreFiles(sessionId) {
  let dir = join(STORE1, sessionId);
  if (!existsSync(dir)) dir = join(STORE2, sessionId);
  if (!existsSync(dir)) return null;

  const files = [];
  let manifest = null;

  function walk(currentPath, relativePath) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const isText = !entry.name.match(/\.(png|jpg|jpeg|gif|ico|webp|woff|woff2|ttf|eot|wasm|crx)$/i);
        const content = isText ? readFileSync(fullPath, 'utf-8') : '[binary]';
        const size = isText ? content.length : statSync(fullPath).size;
        const file = { path: relPath, content, size };
        files.push(file);
        if (relPath === 'manifest.json' && isText) {
          try { manifest = JSON.parse(content); } catch {}
        }
      }
    }
  }
  walk(dir, '');
  return { files, manifest };
}

// Map scanner output to what the frontend expects
function mapRiskForFrontend(risk) {
  const levelMap = { high: 'High', medium: 'Medium', low: 'Low', info: 'Low', critical: 'Critical' };
  let lineNumber;
  if (risk.detail) {
    const m = risk.detail.match(/第\s*(\d+)\s*行/);
    if (m) lineNumber = parseInt(m[1]);
  }
  return {
    level: levelMap[risk.severity] || 'Low',
    description: risk.title,
    filePath: risk.file || '',
    lineNumber: lineNumber || 0,
  };
}

function generateSummary(risks, scannedFiles, manifest) {
  const high = risks.filter(r => r.severity === 'high').length;
  const medium = risks.filter(r => r.severity === 'medium').length;
  const low = risks.filter(r => r.severity === 'low').length;
  const permRisks = risks.filter(r => r.type === 'permission');
  const codeRisks = risks.filter(r => r.type === 'suspicious_code' || r.type === 'obfuscation');
  const dataRisks = risks.filter(r => r.type === 'data_exfil');
  const cspRisks = risks.filter(r => r.type === 'csp');
  const remoteRisks = risks.filter(r => r.type === 'remote_code');

  let lines = [];
  lines.push(`共扫描 ${scannedFiles} 个文件，发现 ${risks.length} 项安全风险。`);

  if (high > 0) lines.push(`其中高风险 ${high} 项、中风险 ${medium} 项、低风险 ${low} 项。`);
  else if (medium > 0) lines.push(`其中中风险 ${medium} 项、低风险 ${low} 项，无高风险问题。`);
  else lines.push(`均为低风险问题，无高风险项。`);

  if (permRisks.length > 0) {
    const highPerms = permRisks.filter(r => r.severity === 'high').map(r => r.title.replace('危险权限: ', '').replace('通配主机权限: ', ''));
    if (highPerms.length > 0) lines.push(`⚠️ 权限风险：检测到 ${highPerms.join('、')} 等高危权限。`);
    else lines.push(`权限方面：扩展申请了 ${permRisks.length} 项权限，需注意最小权限原则。`);
  }

  if (cspRisks.length > 0) {
    lines.push(`⚠️ 内容安全策略（CSP）存在 ${cspRisks.length} 项配置缺陷，可能面临 XSS 攻击风险。`);
  }

  if (remoteRisks.length > 0) {
    lines.push(`⚠️ 发现 ${remoteRisks.length} 项外部通信配置，扩展可能与外部实体交换数据。`);
  }

  if (codeRisks.length > 0) {
    const evalRisks = codeRisks.filter(r => r.title.includes('动态代码执行') || r.title.includes('动态函数构造'));
    if (evalRisks.length > 0) lines.push(`⚠️ 代码安全：使用 eval/Function 动态执行代码 ${evalRisks.length} 处，存在代码注入风险。`);
  }

  if (dataRisks.length > 0) {
    lines.push(`⚠️ 发现 ${dataRisks.length} 项数据外泄相关模式，建议审查远程请求目标。`);
  }

  const fileCounts = {};
  risks.forEach(r => { if (r.file) fileCounts[r.file] = (fileCounts[r.file] || 0) + 1; });
  const topFiles = Object.entries(fileCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topFiles.length > 0) {
    lines.push(`风险集中文件：${topFiles.map(([f, c]) => `${f}(${c}项)`).join('、')}。`);
  }

  if (risks.length === 0) {
    lines.push('✅ 未发现明显安全风险，扩展行为良好。');
  } else if (high === 0 && medium <= 3) {
    lines.push('📊 总体风险可控，建议关注中风险项。');
  } else {
    lines.push('📊 建议仔细审查高风险和中风险项，特别是权限滥用和数据外泄风险。');
  }

  return lines.join('\n');
}

function mapResultsForFrontend(result) {
  if (!result) return result;
  return {
    risks: (result.risks || []).map(mapRiskForFrontend),
    scannedFiles: result.scannedFiles || 0,
    summary: generateSummary(result.risks || [], result.scannedFiles || 0, result.manifest),
  };
}

// POST /api/security
r.post('/', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });

    const data = readStoreFiles(sessionId);
    if (!data) return res.status(404).json({ error: 'session not found' });

    const result = scanExtensionFiles(data.files, data.manifest);
    res.json(mapResultsForFrontend(result, data.manifest));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/scan-extension  (called by frontend)
r.post('/scan-extension', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'missing sessionId' });

    const data = readStoreFiles(sessionId);
    if (!data) return res.status(404).json({ error: 'session not found' });

    const result = scanExtensionFiles(data.files, data.manifest);
    res.json(mapResultsForFrontend(result, data.manifest));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/scan/file
r.post('/scan/file', async (req, res) => {
  try {
    const { sessionId, filePath } = req.body;
    if (!sessionId || !filePath) return res.status(400).json({ error: 'missing sessionId or filePath' });

    const data = readStoreFiles(sessionId);
    if (!data) return res.status(404).json({ error: 'session not found' });

    const file = data.files.find(f => f.path === filePath);
    if (!file) return res.status(404).json({ error: 'file not found' });

    const risks = scanJavaScript(file.content, filePath);
    res.json({ risks: risks.map(mapRiskForFrontend), scannedFiles: 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security/scan-directory
r.post('/scan-directory', async (req, res) => {
  try {
    const { dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ error: 'missing path' });
    if (!existsSync(dirPath)) return res.status(404).json({ error: 'path not found' });

    const { readLocalExtension } = await import('../services/crxUnpacker.js');
    const data = readLocalExtension(dirPath);
    if (!data || !data.files.length) return res.json({ risks: [], scannedFiles: 0 });

    const result = scanExtensionFiles(data.files, data.manifest);
    res.json(mapResultsForFrontend(result, data.manifest));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { r as securityRouter };
