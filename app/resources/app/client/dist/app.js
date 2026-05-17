// CRX Viewer v3 — Single Page Application
const API = '/api/extensions';
const SEC = '/api/security';

// ============ STATE ============
const state = {
  view: 'home',         // home | url | id | local | workspace
  session: null,        // sessionId
  fileTree: null,       // file tree object
  selectedFile: null,   // current file path
  fileContent: '',      // current file content
  extInfo: null,        // { name, version, id, store, fileCount }
  secResults: null,     // security scan results
  showSecurity: false,  // panel expanded
  scanning: false,
  proxy: localStorage.getItem('crx-proxy') || '',
  expandedGroups: {},   // which risk groups are expanded
  loading: false,
};

// ============ TOAST ============
let toastTimer;
function toast(msg, type = 'info') {
  const existing = $('.crx-toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);
  const colors = { success: 'var(--green)', error: 'var(--red)', info: 'var(--accent)' };
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const t = el('div', {
    className: 'crx-toast',
    style: {
      position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)', zIndex: 999,
      background: 'var(--bg2)', border: '1px solid ' + (colors[type] || colors.info),
      color: '#fff', padding: '10px 20px', borderRadius: 'var(--radius)',
      fontSize: '13px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: '8px',
      animation: 'crx-toast-in 0.25s ease',
    },
  }, (icons[type] || icons.info) + ' ' + msg);
  document.body.appendChild(t);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ============ DOM HELPERS ============
const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];
const el = (tag, attrs, ...children) => {
  const e = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') e.className = v;
    else if (k === 'innerHTML') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (typeof v === 'boolean') { if (v) e.setAttribute(k, ''); else e.removeAttribute(k); }
    else e.setAttribute(k, v);
  });
  children.forEach(c => { if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
};

// ============ API ============
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  if (!r.ok) {
    let err = '请求失败';
    try { err = (await r.json()).error || err; } catch {}
    throw new Error(err);
  }
  return r.json();
}
const post = (p, b) => api('POST', p, b);
const get = (p) => api('GET', p);

function fetchFromUrl(url) { return post(API + '/from-url', { url, proxy: state.proxy }); }
function fetchFromId(id, store) { return post(API + '/from-id', { id, store: store || 'chrome', proxy: state.proxy }); }
function fetchFromLocal(path) { return post(API + '/from-local', { path }); }
function fetchLocalList() { return get(API + '/local'); }
function fetchFile(sid, path) { return get(API + '/' + encodeURIComponent(sid) + '/file?path=' + encodeURIComponent(path)); }
function scanExtension(sid) { return post(SEC + '/scan-extension', { sessionId: sid }); }

// ============ RENDER ============
function render() {
  const root = $('#root');
  root.innerHTML = '';
  root.className = '';

  if (state.view === 'home') renderHome(root);
  else if (state.view === 'url') renderSection(root, 'url');
  else if (state.view === 'id') renderSection(root, 'id');
  else if (state.view === 'local') renderSection(root, 'local');
  else if (state.view === 'workspace') renderWorkspace(root);

  if (state.loading) {
    const overlay = el('div', { className: 'loading-overlay' },
      el('span', { className: 'spinner' }), '加载中...');
    root.appendChild(overlay);
  }
}

