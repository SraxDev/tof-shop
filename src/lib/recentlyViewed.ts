const KEY = 'tof-recently-viewed-v1';
const MAX = 12;

export function readRecentlyViewed(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(productId: string) {
  if (!productId) return;
  try {
    const next = [productId, ...readRecentlyViewed().filter((id) => id !== productId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('tof-recently-viewed-updated'));
  } catch {
    /* ignore */
  }
}

export function clearRecentlyViewed() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent('tof-recently-viewed-updated'));
  } catch {
    /* ignore */
  }
}
