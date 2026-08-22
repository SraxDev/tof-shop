import { fetchSettings, saveSettings as dbSaveSettings } from './db';

export type ReviewItem = {
  id: string;
  name: string;
  city: string;
  product: string;
  text: string;
  stars: number;
};

export type FaqItem = { q: string; a: string };

export type StepItem = { emoji: string; title: string; text: string; tag: string };

export type PointItem = { emoji: string; title: string; desc: string; stat: string; statLabel: string };

export type ReviewStat = { value: string; label: string };

export type SiteSettings = {
  whatsappUrl: string;
  snapchatUrl: string;
  sumupUrl: string;
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

  // ── Contenu entièrement modifiable depuis le panel ──────────────────────
  // Badges de confiance (Hero + « comment ça marche »)
  trustBadges: string[];
  // Avis clients
  reviews: ReviewItem[];
  reviewsAutoEnabled: boolean;
  reviewStats: ReviewStat[];
  // FAQ
  faq: FaqItem[];
  // Comment ça marche
  steps: StepItem[];
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  // Pourquoi tof
  whyUsIntro: string;
  whyUsPoints: PointItem[];
  // Footer
  footerDescription: string;
  footerGuarantees: string[];
  // Marques (bandeau défilant)
  brandNames: string[];
  // Apparence
  accentColor: string;

  // ── Lancement / nouveautés ──────────────────────────────────────────────
  // Fenêtre « considéré comme nouveau » (en jours) — badge + section nouveautés
  newProductDays: number;
  // Section « Nouveautés »
  newArrivalsEnabled: boolean;
  newArrivalsTitle: string;
  newArrivalsSubtitle: string;
  newArrivalsCount: number;
  // Bannière de lancement (pleine largeur, sous le hero)
  launchBannerEnabled: boolean;
  launchBannerBadge: string;
  launchBannerTitle: string;
  launchBannerDescription: string;
  launchBannerPrice: number;
  launchBannerOldPrice: number;
  launchBannerCtaLabel: string;
  launchBannerCtaUrl: string;
  launchBannerImage: string;
  launchBannerEndsAt: string;

  // ── Réseaux sociaux & SEO ────────────────────────────────────────────────
  instagramUrl: string;
  tiktokUrl: string;
  seoTitle: string;
  seoDescription: string;

  // ── Bannière du hero (image de fond en haut de page) ─────────────────────
  // Vide = pas de bannière (le dégradé animé s'affiche). Mettre une URL
  // (Supabase Storage) ou un chemin local (/hero-banner.webp).
  heroBannerImage: string;
};

export const SETTINGS_STORAGE_KEY = 'tof-site-settings-v2';