// ============ HOME ============
function renderHome(root) {
  root.className = 'home';

  const cards = [
    { id: 'url', icon: '🌐', title: '商店链接', desc: '粘贴 Chrome / Edge 扩展商店链接，直接加载源码', cls: 'url' },
    { id: 'id', icon: '🔑', title: '扩展 ID', desc: '输入 32 位扩展 ID，从商店下载源代码', cls: 'id' },
    { id: 'local', icon: '📂', title: '本地扩展', desc: '扫描已安装在 Chrome / Edge 中的扩展', cls: 'local' },
  ];

  root.append(
    el('div', { className: 'home-hero' },
      el('span', { className: 'home-badge' }, '扩展源码分析工具 v3'),
      el('h1', { className: 'home-title' }, 'CRX Viewer'),
      el('p', { className: 'home-subtitle' }, 'Chrome / Edge 扩展安全审计 · 源代码查看'),
      el('p', { className: 'home-desc' }, '在线下载 · 本地扫描 · 安全分析 · AI 摘要'),
    ),
    el('div', { className: 'home-cards' }, ...cards.map(c =>
      el('div', { className: 'home-card', onClick: () => { state.view = c.id; render(); } },
        el('div', { className: 'home-card-icon ' + c.cls }, c.icon),
        el('div', { className: 'home-card-title' }, c.title),
        el('div', { className: 'home-card-desc' }, c.desc),
      )
    )),
    el('div', { className: 'home-proxy' },
      '代理',
      el('input', {
        type: 'text', placeholder: 'http://127.0.0.1:7890', value: state.proxy,
        onInput: (e) => { state.proxy = e.target.value; localStorage.setItem('crx-proxy', state.proxy); },
      }),
    ),
  );
}

// ============ SECTION (URL / ID / Local) ============
function renderSection(root, mode) {
  root.className = 'section';
  const backBtn = el('button', { className: 'section-back', onClick: () => { state.view = 'home'; render(); } }, '← 返回');

  const configs = {
    url: { icon: '🌐', title: '商店链接', desc: '粘贴 Chrome Web Store 或 Edge Add-ons 扩展链接' },
    id: { icon: '🔑', title: '扩展 ID', desc: '输入 32 位扩展 ID 直接下载源码' },
    local: { icon: '📂', title: '本地扩展', desc: '扫描 Chrome / Edge 已安装的扩展' },
  };
  const cfg = configs[mode];

  const container = el('div', {},
    el('div', { className: 'section-header' },
      el('div', { className: 'section-icon' }, cfg.icon),
      el('div', { className: 'section-title' }, cfg.title),
      el('div', { className: 'section-desc' }, cfg.desc),
    ),
  );

  if (mode === 'url') {
    let input;
    const form = el('form', { className: 'section-form', onSubmit: (e) => { e.preventDefault(); loadFromUrl(input.value); } },
      input = el('input', { type: 'text', placeholder: 'https://chromewebstore.google.com/detail/...' }),
      el('button', { className: 'btn-primary', type: 'submit' }, '查看源码'),
    );
    container.appendChild(form);
  } else if (mode === 'id') {
    let input, store;
    const form = el('form', { className: 'section-form', onSubmit: (e) => { e.preventDefault(); loadFromId(input.value, store.value); } },
      input = el('input', { type: 'text', placeholder: '32位扩展ID', maxLength: '64' }),
      store = el('select', {}, el('option', { value: 'chrome' }, 'Chrome'), el('option', { value: 'edge' }, 'Edge')),
      el('button', { className: 'btn-primary', type: 'submit' }, '查看源码'),
    );
    container.appendChild(form);
  } else if (mode === 'local') {
    const scanBtn = el('button', { className: 'btn-scan-local', onClick: scanLocal }, '🔄 扫描本地扩展');
    const list = el('div', { className: 'local-list' });
    container.appendChild(scanBtn);
    container.appendChild(list);
    // Auto-scan on open
    scanLocal(list);
  }

  root.append(backBtn, container);
}

async function loadFromUrl(url) {
  if (state.loading) return;
  state.loading = true; render();
  try {
    const d = await fetchFromUrl(url.trim());
    enterWorkspace(d);
    toast('加载成功 — ' + (d.name || 'Unknown'));
  } catch (e) { toast(e.message, 'error'); }
  state.loading = false; render();
}

async function loadFromId(id, store) {
  if (state.loading) return;
  state.loading = true; render();
  try {
    const d = await fetchFromId(id.trim(), store);
    enterWorkspace(d);
    toast('加载成功 — ' + (d.name || id));
  } catch (e) { toast(e.message, 'error'); }
  state.loading = false; render();
}

