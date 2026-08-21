// Gestion dynamique des balises SEO : <title>, description, Open Graph, Twitter, canonical.
//
// Le routing est en hash (#produit/<id>), donc ces URLs ne sont pas indexées comme
// des pages séparées — MAIS ces balises servent les aperçus de partage WhatsApp,
// Snap et Instagram : c'est exactement le canal de ce shop. Une fiche produit
// partagée affichera son nom + sa photo au lieu du titre générique.
import { readSiteSettings } from './siteSettings';

type SeoInput = {
  title: string;
  description: string;
  image: string;
  url: string;
};

export const SITE_URL = 'https://tof-shop.vercel.app';

const FALLBACK_SEO = {
  title: 'tof — drip authentique',
  description:
    'Sneakers & streetwear sélectionnés pièce par pièce, vérifiés avant expédition. Paiement CB sécurisé, livraison suivie.',
} satisfies { title: string; description: string };

// Titre / description de base, pilotés depuis le panel (Réglages → Vitrine).
function baseSeo(): SeoInput {
  const s = readSiteSettings();
  return {
    title: s.seoTitle || FALLBACK_SEO.title,
    description: s.seoDescription || FALLBACK_SEO.description,
    image: `${SITE_URL}/og-image.jpg`,
    url: `${SITE_URL}/`,
  };
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function setSeo(input: Partial<SeoInput>) {
  const base = baseSeo();
  const title = input.title ?? base.title;
  const description = input.description ?? base.description;
  const image = input.image ?? base.image;
  const url = input.url ?? base.url;

  document.title = title;

  upsertMeta('name', 'description', description);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:image', image);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', image);

  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', url);
}

export function resetSeo() {
  setSeo({});
}
