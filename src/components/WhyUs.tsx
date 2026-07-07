import { useInView } from '../hooks/useInView';
import AppleEmoji from './AppleEmoji';

const points = [
  {
    emoji: '📦',
    title: 'Livraison suivie',
    desc: 'Tracking envoye directement sur WhatsApp. Tu sais ou en est ton colis.',
  },
  {
    emoji: '🔄',
    title: 'Retours faciles',
    desc: 'Probleme ? On gere ca ensemble sur WhatsApp, sans prise de tete.',
  },
  {
    emoji: '💬',
    title: 'Dispo sur Snap & WhatsApp',
    desc: 'Une question ? On te repond vite fait sur tes apps preferees.',
  },
];

export default function WhyUs() {
  const { ref, isInView } = useInView(0.1);

  return (
    <section id="apropos" className="py-20 lg:py-28 bg-bg" ref={ref}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl sm:text-5xl font-800 tracking-tight text-dark flex items-center justify-center gap-3">
            pourquoi tof ? <AppleEmoji emoji="💎" size={36} />
          </h2>
          <p className="mt-3 text-dark/40 max-w-md mx-auto">
            on est pas juste un shop, on est des passionnés comme toi
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {points.map((p, i) => (
            <div
              key={p.title}
              className={`bg-white rounded-2xl p-6 border border-dark/5 hover:shadow-xl hover:shadow-dark/5 hover:-translate-y-1 transition-all duration-300 ${
                isInView ? 'anim-fade-up opacity-0' : 'opacity-0'
              }`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <AppleEmoji emoji={p.emoji} size={36} className="block mb-4" />
              <h3 className="font-bold text-dark text-base mb-2">{p.title}</h3>
              <p className="text-sm text-dark/40 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