async function scanLocal(listEl) {
  try {
    const { extensions } = await fetchLocalList();
    if (!listEl) return extensions;
    listEl.innerHTML = '';
    if (!extensions.length) {
      listEl.append(el('p', { style: { textAlign: 'center', color: 'var(--fg3)', padding: '20px' } }, '未找到已安装的扩展'));
      return;
    }
    extensions.forEach(ext => {
      const item = el('div', { className: 'local-item', onClick: () => loadFromLocal(ext.path) },
        el('div', { className: 'local-item-name' }, ext.name, el('span', { className: 'local-item-badge' }, ext.browser)),
        el('div', { className: 'local-item-meta' }, 'v' + ext.version + ' · ' + (ext.id || '').slice(0, 16)),
      );
      listEl.appendChild(item);
    });
  } catch (e) { console.error(e); }
}

async function loadFromLocal(path) {
  if (state.loading) return;
  state.loading = true; render();
  try {
    const d = await fetchFromLocal(path);
    enterWorkspace({ ...d, localPath: path });
    toast('加载成功 — ' + (d.name || '本地扩展'));
  } catch (e) { toast(e.message, 'error'); }
  state.loading = false; render();
}

// ============ WORKSPACE ============
function enterWorkspace(data) {
  state.session = data.sessionId;
  state.fileTree = data.fileTree;
  state.extInfo = {
    name: data.name || data.id || 'Unknown',
    version: data.version,
    id: data.id,
    store: data.store,
    fileCount: data.fileCount,
  };
  state.selectedFile = null;
  state.fileContent = '';
  state.secResults = null;
  state.showSecurity = false;
  state.expandedGroups = {};
  state.view = 'workspace';
  render();
}

function renderWorkspace(root) {
  root.className = 'workspace';
  const { extInfo, selectedFile, fileContent, secResults, showSecurity, scanning } = state;

  // Header
  const header = el('div', { className: 'header' },
    el('div', { className: 'header-brand' },
      el('div', { className: 'header-logo' }, 'C'),
      el('span', { className: 'header-title' }, 'CRX Viewer'),
      extInfo && el('span', { className: 'header-ext-name' }, extInfo.name),
      extInfo && extInfo.version && el('span', { className: 'header-ext-version' }, 'v' + extInfo.version),
    ),
    el('div', { className: 'header-actions' },
      el('button', {
        className: 'btn btn-security' + (scanning ? ' scanning' : '') + (secResults ? ' has-results' : ''),
        onClick: handleScan,
        disabled: scanning,
      }, ...(scanning ? [el('span', { className: 'spinner' }), ' 扫描中...'] : secResults ? ['📋 查看报告'] : ['🔍 安全扫描'])),
      extInfo && extInfo.localPath ? el('button', {
        className: 'btn-download', onClick: () => { toast('本地扩展路径：' + extInfo.localPath, 'info'); },
        title: extInfo.localPath,
      }, '📁 本地位置') : state.session && el('a', {
        className: 'btn-download', href: API + '/' + encodeURIComponent(state.session) + '/download',
        download: true, onClick: () => setTimeout(() => toast('ZIP 下载中...', 'info'), 10),
      }, '⬇ 下载 ZIP'),
      el('button', { className: 'btn', onClick: () => { state.view = 'home'; state.session = null; render(); } }, '✕'),
    ),
  );

  // Sidebar
  const sidebar = el('div', { className: 'sidebar' },
    el('div', { className: 'sidebar-header' },
      'EXPLORER',
      el('button', { className: 'sidebar-toggle', onClick: toggleSidebar }, '◀'),
    ),
    el('div', { className: 'sidebar-tree' }, ...renderFileTree(state.fileTree)),
  );

  // Viewer
  const viewer = el('div', { className: 'viewer' });
  if (selectedFile) {
    viewer.append(
      el('div', { className: 'viewer-header' }, el('span', {}, selectedFile)),
      el('div', { className: 'viewer-content' }, renderCode(fileContent)),
    );
  } else {
    viewer.append(el('div', { className: 'viewer-placeholder' }, extInfo ? '选择一个文件查看源码' : ''));
  }

  // Body
  const body = el('div', { className: 'workspace-body' }, sidebar, viewer);

  // Security panel
  const secPanel = renderSecurityPanel(secResults, scanning);
  secPanel.classList.add(showSecurity ? 'expanded' : 'collapsed');

  root.append(header, body, secPanel);
}

