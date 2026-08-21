// Génère public/sitemap.xml : les sections principales + une entrée par produit.
// À relancer après chaque ajout de produit (ou automatiser dans un cron).
//
// Usage :
//   VITE_SUPABASE_URL=https://xxxx.supabase.co \
//   VITE_SUPABASE_ANON_KEY=eyJ... \
//   node scripts/generate-sitemap.mjs
//
// Options (env) :
//   SITE_URL   — base du site (défaut https://tof-shop.vercel.app)

import { writeFileSync } from 'node:fs';

const SITE = process.env.SITE_URL || 'https://tof-shop.vercel.app';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const SECTIONS = [
  { loc: `${SITE}/`, priority: '1.0', changefreq: 'daily' },
  { loc: `${SITE}/#shop`, priority: '0.9', changefreq: 'daily' },
  { loc: `${SITE}/#drop`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${SITE}/#comment-ca-marche`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${SITE}/#faq`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${SITE}/#apropos`, priority: '0.5', changefreq: 'monthly' },
  { loc: `${SITE}/#contact`, priority: '0.5', changefreq: 'monthly' },
  { loc: `${SITE}/#suivi`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${SITE}/#cgv`, priority: '0.3', changefreq: 'yearly' },
  { loc: `${SITE}/#mentions-legales`, priority: '0.3', changefreq: 'yearly' },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function fetchProducts() {
  if (!supabaseUrl || !anonKey) {
    console.warn('⚠️  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY non définis : sitemap sans produits.');
    return [];
  }
  const url = `${supabaseUrl}/rest/v1/products?select=id,name&status=eq.active&order=created_at.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!res.ok) {
    console.error('Erreur Supabase :', res.status, await res.text());
    return [];
  }
  return (await res.json()) || [];
}

function build(products) {
  const productEntries = products
    .map((p) => ({
      loc: `${SITE}/#produit/${encodeURIComponent(p.id)}`,
      priority: '0.7',
      changefreq: 'weekly',
    }))
    .map(
      (u) => `  <url>
    <loc>${esc(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join('\n');

  const sectionEntries = SECTIONS.map(
    (u) => `  <url>
    <loc>${esc(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sectionEntries}
${productEntries}
</urlset>
`;
}

async function main() {
  const products = await fetchProducts();
  const xml = build(products);
  writeFileSync(new URL('../public/sitemap.xml', import.meta.url), xml, 'utf8');
  console.log(`✅ sitemap.xml généré : ${SECTIONS.length} sections + ${products.length} produits.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
