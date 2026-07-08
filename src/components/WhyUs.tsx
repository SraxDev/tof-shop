import { useInView } from '../hooks/useInView';
import AppleEmoji from './AppleEmoji';

const points = [
  {
    emoji: '📦',
    title: 'Livraison suivie',
    desc: 'Tracking envoyé directement sur WhatsApp. Tu sais où en est ton colis.',
    stat: '7-20j',
    statLabel: 'livraison',
  },
  {
    emoji: '🔍',
    title: 'QC avant envoi',
    desc: 'On vérifie chaque pièce et on t\'envoie les photos avant d\'expédier.',
    stat: '100%',
    statLabel: 'vérifié',
  },
  {
    emoji: '🔄',
    title: 'Retours faciles',
    desc: 'Problème ? On gère ça ensemble sur WhatsApp, sans prise de tête.',
    stat: '14j',
    statLabel: 'pour retourner',
  },
  {
    emoji: '💬',
    title: 'Dispo sur Snap & WhatsApp',
    desc: 'Une question ? On te répond en moins de 2h sur tes apps préférées.',
    stat: '<2h',
    statLabel: 'réponse',
  },
];

export default function WhyUs() {
  const { ref, isInView } = useInView(0.1);

  return (
    <section id="apropos" className="py-14 sm:py-20 lg:py-28 bg-bg" ref={ref}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-800 tracking-tight text-dark">
            pourquoi <span className="text-accent">tof</span> ?
          </h2>
          <p className="mt-3 text-dark/40 max-w-md mx-auto text-sm sm:text-base">
            on est pas juste un shop, on est des passionnés comme toi
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {points.map((p, i) => (
            <div
              key={p.title}
              className={`bg-white rounded-2xl p-5 sm:p-6 border border-dark/5 hover:shadow-xl hover:shadow-dark/5 hover:-translate-y-1 transition-all duration-300 ${
                isInView ? 'anim-fade-up opacity-0' : 'opacity-0'
              }`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <AppleEmoji emoji={p.emoji} size={32} className="block mb-3" />
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
