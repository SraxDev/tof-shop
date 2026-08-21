/**
 * Connaissance métier du bot tof.
 *
 * Le moteur de `bot.ts` ne savait répondre qu'avec des textes figés : il ne
 * connaissait ni le catalogue, ni les prix, ni les commandes. Résultat, dès
 * qu'un client posait une vraie question ("vous avez du LV ?", "où est ma
 * commande TOF-3148 ?"), il fallait que tu répondes toi-même.
 *
 * Ce module lui donne accès aux données réelles :
 *   • recherche produit par marque / catégorie / budget
 *   • suivi de commande par numéro (via la RPC publique track_order)
 *   • disponibilité des tailles (y compris les tailles épuisées)
 *
 * Tout passe par les fonctions déjà sécurisées par RLS : le bot ne peut pas
 * exposer plus d'informations qu'un visiteur n'en voit déjà sur le site.
 */

import { fetchProducts, fetchOrderById, type DbProduct } from './db';
import { readCart } from './cart';
import { expand, fuzzyIncludes } from './botNlp';
import { readRecentlyViewed } from './recentlyViewed';

// ─── Cache catalogue ─────────────────────────────────────
// Évite de retélécharger les produits à chaque message.

let cache: DbProduct[] | null = null;
let cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function getCatalog(): Promise<DbProduct[]> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL) return cache;
  try {
    const data = await fetchProducts();
    cache = data.filter((p) => p.status === 'active');
    cacheAt = now;
    return cache;
  } catch {
    return cache || [];
  }
}

// ─── Outils texte ────────────────────────────────────────

function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatPrice(n: number): string {
  return `${Math.round(n)} €`;
}

/** Tailles réellement disponibles ("41:0" = épuisée). */
export function availableSizes(sizes?: string): string[] {
  return (sizes || '')
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .filter((raw) => {
      const [, stock] = raw.split(':');
      if (stock === undefined || stock.trim() === '') return true;
      const n = Number(stock.trim());
      return Number.isNaN(n) ? true : n > 0;
    })
    .map((raw) => raw.split(':')[0].trim());
}

export function soldOutSizes(sizes?: string): string[] {
  return (sizes || '')
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .filter((raw) => {
      const [, stock] = raw.split(':');
      if (stock === undefined || stock.trim() === '') return false;
      const n = Number(stock.trim());
      return !Number.isNaN(n) && n <= 0;
    })
    .map((raw) => raw.split(':')[0].trim());
}

// ─── Recherche produit ───────────────────────────────────

/** Marques distinctes du catalogue, orthographe nettoyée. */
export async function listBrands(): Promise<string[]> {
  const items = await getCatalog();
  const seen = new Map<string, string>();
  for (const p of items) {
    const key = normalize(p.brand);
    if (key && !seen.has(key)) seen.set(key, p.brand.trim());
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'fr'));
}

export type ProductMatch = {
  product: DbProduct;
  score: number;
};

/**
 * Cherche des produits à partir d'une phrase libre.
 * Comprend : marque, catégorie, et contrainte de budget ("moins de 80 euros").
 */
export async function searchProducts(query: string, limit = 4): Promise<DbProduct[]> {
  const items = await getCatalog();
  // `expand` corrige le SMS et les fautes ("snekers" -> "sneakers")
  const q = expand(query);
  if (!q) return [];

  // Budget : "moins de 80", "sous 100e", "max 90 euros"
  let maxPrice: number | null = null;
  const budget = q.match(/(?:moins de|sous|max|maximum|jusqu a|budget de?)\s*(\d{2,4})/);
  if (budget) maxPrice = Number(budget[1]);

  const words = q.split(' ').filter((w) => w.length >= 3);

  const scored: ProductMatch[] = [];
  for (const p of items) {
    if (maxPrice !== null && p.sale_price > maxPrice) continue;

    const brand = normalize(p.brand);
    const name = normalize(p.name);
    const cat = normalize(p.category);
    let score = 0;

    // Marque citée = signal le plus fort
    if (brand && q.includes(brand)) score += 10;
    // Abréviations courantes
    if (/\blv\b/.test(q) && brand.includes('louis vuitton')) score += 10;
    if (/\bcp\b/.test(q) && brand.includes('cp company')) score += 8;

    if (cat && q.includes(cat)) score += 8;
    else if (cat && fuzzyIncludes(q, cat)) score += 6;

    for (const w of words) {
      if (brand.includes(w)) score += 3;
      if (name.includes(w)) score += 2;
      if (cat.includes(w)) score += 2;
    }

    // Synonymes de catégorie fréquents chez les clients
    const synonyms: Record<string, string[]> = {
      sneakers: ['basket', 'baskets', 'chaussure', 'chaussures', 'paire', 'sneaker', 'running'],
      't-shirt': ['tshirt', 't shirt', 'tee', 'haut'],
      casquette: ['cap', 'casquettes'],
      claquettes: ['claquette', 'slides', 'sandale'],
      short: ['shorts', 'bermuda'],
      'sac a main': ['sac', 'sacoche', 'pochette'],
      sacoche: ['sac', 'pochette', 'banane'],
      'maillot de bain': ['maillot', 'bain', 'plage'],
      'jean / pantalon': ['jean', 'pantalon', 'denim'],
      chemise: ['chemises'],
      'veste legere': ['veste', 'blouson', 'manteau'],
    };
    for (const [catKey, syns] of Object.entries(synonyms)) {
      if (cat.includes(normalize(catKey))
          && syns.some((sy) => q.includes(sy) || fuzzyIncludes(q, sy))) score += 7;
    }

    if (score > 0 || (maxPrice !== null && score === 0 && words.length <= 2)) {
      scored.push({ product: p, score: score || 1 });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.product.sale_price - b.product.sale_price);
  return scored.slice(0, limit).map((m) => m.product);
}

/** Met en forme une liste de produits pour le chat. */
export function formatProductList(items: DbProduct[]): string {
  return items
    .map((p) => {
      const sizes = availableSizes(p.sizes);
      const sizeInfo = sizes.length > 0 ? ` · tailles ${sizes.slice(0, 6).join(', ')}` : '';
      return `• ${p.brand} ${p.name} — ${formatPrice(p.sale_price)}${sizeInfo}`;
    })
    .join('\n');
}

// ─── Suivi de commande ───────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: 'reçue, en cours de préparation',
  to_order: 'validée, on la commande auprès du fournisseur',
  ordered: 'commandée auprès du fournisseur',
  shipped: 'expédiée',
  done: 'livrée',
  cancelled: 'annulée',
};