export const defaultSettings: SiteSettings = {
  whatsappUrl: 'https://wa.me/33744596043',
  snapchatUrl: 'https://t.snapchat.com/tofh2b',
  sumupUrl: '#',
  paymentText: 'Paiement par carte sécurisé via SumUp (CB, Visa, Mastercard, Apple Pay, Google Pay).',
  freeShipping: false,
  freeShippingThreshold: 140,
  standardShippingFee: 5,
  expressShippingFee: 12,
  announcementEnabled: false,
  announcementText: "",
  heroBadge: '🔥 Nouveau shop',
  heroTitleStart: 'Les meilleurs',
  heroTitleHighlight: 'reps 1:1',
  heroDescription: 'Sneakers et streetwear sélectionnés pièce par pièce. Chaque pièce est vérifiée sur photo QC par moi à l\'entrepôt avant expédition. Paiement par carte sécurisé via SumUp. Livraison suivie 10-20 jours.',
  heroSubnote: 'Géré tout seul depuis Limoges — réponses rapides sur Snap & WhatsApp.',
  heroStatValue: '10-20j',
  heroStatLabel: 'livraison suivie',
  heroTopBadge: 'VÉRIFIÉ 🔍',
  ctaTitle: 'Une question ?',
  ctaDescription: 'On répond en 5min sur Snap ou WhatsApp — même pour une question bête. Ça prend 2s.',

  trustBadges: [
    'Vérifié avant envoi',
    'Paiement CB sécurisé SumUp',
    'Livraison suivie 10-20j',
    'Si problème, on gère',
  ],

  reviewsAutoEnabled: false,
  reviews: [
    {
      id: 'r1',
      name: 'Yanis K.',
      city: 'Lyon',
      product: 'Jordan 1 Retro High',
      text: "J'avais un peu peur au début vu que c'était ma première commande, mais le suivi était propre. Reçu en un peu moins de 2 semaines, la paire est nickel. Je recommanderai sûrement.",
      stars: 5,
    },
    {
      id: 'r2',
      name: 'Ines B.',
      city: 'Marseille',
      product: 'Sac Prada Re-Nylon',
      text: "Bonne communication sur WhatsApp, il m'a envoyé les photos avant l'envoi. Le colis a mis 13 jours. Franchement pour le prix je suis contente, juste l'emballage aurait pu être un peu mieux.",
      stars: 4,
    },
    {
      id: 'r3',
      name: 'Amine R.',
      city: 'Paris',
      product: 'Hoodie LV Monogram',
      text: "Deuxième commande chez tof. Le hoodie taille bien, matière lourde comme je voulais. Délai un peu long mais il m'avait prévenu donc pas de surprise. Service sérieux.",
      stars: 5,
    },
    {
      id: 'r4',
      name: 'Sarah M.',
      city: 'Toulouse',
      product: 'Casquette Dior',
      text: "Commande simple, il répond vite sur WhatsApp. J'ai reçu le tracking après quelques jours. La casquette est propre, rien à dire. Je mets 4 étoiles juste pour le délai.",
      stars: 4,
    },
  ],
  reviewStats: [
    { value: '4.7/5', label: 'note moyenne' },
    { value: '120+', label: 'commandes traitées' },
    { value: '24h', label: 'réponse moyenne' },
  ],

  faq: [
    {
      q: 'Comment je paie ma commande ?',
      a: "Par carte bancaire via SumUp, notre prestataire de paiement français. Après validation de ton panier, tu reçois un lien de paiement sécurisé (CB, Visa, Mastercard, Apple Pay, Google Pay) protégé par 3D Secure. Aucune donnée bancaire ne transite par le site.",
    },
    {
      q: 'Le paiement est-il sécurisé ?',
      a: "Oui. SumUp est un établissement de paiement agréé : la transaction est chiffrée et validée par 3D Secure (confirmation via ton appli bancaire). Je ne vois jamais ton numéro de carte.",
    },
    {
      q: 'Combien de temps pour recevoir ma commande ?',
      a: "Compte 2 à 5 jours pour que je commande la pièce et reçoive les photos QC, puis 10 à 20 jours ouvrés de livraison suivie (5-10 jours en Express). Tu reçois ton numéro de suivi dès l'expédition, et tu peux le consulter à tout moment dans la section Suivi.",
    },
    {
      q: 'Quelle est la qualité des pièces ?',
      a: "Ce sont des reps 1:1 haut de gamme, sélectionnées pièce par pièce. Avant chaque envoi je reçois 5-6 photos QC de l'entrepôt (coutures, logo, semelle, étiquette, boîte). Si quelque chose ne va pas, je demande un échange — tu ne reçois jamais un truc que je n'aurais pas gardé pour moi.",
    },
    {
      q: 'Comment choisir ma taille ?',
      a: "Le guide des tailles détaillé (EU / US / UK / cm pour les sneakers, S à XXL pour les vêtements) est accessible dans chaque fiche produit. En général les sneakers taillent normalement (TTS). Un doute ? Envoie-moi ta pointure habituelle sur Snap ou WhatsApp, je te réponds en ~5 min.",
    },
    {
      q: 'Le colis est-il discret ?',
      a: "Oui, emballage neutre sans mention de marque ni du contenu. Le suivi est fourni de bout en bout.",
    },
    {
      q: 'Et si la pièce ne me va pas ou arrive abîmée ?',
      a: "Écris-moi dans les 14 jours avec des photos : on trouve une solution (échange de taille, renvoi ou remboursement selon le cas). Je gère le shop tout seul, donc pas de service client robot — tu me parles directement.",
    },
    {
      q: 'Je peux commander depuis la Belgique / Suisse / DOM ?',
      a: "Oui, on livre partout en Europe et dans les DOM-TOM. Les délais peuvent être un peu plus longs (jusqu'à 25 jours) et les frais de port sont ajustés au moment du checkout.",
    },
    {
      q: 'Où en est ma commande ?',
      a: "Rends-toi dans la section « Suivi », tape ton numéro TOF-XXXX et tu vois l'avancement en direct : reçue → payée → QC validé → expédiée, avec ton numéro de tracking copiable.",
    },
  ],

  howItWorksTitle: '3 étapes, zéro surprise',
  howItWorksSubtitle: "Pas de stock, pas d'intermédiaire : chaque pièce est commandée et vérifiée pour toi.",
  steps: [
    {
      emoji: '🛒',
      title: 'Tu choisis & tu réserves',
      text: "Ajoute ta pièce au panier (taille, couleur, quantité) et remplis tes infos. Tu reçois ton numéro de commande TOF-XXXX immédiatement.",
      tag: '2 min',
    },
    {
      emoji: '💳',
      title: 'Tu paies par carte',
      text: 'Lien de paiement SumUp sécurisé (CB, Visa, Mastercard, Apple Pay, Google Pay, 3D Secure). Dès réception, je commande ta pièce et je contrôle les photos QC une par une.',
      tag: '2-5 jours',
    },
    {
      emoji: '📦',
      title: 'Tu reçois ton colis',
      text: "La pièce validée part de l'entrepôt en colis discret. Tu suis ta commande en direct avec ton numéro de tracking dans la section Suivi.",
      tag: '10-20 jours',
    },
  ],

  whyUsIntro: 'petit shop géré par une seule personne, pas de grosse équipe, pas de magasin — juste des pièces vérifiées une par une',
  whyUsPoints: [
    {
      emoji: '🔍',
      title: 'Vérification systématique',
      desc: "Chaque pièce est contrôlée sur photo QC à l'entrepôt avant de partir. Je refuse ce qui ne va pas.",
      stat: '100%',
      statLabel: 'vérifié',
    },
    {
      emoji: '💳',
      title: 'Paiement sécurisé',
      desc: 'Paiement par carte via SumUp, vérification 3D Secure. Zéro risque à commander.',
      stat: '3DS',
      statLabel: 'sécurisé',
    },
    {
      emoji: '📦',
      title: 'Livraison suivie',
      desc: 'Tracking envoyé sur Snap/WhatsApp dès expédition. Colis discret.',
      stat: '10-20j',
      statLabel: 'ouvré',
    },
    {
      emoji: '⚡',
      title: 'Réponse rapide',
      desc: "C'est moi qui gère tout seul — je réponds en 5-10min sur Snap ou WhatsApp, 7j/7.",
      stat: '~5min',
      statLabel: 'réponse',
    },
  ],

  footerDescription: 'Sneakers & streetwear sélectionnés pièce par pièce, vérifiés avant expédition.',
  footerGuarantees: [
    'Chaque pièce vérifiée par moi',
    'Paiement carte sécurisé via SumUp',
    'Livraison suivie 10-20j, colis discret',
    'Si problème, on arrange ça',
  ],

  brandNames: [
    'GUCCI', 'LOUIS VUITTON', 'PRADA', 'BALENCIAGA', 'DIOR',
    'NIKE', 'JORDAN', 'VERSACE', 'BURBERRY', 'OFF-WHITE',
    'SAINT LAURENT', 'GIVENCHY', 'STONE ISLAND', 'MONCLER', 'AMIRI',
  ],

  accentColor: '#e84d1a',

  newProductDays: 7,
  newArrivalsEnabled: true,
  newArrivalsTitle: 'nouveautés',
  newArrivalsSubtitle: 'les dernières pièces qui viennent de tomber',
  newArrivalsCount: 8,
  launchBannerEnabled: false,
  launchBannerBadge: '🔥 NOUVEAU DROP',
  launchBannerTitle: 'Le drop que tout le monde attend',
  launchBannerDescription: 'Quantités limitées, QC avant envoi, paiement CB sécurisé. Ça part vite.',
  launchBannerPrice: 0,
  launchBannerOldPrice: 0,
  launchBannerCtaLabel: 'Je le veux',
  launchBannerCtaUrl: '#shop',
  launchBannerImage: '',
  launchBannerEndsAt: '',

  instagramUrl: '',
  tiktokUrl: '',
  seoTitle: 'tof — drip authentique',
  seoDescription:
    'Sneakers & streetwear sélectionnés pièce par pièce, vérifiés avant expédition. Paiement CB sécurisé, livraison suivie.',

  // Vide par défaut : le hero utilise le dégradé animé + carrousel (recommandé).
  heroBannerImage: '',
};

