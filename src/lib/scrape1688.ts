// src/lib/scrape1688.ts
// Scrapes title, price in CNY, and product images from a 1688 detail page.
// Uses CORS proxies since 1688 blocks direct browser fetches.

export type ScrapedProduct = {
  title: string;
  priceCny: number | null;
  images: string[];
  source: string; // the URL we resolved to
};

// CORS proxies (tried in order — first to succeed wins).
const PROXIES = [
  // allorigins /get returns JSON { contents: "..." } — follow redirects server-side
  (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

async function fetchViaProxy(url: string, timeoutMs = 15000): Promise<string | null> {
  for (const make of PROXIES) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const proxyUrl = make(url);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      let html: string;
      if (ct.includes('application/json')) {
        const json = await res.json();
        // allorigins /get format: { contents: "html..." }
        html = json.contents || json.data || JSON.stringify(json);
      } else {
        html = await res.text();
      }
      if (html && html.length > 500) return html;
    } catch {
      clearTimeout(t);
      continue;
    }
  }
  return null;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/[-–—_|｜|].*$/, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/(阿里巴巴|1688|淘宝|Taobao|批发|厂家|直销|一件代发|跨境|专供|现货|新款|热卖|爆款)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImages(html: string): string[] {
  const urls = new Set<string>();

  // 1688 stores the main image list in window.runParams.imageComponent.images or
  // in <img src="https://cbu01.alicdn.com/img/...">. Try both.
  const cdnRe = /https?:\/\/(?:cbu01|cbu02|t001|t002|img)\.alicdn\.com\/img\/[^"'?<>\s]+/g;
  let m;
  while ((m = cdnRe.exec(html)) !== null) {
    let u = m[0];
    // Strip search params for cleanliness, keep extension
    u = u.split('?')[0];
    // Filter out tiny thumbnails / icons (common size suffixes like _.jpg, _50x50.jpg)
    if (/_\d+x\d+\./.test(u) && !/\.(?:jpg|jpeg|png|webp)$/i.test(u.replace(/_\d+x\d+/, ''))) continue;
    // Prefer "original" quality by stripping size suffixes like _310x310
    u = u.replace(/_\d+x\d+(?:q\d+|_\.jpg)?(?=\.(?:jpg|jpeg|png|webp))/i, '');
    if (!/\.(?:jpg|jpeg|png|webp)$/i.test(u)) {
      // ensure extension; default to .jpg
      u = u.replace(/\.(?:jpg|jpeg|png|webp).*/i, '') + '.jpg';
    }
    urls.add(u);
  }

  // Backup: images in data-lazy-src attributes / JSON-LD
  const lazyRe = /data-lazy-src=["'](https?:\/\/[^"']+)["']/gi;
  while ((m = lazyRe.exec(html)) !== null) {
    if (m[1].includes('alicdn.com')) urls.add(m[1].split('?')[0]);
  }

  return Array.from(urls).slice(0, 12);
}

function extractPrice(html: string): number | null {
  // Try to find a price pattern in RMB/¥. Matches things like "price":"123.45", "price": "123", ¥129, 129.00元
  const patterns = [
    /"price"\s*:\s*"?(\d{2,5}(?:\.\d{1,2})?)"?/i,
    /"priceStr"\s*:\s*"?(\d{2,5}(?:\.\d{1,2})?)"?/i,
    /"skuBaseMapPrice"\s*:\s*"?(\d{2,5}(?:\.\d{1,2})?)"?/i,
    /¥\s*(\d{2,5}(?:\.\d{1,2})?)/,
    /(\d{2,5}(?:\.\d{1,2})?)\s*元/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = parseFloat(m[1]);
      if (!isNaN(n) && n > 5 && n < 10000) return Math.round(n);
    }
  }
  return null;
}

function extractTitle(html: string): string | null {
  // Prefer og:title > <title>
  const og = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (og && og[1]) return cleanTitle(og[1]);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    let t = titleMatch[1];
    // 1688 titles end with "-1688.com" or similar
    t = t.split(/-阿里巴巴|-1688|-淘宝|-Taobao/)[0];
    return cleanTitle(t);
  }
  // h1.d-title or similar
  const h1 = html.match(/<h1[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (h1 && h1[1]) return cleanTitle(h1[1].replace(/<[^>]+>/g, ''));
  return null;
}

/**
 * Resolve a 1688 shortlink (qr.1688.com/s/xxx) to a detail.1688.com URL
 * using proxy fetches. Returns the original URL if resolution fails.
 */
async function resolveShortlink(url: string): Promise<string> {
  if (!/qr\.1688\.com|m\.tb\.cn/i.test(url)) return url;
  try {
    const html = await fetchViaProxy(url, 8000);
    if (!html) return url;
    // Look for a detail URL in HTML (meta refresh / script redirect)
    const m = html.match(/https?:\/\/detail\.1688\.com\/offer\/\d+\.html[^\s"'<]*/i) ||
              html.match(/https?:\/\/detail\.tmall\.com\/[^\s"'<]+/i) ||
              html.match(/https?:\/\/item\.taobao\.com\/[^\s"'<]+/i);
    if (m) return m[0];
  } catch {}
  return url;
}

export async function scrapeProduct(sourceUrl: string): Promise<ScrapedProduct | null> {
  const url = await resolveShortlink(extractSourceUrlSimple(sourceUrl));
  const html = await fetchViaProxy(url);
  if (!html) return null;
  const title = extractTitle(html);
  if (!title) return null;
  const priceCny = extractPrice(html);
  const images = extractImages(html);
  return { title, priceCny, images, source: url };
}

function extractSourceUrlSimple(raw: string): string {
  if (!raw) return '';
  const m = raw.match(/https?:\/\/[^\s\u4e00-\u9fff【】￥<>"]+/i);
  return m ? m[0] : raw.trim();
}

/**
 * Guesses a category preset key from a product title. Used to pre-select
 * the most likely category after scraping.
 */
export function guessCategory(title: string): string | null {
  const t = title.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/(sneaker|chaussure|basket|air force|jordan|dunk|yeezy|b30|claquette|tongs?)/i, 'Sneakers'],
    [/(sneaker|chaussure)\+bo[iî]te|shoes.*box|avec bo[iî]te/i, 'Sneakers + boîte'],
    [/hoodie|pull|sweat|crewneck|sweatshirt/i, 'Hoodie / pull'],
    [/t[-\s]?shirt|tee[-\s]?shirt|polo|chemise/i, 'T-shirt'],
    [/doudoune|puffer|veste|blouson|manteau|bomber/i, 'Veste légère'],
    [/jean|pantalon|pants?|chino/i, 'Jean / pantalon'],
    [/jogging|jogger|surv[eê]t/i, 'Jogging'],
    [/short|bermuda/i, 'Short'],
    [/maillot|bikini|swim/i, 'Maillot de bain'],
    [/robe|dress/i, 'Robe'],
    [/jupe|skirt/i, 'Jupe'],
    [/casquette|cap|hat|bonnet/i, 'Casquette'],
    [/lunettes|sunglasses/i, 'Lunettes'],
    [/sac\s|bag|backpack|sacoche|portefeuille|wallet/i, 'Sacoche'],
    [/sac à dos|backpack/i, 'Sac à dos'],
    [/ceinture|belt/i, 'Ceinture'],
    [/montre|watch/i, 'Montre'],
    [/parfum|perfume/i, 'Parfum'],
    [/bijou|bracelet|collier|boucle|ring/i, 'Bijoux'],
    [/echarpe|écharpe|scarf/i, 'Écharpe'],
    [/ensemble|set|tracksuit/i, 'Ensemble'],
  ];
  for (const [re, label] of rules) {
    if (re.test(t)) return label;
  }
  return null;
}
