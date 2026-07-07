import { fetchSettings, saveSettings as dbSaveSettings } from './db';

export type SiteSettings = {
  whatsappUrl: string;
  snapchatUrl: string;
  paypalUrl: string;
  paymentText: string;
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

export const SETTINGS_STORAGE_KEY = 'tof-site-settings-v1';

export const defaultSettings: SiteSettings = {
  whatsappUrl: 'https://wa.me/33744596043',
  snapchatUrl: 'https://t.snapchat.com/tofh2b',
  paypalUrl: '#',
  paymentText: 'Paiement PayPal, finalisation sur WhatsApp.',
  announcementEnabled: true,
  announcementText: "Livraison offerte dès 150€ d'achat — Paiement PayPal, finalisation WhatsApp",
  heroBadge: '🔥 Drops chaque semaine',
  heroTitleStart: 'Ton style,',
  heroTitleHighlight: 'ta vibe',
  heroDescription: 'Gucci, Prada, LV, Balenciaga... Les plus grandes marques au meilleur prix, livre chez toi.',
  heroSubnote: 'Tu commandes sur le site, tu finalises sur WhatsApp.',
  heroStatValue: '+200 pièces',
  heroStatLabel: 'cette semaine',
  heroTopBadge: 'NEW DROP',
  ctaTitle: 'Reste dans la boucle',
  ctaDescription: 'Ajoute-nous sur Snap et WhatsApp pour etre alerte des nouveaux drops avant tout le monde.',
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
