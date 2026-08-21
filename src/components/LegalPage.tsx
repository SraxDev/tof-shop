import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { setSeo, SITE_URL } from '../lib/seo';

// ────────────────────────────────────────────────────────────────────────────
// Pages légales (CGV + Mentions légales).
//
// ⚠️ Les textes ci-dessous sont des MODÈLES. Remplace les champs entre
// [CROCHETS] par tes vraies informations avant mise en ligne. Ils sont là pour
// te faire gagner du temps, pas pour se substituer à un conseil juridique.
// ────────────────────────────────────────────────────────────────────────────

type LegalSection = { title: string; body: string[] };

const SELLER = {
  name: '[TON NOM / RAISON SOCIALE]',
  form: '[Ex. : micro-entrepreneur / EI / SASU]',
  address: '[TON ADRESSE]',
  email: '[TON EMAIL]',
  phone: '[TON TÉLÉPHONE]',
  siret: '[N° SIRET]',
  tva: '[N° TVA intracommunautaire, si assujetti]',
  host: 'Vercel Inc. — 440 N Barranca Ave #4133, Covina, CA 91723, USA',
};

const MENTIONS: LegalSection[] = [
  {
    title: 'Éditeur du site',
    body: [
      `Le site ${SITE_URL} (ci-après « le Site ») est édité par ${SELLER.name}, ${SELLER.form}, immatriculé(e) sous le numéro ${SELLER.siret}.`,
      `Adresse : ${SELLER.address}.`,
      `Contact : ${SELLER.email} · ${SELLER.phone}.`,
      `Numéro de TVA intracommunautaire : ${SELLER.tva}.`,
    ],
  },
  {
    title: 'Hébergement',
    body: [`Le Site est hébergé par ${SELLER.host}.`],
  },
  {
    title: 'Propriété intellectuelle',
    body: [
      "L'ensemble des éléments du Site (textes, graphismes, logo, structure) est protégé par le droit d'auteur et reste la propriété de l'éditeur, sauf mention contraire. Toute reproduction sans autorisation est interdite.",
      'Les noms de marques et logos cités sur le Site appartiennent à leurs propriétaires respectifs.',
    ],
  },
  {
    title: 'Données personnelles (RGPD)',
    body: [
      'Les données collectées (nom, coordonnées, adresse de livraison) servent uniquement au traitement des commandes et à la communication client.',
      "Elles ne sont jamais vendues ni cédées à des tiers, hors les prestataires strictement nécessaires (paiement, livraison, hébergement).",
      "Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, tu disposes d'un droit d'accès, de rectification et de suppression de tes données. Pour l'exercer : " + SELLER.email + '.',
    ],
  },
  {
    title: 'Cookies',
    body: [
      'Le Site utilise uniquement des données stockées localement dans ton navigateur (panier, favoris, réglages) pour son fonctionnement. Aucun cookie publicitaire tiers.',
    ],
  },
];

const CGV: LegalSection[] = [
  {
    title: '1. Objet',
    body: [
      "Les présentes Conditions Générales de Vente (CGV) régissent l'ensemble des ventes conclues sur le Site entre l'éditeur et tout acheteur (ci-après « le Client »).",
      'Toute commande implique l’acceptation pleine et entière des présentes CGV.',
    ],
  },
  {
    title: '2. Produits',
    body: [
      'Les produits sont décrits et présentés avec la plus grande exactitude possible. Les photos sont non contractuelles.',
      'Les produits sont des pièces sélectionnées et vérifiées individuellement avant expédition (contrôle qualité sur photo).',
    ],
  },
  {
    title: '3. Prix',
    body: [
      'Les prix sont indiqués en euros, toutes taxes comprises (TTC), hors frais de livraison éventuels.',
      'L’éditeur se réserve le droit de modifier ses prix à tout moment ; le prix appliqué est celui en vigueur au moment de la commande.',
    ],
  },
  {
    title: '4. Commande',
    body: [
      'La commande s’effectue en ligne : le Client sélectionne un produit, sa taille/variante et sa quantité, puis valide ses coordonnées. Un numéro de commande (format TOF-XXXX) lui est attribué.',
      'La vente est considérée comme conclue à la réception du paiement.',
    ],
  },
  {
    title: '5. Paiement',
    body: [
      'Le paiement s’effectue par carte bancaire via un prestataire de paiement sécurisé (SumUp), avec authentification 3D Secure.',
      'Aucune donnée bancaire ne transite par le Site.',
    ],
  },
  {
    title: '6. Livraison',
    body: [
      'Les délais de livraison indiqués sont indicatifs (généralement 10 à 20 jours ouvrés, selon destination).',
      'Le Client reçoit un numéro de suivi dès l’expédition et peut suivre sa commande dans la section « Suivi ».',
    ],
  },
  {
    title: '7. Droit de rétractation',
    body: [
      'Conformément aux articles L221-18 et suivants du Code de la consommation, le Client dispose de 14 jours à compter de la réception pour exercer son droit de rétractation, sans avoir à motiver sa décision.',
      "Les frais de retour restent à la charge du Client, sauf produit non conforme ou erreur de l'éditeur.",
    ],
  },
  {
    title: '8. Garanties',
    body: [
      'Chaque pièce est vérifiée avant expédition. En cas de produit non conforme, endommagé ou d’erreur, le Client contacte l’éditeur sous 14 jours avec photos : un échange ou un remboursement est proposé.',
    ],
  },
  {
    title: '9. Litiges',
    body: [
      'Les présentes CGV sont soumises au droit français.',
      'En cas de litige non résolu à l’amiable, le Client peut recourir gratuitement à un médiateur de la consommation ou saisir les tribunaux compétents.',
    ],
  },
];

export default function LegalPage({ page }: { page: 'cgv' | 'mentions' }) {
  const sections = page === 'cgv' ? CGV : MENTIONS;
  const title = page === 'cgv' ? 'Conditions Générales de Vente' : 'Mentions légales';

  useEffect(() => {
    setSeo({
      title: `${title} — tof`,
      description: `${title} du site tof.`,
      url: `${SITE_URL}/#${page === 'cgv' ? 'cgv' : 'mentions-legales'}`,
    });
  }, [title, page]);

  return (
    <div className="min-h-screen bg-bg text-dark font-sans antialiased">
      <header className="sticky top-0 z-50 bg-bg/90 backdrop-blur-xl border-b border-dark/5">
        <div className="mx-auto max-w-3xl px-5 py-4 flex items-center justify-between">
          <a href="#" className="inline-flex items-center gap-2 text-sm font-bold text-dark/60 hover:text-dark transition-colors">
            <ArrowLeft size={16} /> Retour au site
          </a>
          <span className="font-display text-xl font-800 tracking-tight">
            tof<span className="text-accent">.</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <h1 className="font-display text-3xl sm:text-4xl font-800 tracking-tight">{title}</h1>
        <p className="mt-2 text-dark/40 text-sm">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="font-bold text-lg mb-2">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-dark/60 text-sm leading-relaxed mb-2">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