/** Détecte un numéro de commande dans une phrase ("tof 3148", "TOF-3148"). */
export function extractOrderId(text: string): string | null {
  const m = (text || '').toUpperCase().match(/TOF[\s-]?(\d{3,6})/);
  return m ? `TOF-${m[1]}` : null;
}

export async function trackOrderSummary(orderId: string): Promise<string | null> {
  try {
    const order = await fetchOrderById(orderId);
    if (!order) return null;

    const status = STATUS_LABELS[order.status] || order.status;
    const lines = [`📦 Commande ${order.id} : **${status}**.`];

    if (order.payment_status !== 'paid') {
      lines.push('⚠️ Le paiement n\'a pas encore été reçu — ta commande partira dès réception.');
    }
    if (order.tracking) {
      lines.push(`Numéro de suivi : ${order.tracking}`);
    } else if (order.status !== 'done') {
      lines.push('Le numéro de suivi arrive dès que le colis part.');
    }
    if (order.city_hint) {
      lines.push(`Livraison vers ${order.city_hint}.`);
    }
    lines.push('Tu peux suivre ça à tout moment sur la page Suivi.');
    return lines.join('\n');
  } catch {
    return null;
  }
}


// ─── Contexte visiteur ───────────────────────────────────

/**
 * Le bot doit savoir ce que le client a sous les yeux : ce qu'il a dans son
 * panier, la pièce qu'il vient de consulter. Sans ça il répond dans le vide.
 */
export type VisitorContext = {
  cart: { brand: string; name: string; size: string; quantity: number; salePrice: number }[];
  cartTotal: number;
  lastViewed?: DbProduct;
};

export async function readVisitorContext(): Promise<VisitorContext> {
  // On réutilise les modules officiels : pas de clé localStorage recopiée à
  // la main, qui se désynchroniserait au prochain changement de version.
  const cart = readCart().map((i) => ({
    brand: i.brand, name: i.name, size: i.size,
    quantity: i.quantity, salePrice: i.salePrice,
  }));

  const cartTotal = cart.reduce((sum, i) => sum + (i.salePrice || 0) * (i.quantity || 1), 0);

  let lastViewed: DbProduct | undefined;
  try {
    const ids = readRecentlyViewed();
    if (ids.length > 0) {
      const catalog = await getCatalog();
      lastViewed = catalog.find((p) => p.id === ids[0]);
    }
  } catch { /* ignore */ }

  return { cart, cartTotal, lastViewed };
}

// ─── Disponibilité humaine ───────────────────────────────

/**
 * Sait-on si Tof est probablement joignable ?
 * Évite de promettre "réponse en 5 min" à 4h du matin — une promesse non
 * tenue coûte plus cher qu'une attente annoncée.
 */
export function humanAvailability(): { open: boolean; label: string } {
  const now = new Date();
  const h = now.getHours();
  if (h >= 9 && h < 23) {
    return { open: true, label: 'Tof répond en général en moins de 5 min à cette heure-ci.' };
  }
  if (h >= 23 || h < 7) {
    return { open: false, label: 'Il est tard — Tof répondra dès demain matin, mais laisse ton message, il le verra en priorité.' };
  }
  return { open: false, label: 'Tof est sûrement encore en train de dormir 😴 — laisse ton message, il répond dès le réveil.' };
}
