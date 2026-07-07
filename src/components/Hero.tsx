import { ArrowDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import AppleEmoji from './AppleEmoji';
import { readSiteSettings } from '../lib/siteSettings';

const floatingBrands = [
  { name: 'Gucci', top: '8%', left: '-12%', delay: '0s' },
  { name: 'LV', top: '30%', left: '-16%', delay: '1.5s' },
  { name: 'Prada', top: '65%', left: '-10%', delay: '3s' },
  { name: 'Nike', top: '5%', right: '-14%', delay: '2s' },
  { name: 'Dior', top: '45%', right: '-16%', delay: '0.5s' },
  { name: 'Jordan', top: '78%', right: '-10%', delay: '2.5s' },
];

export default function Hero() {
  const [settings, setSettings] = useState(readSiteSettings);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tof-settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-bg pt-20">
      {/* Blob décoratif */}
      <div className="absolute top-20 right-[-10%] w-[500px] h-[500px] bg-accent/10 anim-blob opacity-60 pointer-events-none" />
      <div className="absolute bottom-10 left-[-5%] w-[300px] h-[300px] bg-orange-200/30 anim-blob opacity-40 pointer-events-none" style={{ animationDelay: '4s' }} />

      <div className="relative z-10 mx-auto max-w-6xl px-5 w-full">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Texte */}
          <div className="space-y-7">
            <div className="anim-fade-up opacity-0">
              <span className="inline-flex items-center gap-2 bg-accent/10 text-accent rounded-full px-4 py-1.5 text-xs font-semibold">
                {settings.heroBadge}
              </span>
            </div>

            <h1 className="anim-fade-up opacity-0 delay-200 font-display text-5xl sm:text-6xl lg:text-7xl font-800 leading-[0.95] tracking-tight text-dark">
              {settings.heroTitleStart}{' '}
              <span className="relative inline-block">
                {settings.heroTitleHighlight}
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 8c40-6 80-6 196-2" stroke="#e84d1a" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>

            <p className="anim-fade-up opacity-0 delay-400 text-dark/50 text-lg max-w-md leading-relaxed">
              {settings.heroDescription}
            </p>

            <p className="anim-fade-up opacity-0 delay-500 text-sm font-semibold text-dark/45">
              {settings.heroSubnote}
            </p>

            <div className="anim-fade-up opacity-0 delay-600 flex flex-wrap gap-3">
              <a
                href="#shop"
                className="bg-dark text-white px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-accent transition-colors"
              >
                Voir le shop →
              </a>
              <a
                href="#marques"
                className="border-2 border-dark/10 text-dark px-7 py-3.5 rounded-full text-sm font-semibold hover:border-accent hover:text-accent transition-colors"
              >
                Les marques
              </a>
            </div>

            {/* Mini trust */}
            <div className="anim-fade-up opacity-0 delay-700 flex items-center gap-5 pt-2 text-sm text-dark/35">
              <span className="flex items-center gap-1.5">✓ Livraison rapide</span>
              <span className="flex items-center gap-1.5">✓ Retours gratuits</span>
            </div>
          </div>

          {/* Image placeholder + floating brand pills */}
          <div className="hidden lg:block anim-fade-in opacity-0 delay-500">
            <div className="relative flex justify-center">
              {/* Floating brand pills */}
              {floatingBrands.map((b) => (
                <div
                  key={b.name}
                  className="absolute bg-white shadow-lg shadow-dark/5 rounded-full px-4 py-2 text-[11px] font-bold text-dark/60 border border-dark/5 anim-float z-20 hidden xl:flex"
                  style={{
                    top: b.top,
                    left: b.left,
                    right: b.right,
                    animationDelay: b.delay,
                  } as React.CSSProperties}
                >
                  {b.name}
                </div>
              ))}

              <div className="relative">
                <div className="aspect-[3/4] w-[380px] rounded-[2rem] bg-subtle overflow-hidden flex items-center justify-center border border-dark/5">
                  <div className="text-center space-y-3 p-8">
                    <AppleEmoji emoji="👟" size={56} className="mx-auto" />
                    <p className="text-dark/20 text-sm font-medium">ta photo ici</p>
                  </div>
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl shadow-dark/5 px-5 py-3 border border-dark/5 anim-float z-20">
                  <div className="flex items-center gap-3">
                    <AppleEmoji emoji="🔥" size={28} />
                    <div>
                      <div className="text-sm font-bold text-dark">{settings.heroStatValue}</div>
                      <div className="text-xs text-dark/40">{settings.heroStatLabel}</div>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-3 -right-3 bg-accent text-white rounded-xl px-4 py-2 text-xs font-bold shadow-lg shadow-accent/20 anim-float flex items-center gap-1.5 z-20" style={{ animationDelay: '2s' }}>
                  {settings.heroTopBadge} <AppleEmoji emoji="🚀" size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <ArrowDown size={18} className="text-dark/20 animate-bounce" />
      </div>
    </section>
  );
}
