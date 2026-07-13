import { fetchSettings, saveSettings as dbSaveSettings } from './db';

export type SiteSettings = {
  whatsappUrl: string;
  snapchatUrl: string;
  paypalUrl: string;
  paymentText: string;
  freeShipping: boolean;
  freeShippingThreshold: number;
  standardShippingFee: number;
  expressShippingFee: number;
  announcementEnabled: boolean;
  announcementText: string;
  heroBadge: string;
  heroTitleStart: string;
  heroTitleHighlight: string;
  heroDescription: string;
  heroSubnote: string;
  heroStatValue: string;
  heroStatLabel: string;
  heroTopBadge: string;
  ctaTitle: string;
  ctaDescription: string;
};

export const SETTINGS_STORAGE_KEY = 'tof-site-settings-v2';

export const defaultSettings: SiteSettings = {
  whatsappUrl: 'https://wa.me/33744596043',
  snapchatUrl: 'https://t.snapchat.com/tofh2b',
  paypalUrl: '#',
  paymentText: 'Paiement PayPal, finalisation sur WhatsApp.',
  freeShipping: false,
  freeShippingThreshold: 140,
  standardShippingFee: 5,
  expressShippingFee: 12,
  announcementEnabled: true,
  announcementText: "🆕 Nouveau shop — -15% avec TOFLAUNCH pour les 5 premières commandes. Vérification systématique de chaque pièce. Paiement PayPal.",
  heroBadge: '🔥 Nouveau shop',
  heroTitleStart: 'Les meilleurs',
  heroTitleHighlight: 'reps 1:1',
  heroDescription: 'Sneakers et streetwear sélectionnés pièce par pièce. Chaque pièce est vérifiée sur photo QC par moi à l\'entrepôt avant expédition. Paiement PayPal protection acheteur. Livraison suivie 10-20 jours.',
  heroSubnote: 'Géré tout seul depuis Limoges — réponses rapide sur Snap & WhatsApp.',
  heroStatValue: '10-20j',
  heroStatLabel: 'livraison suivie',
  heroTopBadge: 'VÉRIFIÉ 🔍',
  ctaTitle: 'Une question ?',
  ctaDescription: 'On répond en 5min sur Snap ou WhatsApp — même pour une question bête. Ça prend 2s.',
};

// Local cache for instant reads (hydrated from Supabase)
let cached: SiteSettings = { ...defaultSettings };
let hydrated = false;

export function readSiteSettings(): SiteSettings {
  return cached;
}

export async function hydrateSiteSettings() {
  try {
    const remote = await fetchSettings();
    cached = { ...defaultSettings, ...(remote as unknown as Partial<SiteSettings>) };
    hydrated = true;
    window.dispatchEvent(new CustomEvent('tof-settings-updated'));
  } catch {
    // keep defaults
  }
}

export async function saveSiteSettings(settings: SiteSettings) {
  cached = settings;
  window.dispatchEvent(new CustomEvent('tof-settings-updated'));
  await dbSaveSettings(settings as unknown as Record<string, unknown>);
}

export function isHydrated() {
  return hydrated;
}
