// src/lib/resolveSourceUrl.ts
// Nettoie les liens de partage 1688/Taobao/AliExpress (texte chinois + shortlink).
// Extrait simplement l'URL du texte collé. On ne résout PAS les shortlinks côté
// navigateur (CORS + 1688 bloque tous les proxys), mais le shortlink lui-même
// est parfaitement fonctionnel : qr.1688.com/s/xxx redirige bien dans le navigateur.

const URL_REGEX =
  /(https?:\/\/[^\s\u4e00-\u9fff【】￥<>"]+)|((?:qr\.1688\.com|m\.tb\.cn|b23\.tv|t\.cn|a\.m\.taobao\.com|detail\.1688\.com|detail\.tmall\.com|item\.taobao\.com|www\.aliexpress\.com|weidian\.com|mobile\.yupoo\.com|yupoo\.com)[^\s\u4e00-\u9fff【】￥<>"]*)/gi;

/**
 * Extracts the most useful URL from a pasted blob of text (typically the Chinese
 * share text from the 1688 app). Falls back to returning the raw input if no URL
 * is found.
 */
export function extractSourceUrl(raw: string): string {
  if (!raw) return '';
  const text = raw.trim();

  // If it's already a clean URL, return it as-is (strip trailing punctuation).
  if (/^https?:\/\//i.test(text) && !/[\u4e00-\u9fff]/.test(text)) {
    return text.replace(/[),.;]+$/g, '');
  }

  const matches = text.match(URL_REGEX);
  if (!matches || matches.length === 0) return text;

  // Prefer explicit http(s) URLs over protocol-less ones.
  const withProto = matches.find((m) => /^https?:\/\//i.test(m));
  let url = withProto || matches[0];

  // Add https:// if it was matched protocol-less
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  // Strip trailing punctuation (Chinese full stops, parens, commas…)
  url = url.replace(/[),.;!]+$/g, '');

  return url;
}

/**
 * Returns true if the URL is a short/redirect link (still clickable but not the
 * final product page). Only used to show a small hint in the UI.
 */
export function isShortlink(url: string): boolean {
  if (!url) return false;
  return /qr\.1688\.com|m\.tb\.cn|b23\.tv|t\.cn|a\.m\.taobao\.com/i.test(url);
}
