import { ArrowDown, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import AppleEmoji from './AppleEmoji';
import { readSiteSettings } from '../lib/siteSettings';
import { fetchDrop, type DbDrop } from '../lib/db';

const floatingBrands = [
  { name: 'Nike', top: '8%', left: '-12%', delay: '0s' },
  { name: 'Stüssy', top: '30%', left: '-16%', delay: '1.5s' },
  { name: 'Arc\'teryx', top: '65%', left: '-10%', delay: '3s' },
  { name: 'Jordan', top: '5%', right: '-14%', delay: '2s' },
  { name: 'Corteiz', top: '45%', right: '-16%', delay: '0.5s' },
  { name: 'Represent', top: '78%', right: '-10%', delay: '2.5s' },
];

type DropImage = { imageUrl: string; brand: string; name: string } | null;

export default function Hero() {
  const [settings, setSettings] = useState(readSiteSettings);
  const [dropImg, setDropImg] = useState<DropImage>(null);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tof-settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = (await fetchDrop()) as DbDrop | null;
        if (!alive) return;
        if (d?.image_url) setDropImg({ imageUrl: d.image_url, brand: d.brand, name: d.name });
      } catch {}
    })();
    const sync = () => {
      (async () => {
        try {
          const d = (await fetchDrop()) as DbDrop | null;
          if (!alive) return;
          if (d?.image_url) setDropImg({ imageUrl: d.image_url, brand: d.brand, name: d.name });
        } catch {}
      })();
    };
    window.addEventListener('tof-drop-updated', sync);
    return () => {
      alive = false;
      window.removeEventListener('tof-drop-updated', sync);
    };
  }, []);

  return (
    <section className="relative min-h-[90svh] lg:min-h-[calc(100svh-140px)] flex items-center overflow-hidden bg-bg py-10 sm:py-14 lg:py-20">
      {/* Blobs */}
      <div className="absolute top-20 right-[-10%] w-[500px] h-[500px] bg-accent/10 anim-blob opacity-60 pointer-events-none" />
      <div className="absolute bottom-10 left-[-5%] w-[300px] h-[300px] bg-orange-200/30 anim-blob opacity-40 pointer-events-none" style={{ animationDelay: '4s' }} />

      <div className="relative z-10 mx-auto max-w-6xl px-5 w-full">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center py-10 lg:py-0">
          {/* Text */}
          <div className="space-y-6 sm:space-y-7">
            <div className="anim-fade-up opacity-0">
              <span className="inline-flex items-center gap-2 bg-accent/10 text-accent rounded-full px-4 py-2 text-xs font-semibold">
                <Sparkles size={13} />
                {settings.heroBadge}
              </span>
            </div>

            <h1 className="anim-fade-up opacity-0 delay-200 font-display text-[2.5rem] sm:text-6xl lg:text-7xl font-800 leading-[0.95] tracking-tight text-dark">
              {settings.heroTitleStart}{' '}
              <span className="relative inline-block">
                {settings.heroTitleHighlight}
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none">
                  <path d="M2 8c40-6 80-6 196-2" stroke="#e84d1a" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>

            <p className="anim-fade-up opacity-0 delay-400 text-dark/60 text-base sm:text-lg max-w-md leading-relaxed">
              {settings.heroDescription}
            </p>

            <p className="anim-fade-up opacity-0 delay-500 text-sm font-semibold text-dark/45">
              {settings.heroSubnote}
            </p>

            <div className="anim-fade-up opacity-0 delay-600 flex flex-wrap gap-3">
              <a
                href="#shop"
                className="bg-dark text-white px-7 h-12 rounded-full text-sm font-bold hover:bg-accent transition-colors shadow-lg shadow-dark/10 flex items-center justify-center active:scale-[0.98] anim-pulse-ring"
              >
                Voir le shop →
              </a>
              <a
                href={settings.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="border-2 border-dark/10 text-dark h-12 px-7 rounded-full text-sm font-bold hover:border-accent hover:text-accent transition-colors flex items-center justify-center active:scale-[0.98]"
              >
                Nous contacter
              </a>
            </div>

            {/* Trust badges */}
            <div className="anim-fade-up opacity-0 delay-700 flex flex-wrap items-center gap-2 pt-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-[11px] font-semibold text-dark/50 border border-dark/5">
                <span className="text-green-500">✓</span> QC avant paiement
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-[11px] font-semibold text-dark/50 border border-dark/5">
                <span className="text-green-500">✓</span> PayPal protection acheteur
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-[11px] font-semibold text-dark/50 border border-dark/5">
                <span className="text-green-500">✓</span> Livraison suivie
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-[11px] font-semibold text-dark/50 border border-dark/5">
                <span className="text-green-500">✓</span> 10-20 jours
              </div>
            </div>

            {/* Honest opening note */}
            <div className="anim-fade-up opacity-0 delay-800 flex items-center gap-2 pt-1">
              <p className="text-xs text-dark/40 max-w-md">
                <span className="font-bold text-dark/60">Nouveau shop</span> — pour les 5 premières commandes,
                <span className="text-accent font-bold"> -15% avec le code TOFLAUNCH</span>.
              </p>
            </div>
          </div>

          {/* Image placeholder + floating brand pills */}
          <div className={`relative ${dropImg ? 'lg:block' : 'hidden lg:block'} anim-fade-in opacity-0 delay-300`}>
            <div className="relative flex justify-center">
              {/* Floating brand pills */}
              {floatingBrands.map((b) => (
                <div
                  key={b.name}
                  className="absolute bg-white shadow-lg shadow-dark/5 rounded-full px-4 py-2 text-[11px] font-bold text-dark/60 border border-dark/5 anim-float z-20 hidden xl:flex items-center"
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
                <div className="aspect-[3/4] w-[min(380px,80vw)] rounded-[2rem] bg-gradient-to-br from-subtle to-white overflow-hidden flex items-center justify-center border border-dark/5 shadow-xl shadow-dark/5">
                  {dropImg ? (
                    <img
                      src={dropImg.imageUrl}
                      alt={`${dropImg.brand} ${dropImg.name}`}
                      className="h-full w-full object-cover"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      width={380}
                      height={507}
                    />
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent-light/5" />
                      <div className="relative text-center space-y-4 p-8">
                        <div className="mx-auto h-20 w-20 rounded-[1.5rem] bg-white shadow-xl shadow-dark/5 flex items-center justify-center">
                          <AppleEmoji emoji="👟" size={44} className="mx-auto" />
                        </div>
                        <div>
                          <p className="text-dark/30 text-xs font-bold uppercase tracking-widest mb-1">Drop de la semaine</p>
                          <p className="text-dark/50 text-sm font-semibold">Découvre la sélection</p>
                        </div>
                        <a href="#shop" className="inline-flex items-center gap-1.5 bg-dark text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-accent transition-colors">
                          Voir <ArrowDown size={12} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl shadow-dark/5 px-4 sm:px-5 py-3 border border-dark/5 anim-float z-20">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
                      <AppleEmoji emoji="🔥" size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-dark">{settings.heroStatValue}</div>
                      <div className="text-[10px] text-dark/40 font-semibold">{settings.heroStatLabel}</div>
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

      {/* Scroll indicator */}
      <div className="absolute bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2">
        <a href="#shop" aria-label="Défiler vers le shop" className="h-10 w-10 rounded-full bg-white/70 backdrop-blur border border-dark/5 flex items-center justify-center text-dark/30 hover:text-accent transition-colors">
          <ArrowDown size={16} strokeWidth={2.5} className="animate-bounce" />
        </a>
      </div>
    </section>
  );
}
