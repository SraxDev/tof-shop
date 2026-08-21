// Gestion dynamique des balises SEO : <title>, description, Open Graph, Twitter, canonical.
//
// Le routing est en hash (#produit/<id>), donc ces URLs ne sont pas indexées comme
// des pages séparées — MAIS ces balises servent les aperçus de partage WhatsApp,
// Snap et Instagram : c'est exactement le canal de ce shop. Une fiche produit
// partagée affichera son nom + sa photo au lieu du titre générique.

type SeoInput = {
  title: string;
  description: string;
  image?: string;
  url?: string;
};

export const SITE_URL = 'https://tof-shop.vercel.app';

export const DEFAULT_SEO = {
  title: 'tof — drip authentique',
  description:
    'Sneakers & streetwear sélectionnés pièce par pièce, vérifiés avant expédition. Paiement CB sécurisé, livraison suivie.',
  image: `${SITE_URL}/og-image.jpg`,
  url: `${SITE_URL}/`,
} satisfies SeoInput;

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
  const title = input.title ?? DEFAULT_SEO.title;
  const description = input.description ?? DEFAULT_SEO.description;
  const image = input.image ?? DEFAULT_SEO.image;
  const url = input.url ?? DEFAULT_SEO.url;

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
