// src/lib/resolveSourceUrl.ts
// Nettoie les liens de partage 1688/Taobao/AliExpress (texte chinois + shortlink)
// et résout les redirections pour obtenir l'URL finale detail.1688.com/offer/xxx.html

const SOURCE_URL_REGEX =
  /(https?:\/\/[^\s\u4e00-\u9fff【】￥<>"]+)|((?:qr\.1688\.com|m\.tb\.cn|b23\.tv|t\.cn|a\.m\.taobao\.com|detail\.1688\.com|detail\.tmall\.com|item\.taobao\.com|www\.aliexpress\.com|weidian\.com)[^\s\u4e00-\u9fff【】￥<>"]*)/gi;

const SHORTLINK_DOMAINS = [
  'qr.1688.com',
  'm.tb.cn',
  'b23.tv',
  't.cn',
  'a.m.taobao.com',
];

const PROXY_LIST = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
];

export function extractSourceUrl(raw: string): string {
  if (!raw) return '';
  const text = raw.trim();
  // if it's already a clean direct URL, just return it
  const looksLikeUrl = /^https?:\/\//i.test(text);
  if (looksLikeUrl && !SHORTLINK_DOMAINS.some((d) => text.includes(`://${d}`) || text.includes(`.${d}`))) {
    return text;
  }

  // Otherwise extract any URL present in the pasted share text
  const matches = text.match(SOURCE_URL_REGEX);
  if (!matches || matches.length === 0) return text; // give up, return raw
  // Prefer shortlinks (more likely to be the real target), fall back to first URL
  const short = matches.find((m) => SHORTLINK_DOMAINS.some((d) => m.includes(d)));
  const url = short || matches[0];
  return url.startsWith('http') ? url : `https://${url}`;
}

export function isShortlink(url: string): boolean {
  if (!url) return false;
  return SHORTLINK_DOMAINS.some((d) => url.includes(`://${d}`) || url.includes(`.${d}`));
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual', // we want to read Location header ourselves
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function resolveShortlink(rawUrl: string): Promise<string> {
  const cleaned = extractSourceUrl(rawUrl);
  if (!cleaned) return rawUrl;
  if (!isShortlink(cleaned)) return cleaned;

  // Try direct first (won't work in browser due to CORS usually, but in case it works)
  try {
    const direct = await fetchWithTimeout(cleaned);
    if (direct && (direct.status === 301 || direct.status === 302 || direct.status === 303 || direct.status === 307 || direct.status === 308)) {
      const loc = direct.headers.get('location');
      if (loc) return loc.startsWith('http') ? loc : new URL(loc, cleaned).toString();
    }
  } catch {}

  // Try CORS proxies one by one
  for (const makeProxy of PROXY_LIST) {
    try {
      const proxyUrl = makeProxy(cleaned);
      const res = await fetchWithTimeout(proxyUrl, 10000);
      if (!res) continue;
      // allorigins returns the raw content body. We try reading `Content-Location` or the final URL,
      // but since allorigins follows redirects, response.url is typically the final URL.
      const finalUrl = res.url || '';
      // Some proxies return their own URL even after following — fallback: search body for detail.1688.com URL
      if (finalUrl && !isShortlink(finalUrl) && /^https?:/.test(finalUrl)) {
        return finalUrl;
      }
      // As a last resort, peek into body for a detail.1688.com URL
      try {
        const html = await res.text();
        const m = html.match(/https?:\/\/detail\.1688\.com\/offer\/\d+\.html[^\s"'<>]*/i);
        if (m) return m[0];
        const m2 = html.match(/https?:\/\/(?:item\.taobao|detail\.tmall)\.com[^\s"'<>]*/i);
        if (m2) return m2[0];
      } catch {}
    } catch {
      continue;
    }
  }

  return cleaned; // fallback: return the extracted shortlink at least
}
