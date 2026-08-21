/**
 * Couche de compréhension du langage pour le bot tof.
 *
 * Les clients écrivent vite, sur mobile, en abrégé et avec des fautes :
 * "livrezon", "vs avez du lv?", "jvx commandé", "c cb ?".
 * Un moteur qui compare des chaînes exactes rate tout ça et répond
 * "je n'ai pas compris" — le client part.
 *
 * Ce module apporte :
 *   • normalisation + expansion du langage SMS
 *   • correspondance floue (distance de Levenshtein) tolérante aux fautes
 *   • détection de négation ("je ne veux PAS payer par carte")
 *   • détection d'agacement / urgence (pour escalader vite)
 *   • détection de question vs affirmation
 */

// ─── Normalisation ───────────────────────────────────────

/** Abréviations SMS courantes → forme longue. */
const SMS_MAP: Record<string, string> = {
  vs: 'vous', vou: 'vous', ts: 'tous', tt: 'tout', tjs: 'toujours', tjrs: 'toujours',
  bcp: 'beaucoup', pk: 'pourquoi', pq: 'pourquoi', qd: 'quand', cb: 'combien',
  cmb: 'combien', cmt: 'comment', comen: 'comment', koi: 'quoi', kel: 'quelle',
  kelle: 'quelle', ke: 'que', kest: 'quest', jvx: 'je veux', jve: 'je veux',
  jvoudrai: 'je voudrais', jaimerai: 'je aimerais', chui: 'je suis', chuis: 'je suis',
  stp: 'sil te plait', svp: 'sil vous plait', mdr: 'rire', ptdr: 'rire', lol: 'rire',
  dsl: 'desole', pcq: 'parce que', pck: 'parce que', par6: 'parce que',
  auj: 'aujourdhui', ajd: 'aujourdhui', dmain: 'demain', slt: 'salut', bjr: 'bonjour',
  bsr: 'bonsoir', cc: 'coucou', re: 'salut', yo: 'salut',
  liv: 'livraison', livrezon: 'livraison', livrason: 'livraison', livraision: 'livraison',
  cmd: 'commande', cmde: 'commande', comande: 'commande', commmande: 'commande',
  tail: 'taille', tailel: 'taille', pointur: 'pointure',
  paimen: 'paiement', payment: 'paiement', payment_: 'paiement',
  dispo: 'disponible', qualiter: 'qualite', qualité: 'qualite',
  prix_: 'prix', combien_: 'combien',
  lv: 'louis vuitton', cp: 'cp company', nb: 'new balance',
  sneak: 'sneakers', basket: 'sneakers', baskets: 'sneakers', chaussure: 'sneakers',
  chaussures: 'sneakers', paire: 'sneakers', tshirt: 't-shirt', tee: 't-shirt',
};

export function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s@.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise + remplace les abréviations SMS par leur forme longue. */
export function expand(str: string): string {
  const n = normalize(str);
  if (!n) return '';
  return n
    .split(' ')
    .map((w) => SMS_MAP[w] || w)
    .join(' ');
}

// ─── Correspondance floue ────────────────────────────────

/** Distance de Levenshtein, plafonnée pour rester rapide. */
export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    let best = i;
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      if (prev[j] < best) best = prev[j];
      diag = tmp;
    }
    if (best > max) return max + 1;
  }
  return prev[b.length];
}

/** Tolérance de faute admise selon la longueur du mot. */
function tolerance(word: string): number {
  if (word.length <= 3) return 0;
  if (word.length <= 5) return 1;
  if (word.length <= 9) return 2;
  return 3;
}

/**
 * Le texte contient-il ce mot-clé, même mal orthographié ?
 * Gère aussi les mots-clés en plusieurs mots ("comment commander").
 */
export function fuzzyIncludes(haystack: string, keyword: string): boolean {
  const k = normalize(keyword);
  if (!k) return false;
  if (haystack.includes(k)) return true;

  // Mot-clé multi-mots : chaque terme doit être présent (dans l'ordre libre)
  if (k.includes(' ')) {
    const parts = k.split(' ').filter((x) => x.length >= 3);
    if (parts.length === 0) return false;
    return parts.every((part) => fuzzyIncludes(haystack, part));
  }

  if (k.length < 4) return false; // trop court pour tolérer une faute
  const tol = tolerance(k);
  const words = haystack.split(' ');
  for (const w of words) {
    if (w.length < 3) continue;
    if (levenshtein(w, k, tol) <= tol) return true;
    // Mot tronqué par le client ("livrai" pour "livraison")
    if (w.length >= 5 && k.startsWith(w)) return true;
  }
  return false;
}

// ─── Analyse d'intention transverse ──────────────────────

const NEGATIONS = ['pas', 'jamais', 'aucun', 'aucune', 'sans', 'ni', 'non'];

/** Le mot-clé est-il précédé d'une négation ? ("je ne veux pas payer par carte") */
export function isNegated(text: string, keyword: string): boolean {
  const n = expand(text);
  const k = normalize(keyword);
  const idx = n.indexOf(k);
  if (idx === -1) return false;
  const before = n.slice(Math.max(0, idx - 30), idx);
  return NEGATIONS.some((neg) => new RegExp(`\\b${neg}\\b`).test(before));
}

const FRUSTRATION = [
  'toujours pas', 'ca fait', 'depuis', 'jattends', 'j attends', 'attends toujours',
  'arnaque', 'escroc', 'voleur', 'scam', 'rembourse', 'remboursement',
  'inadmissible', 'inacceptable', 'scandaleux', 'honteux', 'nul', 'jamais recu',
  'jamais recu', 'pas recu', 'toujours rien', 'personne ne repond', 'aucune reponse',
  'plainte', 'avocat', 'police', 'signaler', 'litige', 'jen ai marre', 'marre',
  'ridicule', 'enerve', 'furieux', 'deteste',
];

const URGENCY = ['urgent', 'vite', 'rapidement', 'au plus vite', 'des que possible', 'immediatement', 'maintenant'];

export type Mood = 'neutral' | 'urgent' | 'frustrated';

export function detectMood(text: string): Mood {
  const n = expand(text);
  // Majuscules soutenues = ton qui monte
  const raw = text || '';
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const shouting = letters.length >= 8
    && letters === letters.toUpperCase()
    && /[A-ZÀ-Ý]/.test(letters);

  if (FRUSTRATION.some((f) => n.includes(normalize(f)))) return 'frustrated';
  if (shouting) return 'frustrated';
  if ((raw.match(/[!?]/g) || []).length >= 3) return 'frustrated';
  if (URGENCY.some((u) => n.includes(normalize(u)))) return 'urgent';
  return 'neutral';
}

/** Message très court sans contenu ("ok", "mdr", "👍") */
export function isFiller(text: string): boolean {
  const n = expand(text);
  if (!n) return true;
  const fillers = ['ok', 'oki', 'okay', 'dac', 'daccord', 'rire', 'ah', 'ahh', 'hmm', 'mmh', 'bien', 'cool', 'nickel', 'ouais', 'oui', 'non', 'yes', 'yep'];
  return n.split(' ').every((w) => fillers.includes(w));
}

export function isQuestion(text: string): boolean {
  const raw = (text || '').trim();
  if (raw.endsWith('?')) return true;
  const n = expand(raw);
  return /^(est ce que|c est quoi|quel|quelle|quels|quelles|comment|pourquoi|quand|ou|combien|qui|que|qu|avez|auriez|pouvez|peux|puis je|es|est)\b/.test(n);
}
