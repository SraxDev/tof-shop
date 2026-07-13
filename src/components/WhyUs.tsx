export default function WhyUs() {
  const points = [
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
      desc: 'Paiement via PayPal, protection acheteur 180 jours. Zéro risque à commander.',
      stat: '180j',
      statLabel: 'protection',
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
  ];

  return (
    <section id="apropos" className="py-14 sm:py-20 lg:py-28 bg-bg">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-800 tracking-tight text-dark">
            pourquoi <span className="text-accent">tof</span> ?
          </h2>
          <p className="mt-3 text-dark/40 max-w-md mx-auto text-sm sm:text-base">
            petit shop géré par une seule personne, pas de grosse équipe, pas de magasin — juste des pièces vérifiées une par une
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {points.map((p, i) => (
            <div
              key={p.title}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-dark/5 hover:shadow-xl hover:shadow-dark/5 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="text-3xl mb-3">{p.emoji}</div>
              <h3 className="font-bold text-dark text-sm sm:text-base mb-1">{p.title}</h3>
              <p className="text-xs sm:text-sm text-dark/40 leading-relaxed mb-3">{p.desc}</p>
              <div className="pt-3 border-t border-dark/5">
                <span className="text-lg sm:text-xl font-800 text-accent">{p.stat}</span>
                <span className="text-[10px] sm:text-xs text-dark/30 ml-1.5">{p.statLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