// Local cache for instant reads (hydrated from Supabase)
let cached: SiteSettings = { ...defaultSettings };
let hydrated = false;

/** Éclaircit une couleur hex (#rrggbb) d'un facteur 0..1 (0 = inchangé, 1 = blanc). */
function lighten(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(mix(r))}${to(mix(g))}${to(mix(b))}`;
}

/** Applique la couleur d'accent au thème (variables CSS Tailwind v4). */
function applyAccent(color: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--color-accent', color);
  document.documentElement.style.setProperty('--color-accent-light', lighten(color, 0.25));
}

export function readSiteSettings(): SiteSettings {
  return cached;
}

export async function hydrateSiteSettings() {
  try {
    const remote = await fetchSettings();
    cached = { ...defaultSettings, ...(remote as unknown as Partial<SiteSettings>) };
    hydrated = true;
    applyAccent(cached.accentColor);
    window.dispatchEvent(new CustomEvent('tof-settings-updated'));
  } catch {
    // keep defaults
    applyAccent(cached.accentColor);
  }
}

export async function saveSiteSettings(settings: SiteSettings) {
  cached = settings;
  applyAccent(settings.accentColor);
  window.dispatchEvent(new CustomEvent('tof-settings-updated'));
  await dbSaveSettings(settings as unknown as Record<string, unknown>);
}

export function isHydrated() {
  return hydrated;
}
