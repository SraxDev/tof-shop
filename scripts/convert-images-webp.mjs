/**
 * Convertit toutes les images produits existantes en WebP.
 *
 *   node scripts/convert-images-webp.mjs --dry     (simulation, ne modifie rien)
 *   node scripts/convert-images-webp.mjs           (conversion réelle)
 *
 * Ce que fait le script :
 *   1. Lit tous les produits + le drop en vedette
 *   2. Télécharge chaque image PNG/JPEG
 *   3. La reconvertit en WebP (qualité 78, max 1000px, transparence conservée)
 *   4. Upload le WebP à côté de l'original
 *   5. Met à jour l'URL en base
 *
 * Les fichiers d'origine ne sont PAS supprimés : en cas de problème,
 * il suffit de restaurer les URLs. Tu pourras faire le ménage plus tard
 * depuis Supabase → Storage.
 *
 * Prérequis : une SERVICE_ROLE key (Supabase → Settings → API → service_role).
 * Elle contourne le RLS, indispensable pour écrire. Ne la commite jamais.
 *
 *   SUPABASE_SERVICE_KEY=eyJ... node scripts/convert-images-webp.mjs
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// ── Config ──────────────────────────────────────────────────────────────────
function readEnvFile() {
  const out = {};
  for (const name of ['.env', '.env.local']) {
    const p = path.join(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const env = { ...readEnvFile(), ...process.env };
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'product-images';
const DRY = process.argv.includes('--dry');
const QUALITY = 78;
const MAX_SIZE = 1000;

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL introuvable (.env)');
  process.exit(1);
}
if (!SERVICE_KEY && !DRY) {
  console.error(`
❌ Il manque la clé service_role.

   Récupère-la dans Supabase → Settings → API → "service_role" (secret),
   puis relance :

     SUPABASE_SERVICE_KEY=eyJ... node scripts/convert-images-webp.mjs

   Pour juste simuler sans clé :
     node scripts/convert-images-webp.mjs --dry
`);
  process.exit(1);
}

// Client REST minimal : évite la dépendance @supabase/supabase-js
// (qui exige un WebSocket natif absent de Node 20).
const KEY = SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const api = {
  async select(table, query) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: H });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async update(table, match, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${table} update: ${r.status} ${await r.text()}`);
  },
  async upload(bucket, path, buffer, contentType) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': contentType, 'x-upsert': 'true', 'cache-control': '31536000' },
      body: buffer,
    });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  },
  publicUrl(bucket, path) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const kb = (n) => `${Math.round(n / 1024)}KB`;

function storagePathFromUrl(url) {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length).split('?')[0];
}

async function convertOne(url, stats) {
  if (!url.startsWith('http')) return url;             // data: ou vide
  if (/\.webp($|\?)/i.test(url)) { stats.skipped++; return url; }

  const srcPath = storagePathFromUrl(url);
  if (!srcPath) { stats.external++; return url; }      // image hors de notre bucket

  const res = await fetch(url);
  if (!res.ok) { stats.failed++; return url; }
  const input = Buffer.from(await res.arrayBuffer());

  const output = await sharp(input)
    .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  // Ne remplace que si le gain est réel
  if (output.length >= input.length) {
    stats.skipped++;
    return url;
  }

  stats.before += input.length;
  stats.after += output.length;
  stats.converted++;

  const destPath = srcPath.replace(/\.[a-z0-9]+$/i, '.webp');
  console.log(`   ${kb(input.length).padStart(7)} → ${kb(output.length).padStart(6)}  (-${Math.round((1 - output.length / input.length) * 100)}%)  ${destPath.split('/').pop()}`);

  if (DRY) return url;

  try {
    await api.upload(BUCKET, destPath, output, 'image/webp');
  } catch (e) {
    console.error(`   ⚠️  upload échoué : ${e.message}`);
    stats.failed++;
    return url;
  }

  return api.publicUrl(BUCKET, destPath);
}

async function convertField(value, stats) {
  const urls = (value || '').split('|').map((u) => u.trim()).filter(Boolean);
  const out = [];
  for (const u of urls) out.push(await convertOne(u, stats));
  return out.join('|');
}

// ── Main ────────────────────────────────────────────────────────────────────
const stats = { converted: 0, skipped: 0, failed: 0, external: 0, before: 0, after: 0 };

console.log(DRY ? '\n🔍 SIMULATION (aucune modification)\n' : '\n🚀 CONVERSION WebP\n');

let products;
try {
  products = await api.select('products', 'select=id,name,image_url');
} catch (e) {
  console.error('❌ Lecture des produits impossible :', e.message);
  process.exit(1);
}

console.log(`${products.length} produits\n`);

for (const p of products) {
  if (!p.image_url) continue;
  console.log(`📦 ${p.name}`);
  const next = await convertField(p.image_url, stats);
  if (!DRY && next !== p.image_url) {
    try {
      await api.update('products', `id=eq.${encodeURIComponent(p.id)}`, { image_url: next });
    } catch (e) {
      console.error(`   ⚠️  MAJ base échouée : ${e.message}`);
    }
  }
}

// Drop en vedette
let drop = null;
try {
  drop = (await api.select('featured_drop', 'select=id,image_url&id=eq.1'))[0] || null;
} catch { /* table absente : on ignore */ }

if (drop?.image_url) {
  console.log('\n⭐ Drop en vedette');
  const next = await convertField(drop.image_url, stats);
  if (!DRY && next !== drop.image_url) {
    try {
      await api.update('featured_drop', 'id=eq.1', { image_url: next });
    } catch (e) {
      console.error(`   ⚠️  MAJ drop échouée : ${e.message}`);
    }
  }
}

// ── Résumé ──────────────────────────────────────────────────────────────────
const saved = stats.before - stats.after;
console.log(`
────────────────────────────────────────
  Converties     ${stats.converted}
  Déjà en WebP   ${stats.skipped}
  Externes       ${stats.external}
  Échecs         ${stats.failed}

  Avant          ${kb(stats.before)}
  Après          ${kb(stats.after)}
  Économie       ${kb(saved)}${stats.before ? `  (-${Math.round((saved / stats.before) * 100)}%)` : ''}
────────────────────────────────────────`);

if (DRY) {
  console.log('\n💡 Simulation terminée. Pour appliquer :\n   SUPABASE_SERVICE_KEY=eyJ... node scripts/convert-images-webp.mjs\n');
} else {
  console.log('\n✅ Terminé. Recharge ton site pour voir la différence.\n');
}
