/**
 * Moteur de réponse du bot tof.
 *
 * Objectifs :
 *  - Pas de réponse en double (mémoire des sujets déjà abordés dans la conv)
 *  - Gère les rafales de messages (l'appelant doit bufferiser)
 *  - Combine plusieurs intentions si l'utilisateur envoie plusieurs choses
 *  - Réponses variées (plusieurs tournures par intention)
 *  - Contextualisé (produit ouvert, panier...)
 */

export type Intent =
  | 'greeting'
  | 'order_howto'
  | 'prices'
  | 'shipping'
  | 'tracking'
  | 'free_shipping'
  | 'payment'
  | 'trust'
  | 'returns'
  | 'sizing'
  | 'contact_whatsapp'
  | 'socials'
  | 'brands'
  | 'stock'
  | 'qc_quality'
  | 'express'
  | 'promo'
  | 'thanks'
  | 'product_search'
  | 'start_checkout'
  | 'human'
  | 'off_topic'
  | 'ack_ok';

export type BotState = {
  /** Sujets déjà abordés (pour ne pas se répéter). */
  covered: Set<Intent>;
  /** Intention détectée au message précédent. */
  lastIntent?: Intent;
  /** Nom de l'utilisateur. */
  userName?: string;
  /** Dernier produit ouvert (si connu). */
  lastProduct?: { brand: string; name: string };
  /** Tour de réponse (1 = premier message du bot après salutation). */
  turn: number;
};

export type BotDecision = {
  /** Réponse textuelle (peut contenir \n). */
  reply: string;
  /** Boutons de suivi proposés. */
  suggestions: string[];
  /** Intention principale détectée. */
  intent: Intent;
};

type Rule = {
  intent: Intent;
  keywords: string[];
  /** Poids pour départager plusieurs règles matchées. */
  weight?: number;
};

const RULES: Rule[] = [
  { intent: 'greeting', keywords: ['salut', 'bonjour', 'hello', 'yo', 'hey', 'wesh', 'slt', 'bjr', 'cc', 'coucou', 'bonsoir', 'hey '] },
  { intent: 'start_checkout', keywords: ['commander', 'acheter', 'je veux', 'prendre', 'passer commande', 'je prends', 'commande', 'achète', 'achete', 'je prend', "j'veux", 'je veux acheter', 'go commander'], weight: 2 },
  { intent: 'order_howto', keywords: ['comment commander', 'comment ça marche', 'comment sa marche', 'comment on fait', 'process', 'étapes', 'etapes', 'c\'est comment', 'fonctionne'] },
  { intent: 'prices', keywords: ['prix', 'combien', 'coûte', 'coute', 'cher', 'tarif', 'budget', 'euro', '€', 'solde'] },
  { intent: 'promo', keywords: ['promo', 'code', 'réduction', 'reduction', 'réduc', 'reduc', 'code promo', 'coupon'] },
  { intent: 'shipping', keywords: ['livraison', 'delai', 'délai', 'combien de temps', 'expédition', 'expedition', 'recevoir', 'reçois', 'jours', 'semaine', 'quand', 'arrive', 'arrivera', 'envoi', 'reçu', 'recu', 'envoie', 'envoyé', 'envoyee'], weight: 1 },
  { intent: 'tracking', keywords: ['track', 'suivi', 'colis', 'suivre', 'numero', 'numéro', 'tracking'] },
  { intent: 'free_shipping', keywords: ['gratuit', 'offert', 'livraison gratuite', 'frais de port', 'port gratuit', 'free shipping'] },
  { intent: 'payment', keywords: ['paiement', 'payer', 'paypal', 'virement', 'carte', 'cb', 'apple pay', 'revolut', 'moyen de paiement', 'régler', 'regler'] },
  { intent: 'trust', keywords: ['sécurisé', 'securise', 'confiance', 'arnaque', 'fiable', 'legit', 'vrai ou faux', 'scam', 'sérieux', 'serieux', 'contrefaçon', 'contrefacon', 'fiable', 'pourquoi vous', 'vous êtes fiable'] },
  { intent: 'returns', keywords: ['retour', 'rembours', 'échange', 'echange', 'problème', 'probleme', 'cassé', 'casse', 'abîmé', 'abime', 'erreur', 'tromper', 'trompé', 'mauvaise taille'] },
  { intent: 'sizing', keywords: ['taille', 'size', 'guide', 'mesure', 'pointure', 'grand', 'petit', 'taille bien', 'chausse', 'taille grand', 'taille petit', 'quelle taille', 'quelle taille prendre', 'cm'] },
  { intent: 'contact_whatsapp', keywords: ['whatsapp', 'contact', 'joindre', 'appeler', 'telephone', 'téléphone', 'tel', 'humain', 'parler à quelqu\'un', 'vrai personne', 'un humain', 'wa.me'] },
  { intent: 'human', keywords: ['parler à un humain', 'un humain', 'une personne', 'répondez', 'repondez', 'réel', 'répondeur', 'bot', 'assisstant', 'quelqu\'un', 'une vraie personne'] },
  { intent: 'socials', keywords: ['snap', 'snapchat', 'instagram', 'insta', 'tiktok', 'réseau', 'reseau'] },
  { intent: 'brands', keywords: ['gucci', 'louis vuitton', 'louis', 'vuitton', 'lv', 'prada', 'nike', 'jordan', 'dior', 'balenciaga', 'versace', 'burberry', 'off-white', 'off white', 'amiri', 'moncler', 'stone island', 'marque', 'quelles marques', 'quelles marques', 'quelle marque', 'luxe', 'champion', 'represent', 'fog', 'essentials', 'travis', 'yeezy'] },
  { intent: 'stock', keywords: ['stock', 'disponible', 'dispo', 'rupture', 'en stock', 'reste', 'disponible quand'] },
  { intent: 'qc_quality', keywords: ['qc', 'qualité', 'quality', 'photo qc', 'authentique', 'authenticité', 'original', 'contrefaçon', 'vrai'], weight: 1 },
  { intent: 'express', keywords: ['express', 'rapide', 'vite', 'vitesse', 'urgent', 'au plus vite'], weight: 2 },
  { intent: 'thanks', keywords: ['merci', 'thanks', 'cool', 'top', 'parfait', 'super', 'nickel', 'genial', 'génial', 'ok', 'dac', "d'accord", 'oui', 'yes', 'ouais', 'dacc', "c'est bon"], weight: -1 },
  { intent: 'product_search', keywords: ['cherche', 'recherche', 'avez-vous', 'avez vous', 'auriez', 'tu as', 'vous avez', 'je cherche', 'est-ce que vous avez', 'existe'], weight: 2 },
];

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[!?,.:;()[\]{}"'’…_*/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectIntents(text: string): Intent[] {
  const n = normalize(text);
  if (!n) return [];
  const found: Array<{ intent: Intent; weight: number }> = [];
  for (const rule of RULES) {
    if (rule.keywords.some((k) => n.includes(normalize(k)))) {
      found.push({ intent: rule.intent, weight: rule.weight ?? 1 });
    }
  }
  // Dé-doublonne et trie par poids
  const seen = new Set<Intent>();
  return found
    .sort((a, b) => b.weight - a.weight)
    .filter((r) => {
      if (seen.has(r.intent)) return false;
      seen.add(r.intent);
      return true;
    })
    .map((r) => r.intent);
}