// ============ FILE TREE ============
function renderFileTree(tree, prefix = '') {
  if (!tree) return [];
  const items = [];
  for (const [name, node] of Object.entries(tree)) {
    if (node.__file) {
      const fullPath = node.path || name;
      // Calculate indent based on path depth
      const depth = (fullPath.match(/\//g) || []).length;
      const indent = depth * 16;
      const icon = getFileIcon(name);
      const active = state.selectedFile === fullPath;

      // Dir indicator
      const segs = fullPath.split('/');
      let displayPath = fullPath;
      if (depth > 0) {
        displayPath = segs[segs.length - 1];
      }

      const item = el('div', {
        className: 'tree-item' + (active ? ' active' : ''),
        style: { paddingLeft: (12 + indent) + 'px' },
        onClick: () => selectFile(fullPath),
        title: fullPath,
      },
      el('span', { className: 'tree-icon' }, icon),
      displayPath,
      );
      items.push(item);
    } else {
      // Directory
      const depth = (prefix + name).split('/').filter(Boolean).length;
      const indent = depth * 16;

      const dirIcon = el('span', { className: 'tree-icon', style: { fontSize: '10px' } }, '📁 ');
      const dirName = name + '/';

      items.push(el('div', {
        className: 'tree-item dir',
        style: { paddingLeft: (12 + indent) + 'px', fontWeight: 600 },
      }, dirIcon, el('span', { style: { color: 'var(--accent)' } }, dirName)));

      // Recursively render children
      for (const [cn, cnv] of Object.entries(node)) {
        if (cn === '__file') continue;
        const childItems = renderFileTree({ [cn]: cnv }, prefix + name + '/');
        items.push(...childItems);
      }

      // Also include __file entries in directory
      if (node.__file) {
        const fp = node.path || prefix + name;
        const active = state.selectedFile === fp;
        items.push(el('div', {
          className: 'tree-item' + (active ? ' active' : ''),
          style: { paddingLeft: (12 + indent + 16) + 'px' },
          onClick: () => selectFile(fp),
        }, el('span', { className: 'tree-icon' }, getFileIcon(name)), name));
      }
    }
  }
  return items;
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = { js: '📜', jsx: '📜', ts: '📜', tsx: '📜', html: '🌐', htm: '🌐', css: '🎨', json: '📋', md: '📝', png: '🖼', jpg: '🖼', svg: '🖼', ico: '🖼', gitignore: '⚙', lock: '🔒' };
  return icons[ext] || '📄';
}

async function selectFile(path) {
  state.selectedFile = path;
  state.fileContent = '';
  render();
  try {
    const d = await fetchFile(state.session, path);
    state.fileContent = d.content || '';
  } catch (e) {
    state.fileContent = '// 无法加载文件: ' + e.message;
  }
  render();
}

function renderCode(content) {
  if (!content) return el('div', { className: 'viewer-placeholder' }, '空文件');
  const pre = el('pre');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const span = el('span', { className: 'line' });
    span.textContent = line || ' ';
    pre.appendChild(span);
  });
  return pre;
}

