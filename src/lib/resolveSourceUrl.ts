// src/lib/resolveSourceUrl.ts
// Nettoie les liens source Mulebuy collés dans l'admin.
// Extrait l'URL d'un blob de texte (partage Mulebuy, etc.). Les liens
// Mulebuy sont la seule source officielle (mulebuy.com/product?id=...).

const URL_REGEX =
  /(https?:\/\/[^\s\u4e00-\u9fff【】￥<>"]+)|((?:mulebuy\.com)[^\s\u4e00-\u9fff【】￥<>"]*)/gi;

/**
 * Extrait l'URL Mulebuy d'un texte collé. Retourne le texte brut si aucune URL
 * n'est trouvée.
 */
export function extractSourceUrl(raw: string): string {
  if (!raw) return '';
  const text = raw.trim();

  if (/^https?:\/\//i.test(text) && !/[\u4e00-\u9fff]/.test(text)) {
    return text.replace(/[),.;]+$/g, '');
  }

  const matches = text.match(URL_REGEX);
  if (!matches || matches.length === 0) return text;

  const withProto = matches.find((m) => /^https?:\/\//i.test(m));
  let url = withProto || matches[0];

  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  url = url.replace(/[),.;!&]+$/g, '');

  return url;
}

/**
 * Plus de shortlinks : les URLs Mulebuy sont des liens directs produits.
 * Gardée pour la compatibilité d'appel mais retourne toujours false.
 */
export function isShortlink(_url: string): boolean {
  return false;
}