// Banque de réponses par intention : plusieurs tournures pour varier.
const REPLIES: Record<Intent, string[]> = {
  greeting: [
    "Salut ! 👋 Ravi de te voir sur tof. Je peux t'aider sur les tailles, la livraison, les commandes ou les marques.",
    "Hey ! Bienvenue sur tof. 🔥 N'hésite pas à me poser une question ou à cliquer sur un bouton ci-dessous.",
    "Salut toi ! C'est ton assistant tof. Dis-moi ce que tu cherches et je te guide.",
  ],
  order_howto: [
    "C'est simple : 🛍️\n\n1. Ajoute tes pièces au panier\n2. Remplis tes infos\n3. On te contacte sur WhatsApp pour le paiement PayPal sécurisé\n4. Tu reçois le tracking dès l'expédition\n\nTu peux commencer tout de suite depuis le shop.",
  ],
  prices: [
    "Tous nos prix sont affichés en €, TVA incluse, directement sur chaque fiche produit. 💸\n\nSi un produit n'a pas de prix affiché ou que tu cherches un tarif groupé, passe par WhatsApp !",
  ],
  promo: [
    "🎁 Le code de lancement est TOFLAUNCH (-15% sur la première commande).\n\nD'autres codes sont partagés régulièrement sur Snapchat. Pour un geste commercial sur une commande, passe directement par WhatsApp.",
  ],
  shipping: [
    "🚚 Délais après paiement :\n\n• Préparation + QC : 2-5 jours\n• Standard : 10-20 jours ouvrés\n• Express (en option) : 5-10 jours\n\nTu reçois un numéro de suivi dès que le colis part. 💌",
  ],
  tracking: [
    "Oui, toutes les expéditions sont suivies. 📍 Le numéro de tracking t'est envoyé sur WhatsApp dès que le colis est pris en charge. Si tu as déjà commandé, envoie-nous ton numéro de commande (commence par TOF-).",
  ],
  free_shipping: [
    "🎉 La livraison standard est offerte à partir du seuil affiché dans le panier (ou en ce moment sur tout le site avec le code de lancement).",
  ],
  payment: [
    "💳 Paiement 100% sécurisé via PayPal (protection acheteur).\n\n1. Tu valides ton panier\n2. On t'envoie la demande PayPal sur WhatsApp\n3. Tu payes en 2 clics\n4. On lance la préparation\n\nSi tu préfères un autre moyen (Revolut, virement), dis-le nous.",
  ],
  trust: [
    "On comprend les doutes, c'est normal. On est transparents :\n\n✅ Photos QC (contrôle qualité) envoyées avant envoi\n✅ Paiement PayPal avec protection acheteur\n✅ Retours acceptés sous 14 jours\n✅ Support 7j/7 réactif sur WhatsApp\n\nZéro mauvaise surprise. ❤️",
  ],
  returns: [
    "Un souci ? Contacte-nous dans les 14 jours avec ton numéro TOF-XXXX :\n\n• Mauvaise taille / article : échange ou remboursement\n• Article défectueux : remboursement immédiat\n• Erreur de notre part : on prend tout en charge",
  ],
  sizing: [
    "📐 En général :\n\n• Sapes (S/M/L) : prends ta taille habituelle\n• Sneakers : chaussent normalement (TTS)\n• Entre deux tailles → prends la plus grande\n\nSi tu hésites sur un modèle précis, dis-nous lequel, on peut te donner les mesures exactes en cm.",
  ],
  contact_whatsapp: [
    "Le plus rapide pour nous joindre, c'est WhatsApp. 💬\n\nClique directement sur le bouton vert \"💬 WhatsApp\" dans le menu — ça ouvre directement la conversation.",
  ],
  human: [
    "Bien sûr ! Je peux passer le relais à l'équipe. Laisse ta question ici ou passe directement par WhatsApp, quelqu'un te répond dans les plus brefs délais. 🙌",
  ],
  socials: [
    "📸 On est sur Snapchat @tofh2b pour les drops en avant-première, les photos QC et les codes exclusifs. Rejoins-nous !",
  ],
  brands: [
    "On source le meilleur du streetwear et du luxe : Nike, Jordan, Stüssy, Corteiz, Represent, Essentials/FoG, Moncler, Arc'teryx, ainsi que des pièces luxe (LV, Gucci, Dior, Prada, Balenciaga...). 💎\n\nSi tu cherches un modèle précis qui n'est pas sur le site, envoie une photo ou une description — on peut souvent le sourcer.",
  ],
  stock: [
    "📦 Toutes les pièces visibles sur le shop sont disponibles. Si un produit disparaît c'est qu'il est en rupture ou en réapprovisionnement.\n\nPour une rupture précise, demande-nous sur WhatsApp.",
  ],
  qc_quality: [
    "🔍 Contrôle qualité systématique avant envoi :\n\n• Photos détaillées (coutures, logos, matières) envoyées pour validation\n• Vérification point par point\n• Mesures sur demande\n\nOn n'expédie rien sans ton feu vert.",
  ],
  express: [
    "⚡ Oui, la livraison Express 5-10 jours est disponible en option dans le panier (avec supplément). Parfait pour un cadeau ou une sortie !",
  ],
  thanks: [
    "Avec plaisir ! 🔥 N'hésite pas si tu as d'autres questions — je suis là.",
    "Tout bon ! Bonne visite sur le shop. 🫡",
    "Ça roule ! Profite bien et à bientôt sur le shop.",
  ],
  product_search: [
    "Je ne peux pas encore chercher dans le catalogue directement depuis le chat, mais tu peux utiliser la barre de recherche sur le shop (section \"le shop\"). Si tu ne trouves pas ton bonheur, envoie-nous une description ou une photo sur WhatsApp — on va essayer de dénicher ça !",
  ],
  start_checkout: [
    "Let's go ! 🚀\n\n1. Ouvre le shop\n2. Ajoute tes pièces au panier\n3. Valide la commande\n\nOn prend le relais sur WhatsApp juste après pour le paiement. Tu y es presque !",
  ],
  off_topic: [
    "Hmm, je ne suis pas sûr de comprendre. 😅 Je peux t'aider sur : la livraison, les tailles, les commandes, le paiement, ou les marques. Si tu veux parler à l'équipe, passe par WhatsApp !",
  ],
  ack_ok: [
    "Okay ! 👌",
  ],
};

