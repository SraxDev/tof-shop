import { ArrowDown, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AppleEmoji from './AppleEmoji';
import { readSiteSettings } from '../lib/siteSettings';
import { fetchDrop, fetchProducts, type DbDrop, type DbProduct } from '../lib/db';

const floatingBrands = [
  { name: 'Nike', top: '8%', left: '-12%', delay: '0s' },
  { name: 'Stüssy', top: '30%', left: '-16%', delay: '1.5s' },
  { name: "Arc'teryx", top: '65%', left: '-10%', delay: '3s' },
  { name: 'Jordan', top: '5%', right: '-14%', delay: '2s' },
  { name: 'Corteiz', top: '45%', right: '-16%', delay: '0.5s' },
  { name: 'Represent', top: '78%', right: '-10%', delay: '2.5s' },
];

type Slide = { imageUrl: string; brand: string; name: string };

const ROTATE_MS = 4500;

export default function Hero() {
  const [settings, setSettings] = useState(readSiteSettings);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tof-settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Charge le drop + les produits actifs pour la rotation.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [drop, products] = await Promise.all([
          fetchDrop() as Promise<DbDrop | null>,
          fetchProducts(),
        ]);
        if (!alive) return;
        const list: Slide[] = [];
        if (drop?.image_url) list.push({ imageUrl: drop.image_url, brand: drop.brand, name: drop.name });
        const withImage = (products as DbProduct[])
          .filter((p) => p.status === 'active' && p.image_url)
          .slice(0, 4);
        for (const p of withImage) {
          const first = (p.image_url || '').split('|').map((s) => s.trim()).find(Boolean);
          if (first && !list.some((s) => s.imageUrl === first)) {
            list.push({ imageUrl: first, brand: p.brand, name: p.name });
          }
        }
        setSlides(list);
      } catch {
        /* garde les slides existants */
      }
    };
    load();
    window.addEventListener('tof-drop-updated', load);
    return () => {
      alive = false;
      window.removeEventListener('tof-drop-updated', load);
    };
  }, []);

  // Rotation douce : uniquement s'il y a plusieurs slides.
  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [slides.length]);

  const active = useMemo(() => slides[index] || null, [slides, index]);

  return (
    <section className="relative min-h-[90svh] lg:min-h-[calc(100svh-140px)] flex items-center overflow-hidden py-10 sm:py-14 lg:py-20">
      {/* Dégradé animé en fond (remplace le fond uni) */}
      <div
        className="absolute inset-0 anim-gradient pointer-events-none"
        style={{
          background:
            'linear-gradient(120deg, #f6f5f2 0%, #fbe9e2 30%, #f6f5f2 55%, #fde8dc 80%, #f6f5f2 100%)',
        }}
      />
      {/* Halos qui dérivent */}
      <div className="absolute top-16 right-[-8%] w-[520px] h-[520px] rounded-full bg-accent/10 blur-3xl anim-drift pointer-events-none" />
      <div
        className="absolute bottom-8 left-[-6%] w-[320px] h-[320px] rounded-full bg-orange-200/40 blur-3xl anim-drift pointer-events-none"
        style={{ animationDelay: '6s' }}
      />

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
              {settings.trustBadges.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-[11px] font-semibold text-dark/50 border border-dark/5"
                >
                  <span className="text-green-500">✓</span> {badge}
                </div>
              ))}
            </div>

            {/* Honest opening note */}
            <div className="anim-fade-up opacity-0 delay-800 flex items-center gap-2 pt-1">
              <p className="text-xs text-dark/40 max-w-md">
                <span className="font-bold text-dark/60">Géré à la main</span> — chaque pièce est vérifiée sur photo QC avant de partir.
              </p>
            </div>
          </div>

          {/* Carrousel animé (effet vidéo : fondu + zoom lent) */}
          <div className={`relative ${active ? 'lg:block' : 'hidden lg:block'} anim-fade-in opacity-0 delay-300`}>
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
                  {active ? (
                    <div className="relative h-full w-full">
                      {slides.map((s, i) => (
                        <img
                          key={s.imageUrl}
                          src={s.imageUrl}
                          alt={`${s.brand} ${s.name}`}
                          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                            i === index ? 'opacity-100 anim-ken-burns' : 'opacity-0'
                          }`}
                          loading={i === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          fetchPriority={i === 0 ? 'high' : 'auto'}
                          width={380}
                          height={507}
                        />
                      ))}
                      {/* Indicateur de rotation */}
                      {slides.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                          {slides.map((_, i) => (
                            <span
                              key={i}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
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
                {/* Masqué sur mobile : la pastille chevauchait le bouton de chat
                    et la barre d'actions, ce qui encombrait le bas de l'écran. */}
                <div className="hidden sm:flex absolute -top-3 -right-3 bg-accent text-white rounded-xl px-4 py-2 text-xs font-bold shadow-lg shadow-accent/20 anim-float items-center gap-1.5 z-20" style={{ animationDelay: '2s' }}>
                  {settings.heroTopBadge} <AppleEmoji emoji="🚀" size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-28 sm:bottom-8 left-1/2 -translate-x-1/2">
        <a href="#shop" aria-label="Défiler vers le shop" className="h-10 w-10 rounded-full bg-white/70 backdrop-blur border border-dark/5 flex items-center justify-center text-dark/30 hover:text-accent transition-colors">
          <ArrowDown size={16} strokeWidth={2.5} className="animate-bounce" />
        </a>
      </div>
    </section>
  );
}
