import { CheckCircle2, Star } from 'lucide-react';
import { useInView } from '../hooks/useInView';

const reviews = [
  {
    name: 'Yanis K.',
    city: 'Lyon',
    product: 'Jordan 1 Retro High',
    date: 'il y a 6 jours',
    text: "J'avais un peu peur au debut vu que c'etait ma premiere commande, mais le suivi etait propre. Recu en un peu moins de 2 semaines, la paire est nickel. Je recommanderai surement.",
    stars: 5,
    initials: 'YK',
  },
  {
    name: 'Ines B.',
    city: 'Marseille',
    product: 'Sac Prada Re-Nylon',
    date: 'il y a 2 semaines',
    text: "Bonne communication sur WhatsApp, il m'a envoye les photos avant l'envoi. Le colis a mis 13 jours. Franchement pour le prix je suis contente, juste l'emballage aurait pu etre un peu mieux.",
    stars: 4,
    initials: 'IB',
  },
  {
    name: 'Amine R.',
    city: 'Paris',
    product: 'Hoodie LV Monogram',
    date: 'il y a 3 semaines',
    text: "Deuxieme commande chez tof. Le hoodie taille bien, matiere lourde comme je voulais. Delai un peu long mais il m'avait prevenu donc pas de surprise. Service serieux.",
    stars: 5,
    initials: 'AR',
  },
  {
    name: 'Sarah M.',
    city: 'Toulouse',
    product: 'Casquette Dior',
    date: 'il y a 1 mois',
    text: "Commande simple, il repond vite sur WhatsApp. J'ai recu le tracking apres quelques jours. La casquette est propre, rien a dire. Je mets 4 etoiles juste pour le delai.",
    stars: 4,
    initials: 'SM',
  },
];

export default function Reviews() {
  const { ref, isInView } = useInView(0.1);

  return (
    <section className="py-14 sm:py-20 lg:py-28 bg-white" ref={ref}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl sm:text-5xl font-800 tracking-tight text-dark">
            les avis
          </h2>
          <p className="mt-3 text-dark/40">des retours clients simples, pas des phrases robot</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {reviews.map((r, i) => (
            <div
              key={r.name}
              className={`bg-bg rounded-2xl p-5 border border-dark/5 ${
                isInView ? 'anim-fade-up opacity-0' : 'opacity-0'
              }`}
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-dark text-white flex items-center justify-center text-xs font-bold">
                    {r.initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-dark">{r.name}</div>
                    <div className="text-xs text-dark/35">{r.city}</div>
                  </div>
                </div>
                <span className="text-[10px] text-dark/25 whitespace-nowrap">{r.date}</span>
              </div>

              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    size={13}
                    className={j < r.stars ? 'fill-amber-400 text-amber-400' : 'fill-dark/10 text-dark/10'}
                  />
                ))}
              </div>

              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-dark/45">
                <CheckCircle2 size={12} className="text-green-500" />
                Commande verifiee
              </div>

              <p className="text-dark/60 text-sm leading-relaxed mb-5">"{r.text}"</p>

              <div className="border-t border-dark/5 pt-4">
                <div className="text-[10px] uppercase tracking-wider text-dark/25 font-bold">Produit achete</div>
                <div className="text-sm font-semibold text-dark/70 mt-1">{r.product}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-10 lg:gap-16">
          {[
            { val: '4.7/5', label: 'note moyenne' },
            { val: '120+', label: 'commandes traitees' },
            { val: '24h', label: 'reponse moyenne' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-display font-800 text-dark">{s.val}</div>
              <div className="text-xs text-dark/30 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}