const DEFAULT_SUGGESTIONS: Record<Intent, string[]> = {
  greeting: ['🛒 Commander', '📦 Livraison', '💳 Paiement', '📐 Tailles', '🏷️ Marques', '💬 WhatsApp'],
  order_howto: ['Aller au shop', '💳 Paiement', '📦 Livraison'],
  prices: ['🏷️ Marques', '🎁 Code promo'],
  promo: ['Aller au shop', '💬 WhatsApp'],
  shipping: ['📦 Suivi de colis', '⚡ Livraison express', '🎉 Livraison gratuite'],
  tracking: ['💬 WhatsApp'],
  free_shipping: ['📦 Délais'],
  payment: ['🛒 Commander', '💬 WhatsApp'],
  trust: ['🔍 Qualité QC', '♻️ Retours', '💬 WhatsApp'],
  returns: ['💬 WhatsApp'],
  sizing: ['Aller au shop', '💬 WhatsApp pour mesures'],
  contact_whatsapp: ['Aller au shop'],
  human: ['💬 WhatsApp'],
  socials: ['💬 WhatsApp'],
  brands: ['Aller au shop', 'Envoyer une recherche'],
  stock: ['Aller au shop', '💬 WhatsApp'],
  qc_quality: ['🛒 Commander', '♻️ Retours'],
  express: ['🛒 Commander'],
  thanks: ['Aller au shop'],
  product_search: ['Aller au shop', '💬 WhatsApp'],
  start_checkout: ['Aller au shop', '💳 Paiement'],
  off_topic: ['🛒 Commander', '📦 Livraison', '💳 Paiement', '💬 WhatsApp'],
  ack_ok: ['🛒 Voir le shop'],
};