function toggleSidebar() {
  const sidebar = $('.sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
}

// ============ SECURITY SCAN ============
async function handleScan() {
  if (!state.session || state.scanning) return;
  state.scanning = true;
  state.showSecurity = true;
  render();
  try {
    const results = await scanExtension(state.session);
    state.secResults = results;
  } catch (e) {
    state.secResults = { error: e.message, risks: [], scannedFiles: 0, summary: '' };
  }
  state.scanning = false;
  render();
}

function renderSecurityPanel(results, scanning) {
  const panel = el('div', { className: 'security-panel' });
  if (!results && !scanning) return panel;

  const risks = results?.risks || [];
  const summary = results?.summary || '';
  const scannedFiles = results?.scannedFiles || 0;

  // Counts
  const counts = { High: 0, Medium: 0, Low: 0 };
  risks.forEach(r => { if (counts[r.level] !== undefined) counts[r.level]++; });

  const label = scanning
    ? el('span', { className: 'spinner' }) + ' 安全扫描中...'
    : '安全扫描结果';

  const badges = [
    { key: 'High', label: '高', cls: 'sev-high' },
    { key: 'Medium', label: '中', cls: 'sev-medium' },
    { key: 'Low', label: '低', cls: 'sev-low' },
  ];

  const bar = el('div', { className: 'security-bar', onClick: () => { state.showSecurity = !state.showSecurity; render(); } },
    el('div', { className: 'security-label' },
      el('span', { innerHTML: typeof label === 'string' ? label : '' }),
    ),
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      el('div', { className: 'security-badges' }, ...badges.map(b =>
        el('span', { className: 'severity-badge ' + b.cls }, b.label + ' ' + counts[b.key]),
      )),
      el('span', { className: 'chevron' + (state.showSecurity ? ' open' : '') }, '▾'),
    ),
  );

  // Fix label for scanning state
  if (scanning) bar.querySelector('.security-label').innerHTML = '<span class="spinner"></span> 安全扫描中...';

  panel.appendChild(bar);

  if (state.showSecurity && results && !scanning) {
    // AI Summary
    if (summary) {
      const s = el('div', { className: 'ai-summary' },
        el('div', { className: 'ai-summary-label' }, '📋 AI 安全分析'),
        summary,
      );
      panel.appendChild(s);
    }

    // Collapse/expand all
    const actions = el('div', { className: 'sec-actions', style: { padding: '0 16px 4px' } },
      el('button', { className: 'sec-btn', onClick: () => collapseAll(panel, true) }, '收起全部'),
      el('button', { className: 'sec-btn', onClick: () => collapseAll(panel, false) }, '展开全部'),
    );
    panel.appendChild(actions);

    // Risk groups
    const groups = el('div', { className: 'risk-groups' });
    badges.forEach(b => {
      const groupRisks = risks.filter(r => r.level === b.key);
      if (!groupRisks.length) return;

      const groupId = b.key;
      const expanded = state.expandedGroups[groupId] === true;

      const header = el('div', {
        className: 'risk-group-header',
        onClick: () => { state.expandedGroups[groupId] = !expanded; render(); },
      },
      el('span', { style: { color: b.key === 'High' ? 'var(--red)' : b.key === 'Medium' ? 'var(--accent)' : 'var(--green)' } }, b.label + '风险'),
        el('span', { className: 'count' }, groupRisks.length + ' 项'),
      );

      const items = el('div', { className: 'risk-group-items' });
      if (expanded) {
        groupRisks.forEach(r => {
          const hasFile = r.filePath && r.filePath.trim();
          const item = el('div', {
            className: 'risk-item' + (hasFile ? ' has-file' : ''),
            onClick: hasFile ? () => { state.selectedFile = r.filePath; selectFile(r.filePath); render(); } : undefined,
            title: hasFile ? '点击跳转到 ' + r.filePath + ':' + (r.lineNumber || 0) : '',
          },
          el('div', { className: 'risk-item-desc' }, r.description),
            el('div', { className: 'risk-item-loc' }, hasFile ? r.filePath + ':' + r.lineNumber : 'manifest.json'),
          );
          items.appendChild(item);
        });
      }

      const group = el('div', { className: 'risk-group' }, header, items);
      groups.appendChild(group);
    });

    panel.appendChild(groups);
    panel.appendChild(el('div', { style: { padding: '8px 16px', fontSize: '11px', color: 'var(--fg3)', borderTop: '1px solid var(--bd)' } }, '共扫描 ' + scannedFiles + ' 个文件，发现 ' + risks.length + ' 项风险'));
  }

  return panel;
}

function collapseAll(panel, collapsed) {
  Object.keys(state.expandedGroups).forEach(k => { state.expandedGroups[k] = !collapsed; });
  // Also set for groups not yet in expandedGroups
  ['High', 'Medium', 'Low'].forEach(k => { state.expandedGroups[k] = !collapsed; });
  render();
}

// ============ INIT ============
render();
console.log('CRX Viewer v3 ready');
