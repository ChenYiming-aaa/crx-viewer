export async function downloadCrx(id, store, proxy) {
  const axios = (await import('axios')).default;
  const isEdge = store === 'edge';

  const urls = isEdge
    ? [
        `https://edge.microsoft.com/extensionwebstorebase/v1/crx?response=redirect&prodversion=130.0.0.0&x=id%3D${id}%26installsource%3Dondemand%26uc`,
        `https://edge.microsoft.com/extensionwebstorebase/v1/crx?response=redirect&prodversion=120.0.0.0&x=id%3D${id}%26installsource%3Dondemand%26uc`,
        `https://edge.microsoft.com/extensionwebstorebase/v1/crx/${id}`,
      ]
    : [
        `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx3&x=id%3D${id}%26installsource%3Dondemand%26uc`,
        `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=108.0&acceptformat=crx2,crx3&x=id%3D${id}%26installsource%3Dondemand%26uc`,
      ];

  const opts = { responseType: 'arraybuffer', timeout: 30000 };
  opts.headers = { 'User-Agent': isEdge ? 'Microsoft Edge/130.0.0.0' : 'Mozilla/5.0' };
  if (proxy) {
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    const { HttpProxyAgent } = await import('http-proxy-agent');
    opts.httpsAgent = new HttpsProxyAgent(proxy);
    opts.httpAgent = new HttpProxyAgent(proxy);
  }

  let lastErr = '';
  for (let i = 0; i < urls.length; i++) {
    try {
      const r = await axios.get(urls[i], opts);
      if (r.status === 200 && r.data && r.data.length > 100) return Buffer.from(r.data);
    } catch (e) {
      lastErr = e.message;
      if (i < urls.length - 1) continue;
    }
  }

  if (!proxy && !isEdge) throw new Error('Chrome 扩展下载需要配置代理，请在页面底部点击"代理设置"填写代理地址');
  if (lastErr.includes('502') || lastErr.includes('503')) throw new Error('商店暂时不可用，请稍后重试');
  if (lastErr.includes('404')) throw new Error('扩展不存在，请检查 ID 是否正确');
  throw new Error('下载失败，请检查网络连接' + (isEdge ? '' : '或配置代理'));
}

export function extractIdFromUrl(url) {
  // Edge: microsoftedge.microsoft.com/addons/detail/{name}/{id}
  const e = url.match(/edge\.microsoft\.com\/addons\/detail\/([^/]+)\/([a-z]{32})/i);
  if (e) return { id: e[2], store: 'edge' };
  // Chrome: chromewebstore.google.com/detail/{name}/{id}
  const c = url.match(/\/detail\/[^/]+\/([a-z]{32})/);
  if (c) return { id: c[1], store: 'chrome' };
  // Raw 32-char ID
  const d = url.match(/[a-z]{32}/);
  if (d) return { id: d[0], store: 'chrome' };
  throw new Error('无法从输入中提取扩展 ID');
}