function pickReply(intent: Intent): string {
  const pool = REPLIES[intent] || REPLIES.off_topic;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickSuggestions(intent: Intent, state: BotState): string[] {
  const base = DEFAULT_SUGGESTIONS[intent] || DEFAULT_SUGGESTIONS.off_topic;
  // Si c'est le tout premier tour, on garde une sélection riche
  if (state.turn === 0) return ['🛒 Commander', '📦 Délais', '💳 Paiement', '📐 Tailles', '💬 WhatsApp'];
  // Évite de proposer un sujet qu'on vient juste de traiter
  return base.slice(0, 4);
}

/**
 * Traite un ou plusieurs messages consécutifs (rafale) et retourne la
 * réponse du bot + nouvelles suggestions.
 */
export function botReply(
  messages: string | string[],
  state: BotState,
): BotDecision {
  const arr = Array.isArray(messages) ? messages : [messages];
  const joined = arr.join('. ');
  const intents = detectIntents(joined);

  // Petite détection de nom dans le premier message (ex: "salut c'est Alex")
  if (!state.userName) {
    const m = joined.match(/(?:c'est|je suis|moi c'est)\s+([a-zéèêëàâäîïôöùûüçœæ-]{2,15})/i);
    if (m) state.userName = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  }

  let intent: Intent;
  let reply: string;

  // Si aucun intent détecté → fallback
  if (intents.length === 0) {
    // Messages très courts de type "lol", "mdr", "m" → on ne répond que OK
    if (joined.length <= 3) {
      intent = 'ack_ok';
    } else {
      intent = 'off_topic';
    }
  } else {
    // Prend la première intention, MAIS si "greeting" est seul → salut ; sinon priorise le sujet métier
    intent = intents.find((i) => i !== 'greeting' && i !== 'thanks') || intents[0];
  }

  // Si l'utilisateur a déjà parlé de ce sujet dans cette conversation,
  // on répond plus brièvement pour éviter la même tartine.
  const alreadyCovered = state.covered.has(intent);

  if (intent === 'greeting' && state.turn > 0) {
    // Évite de re-saluer
    intent = 'ack_ok';
  }

  reply = pickReply(intent);

  // Petite personnalisation si on connaît le prénom
  if (state.userName && intent === 'greeting' && reply.startsWith('Salut !') === false) {
    reply = reply.replace(/^Salut/, `Salut ${state.userName}`);
  }

  // Si c'est un sujet déjà couvert, ajoute un petit préambule
  if (alreadyCovered && intent !== 'thanks' && intent !== 'ack_ok' && intent !== 'human') {
    reply = `Pour rappel :\n\n${reply}`;
  }

  // Si détecte un produit dans le contexte, ajoute un clin d'œil (sera rempli par l'appelant si connu)
  // → géré en dehors (on ajoute rien ici pour rester léger).

  state.covered.add(intent);
  state.lastIntent = intent;
  state.turn += 1;

  return {
    reply,
    suggestions: pickSuggestions(intent, state),
    intent,
  };
}

export function createBotState(): BotState {
  return {
    covered: new Set<Intent>(),
    turn: 0,
  };
}
