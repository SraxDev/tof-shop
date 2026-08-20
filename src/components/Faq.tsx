import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

type QA = { q: string; a: string };

const FAQ: QA[] = [
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
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [settings, setSettings] = useState(readSiteSettings);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    return () => window.removeEventListener('tof-settings-updated', sync);
  }, []);

  return (
    <section id="faq" className="py-14 sm:py-20 bg-bg border-t border-dark/5">
      <div className="mx-auto max-w-3xl px-5">
        <div className="text-center mb-8 sm:mb-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-dark/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-dark/45">
            ❓ Questions fréquentes
          </span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-800 tracking-tight text-dark">
            tout ce que tu veux <span className="text-accent">savoir</span>
          </h2>
          <p className="mt-2 text-dark/45 text-sm sm:text-base">
            Une question qui n'est pas là ? Écris-moi, je réponds en ~5 min.
          </p>
        </div>

        <div className="space-y-2.5">
          {FAQ.map((item, i) => {
            const open = openIndex === i;
            return (
              <div
                key={item.q}
                className={`rounded-2xl bg-white border transition-all ${
                  open ? 'border-accent/25 shadow-sm shadow-accent/5' : 'border-dark/5'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left min-h-[56px]"
                >
                  <span className={`text-sm sm:text-[15px] font-bold ${open ? 'text-accent' : 'text-dark'}`}>
                    {item.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`flex-shrink-0 transition-transform duration-300 ${
                      open ? 'rotate-180 text-accent' : 'text-dark/25'
                    }`}
                  />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm text-dark/55 leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-3xl bg-dark text-white p-6 sm:p-7 text-center">
          <p className="font-display text-xl sm:text-2xl font-800">Toujours un doute ?</p>
          <p className="mt-1.5 text-white/45 text-sm">Pose ta question directement, réponse en ~5 min, 7j/7.</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2.5 justify-center">
            <a
              href={settings.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="h-12 px-7 rounded-full bg-[#25D366] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all"
            >
              💬 WhatsApp
            </a>
            <a
              href={settings.snapchatUrl}
              target="_blank"
              rel="noreferrer"
              className="h-12 px-7 rounded-full bg-[#FFFC00] text-dark text-sm font-bold flex items-center justify-center gap-2 hover:brightness-105 transition-all"
            >
              👻 Snapchat
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
