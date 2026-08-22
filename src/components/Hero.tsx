import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

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

  const banner = settings.heroBannerImage?.trim();
  const showBanner = Boolean(banner);

  // ── Mode BANNIÈRE (optionnel) : image pleine largeur, texte superposé ──
  if (showBanner) {
    return (
      <section className="relative bg-dark text-white">
        <div className="relative">
          <img
            src={banner}
            alt=""
            className="w-full h-auto block"
            fetchPriority="high"
            decoding="async"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, rgba(17,17,17,0) 0%, rgba(17,17,17,0.30) 40%, rgba(17,17,17,0.75) 70%, rgba(17,17,17,0.98) 100%)',
            }}
          />
          <div
            className="hidden sm:block absolute inset-x-0 top-0 h-24 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(17,17,17,0.55) 0%, rgba(17,17,17,0) 100%)' }}
          />
        </div>
        <div className="relative sm:absolute sm:inset-x-0 sm:bottom-0 z-10 mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <div className="max-w-2xl space-y-5">
            <span className="inline-flex items-center gap-2 bg-accent text-white rounded-full px-4 py-2 text-xs font-bold">
              <Sparkles size={13} />
              {settings.heroBadge}
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-800 leading-[1.02] tracking-tight">
              {settings.heroTitleStart} <span className="text-accent">{settings.heroTitleHighlight}</span>.
            </h1>
            <p className="text-white/70 text-base sm:text-lg max-w-xl leading-relaxed">
              {settings.heroDescription}
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#shop" className="bg-accent hover:bg-accent-light text-white px-7 h-12 rounded-full text-sm font-bold transition-colors shadow-lg shadow-accent/25 flex items-center justify-center active:scale-[0.98] anim-pulse-ring">
                Voir le shop →
              </a>
              <a href={settings.whatsappUrl} target="_blank" rel="noreferrer" className="border border-white/20 bg-white/5 backdrop-blur text-white h-12 px-7 rounded-full text-sm font-bold hover:border-accent hover:text-accent transition-colors flex items-center justify-center active:scale-[0.98]">
                Nous contacter
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Hero par défaut : centré, typographique, plein écran ──
  return (
    <section className="relative min-h-[88svh] flex items-center overflow-hidden py-16 sm:py-24">
      {/* Dégradé animé en fond */}
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
      {/* Glow central subtil derrière le titre */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-4xl px-5 w-full text-center">
        <div className="space-y-7 sm:space-y-8">
          {/* Badge + kicker */}
          <div className="anim-fade-up opacity-0 space-y-5">
            <span className="inline-flex items-center gap-2 bg-accent/10 text-accent rounded-full px-4 py-2 text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              {settings.heroBadge}
            </span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.35em] text-dark/35">
              Sneakers · Streetwear · Accessoires
            </span>
          </div>

          {/* Titre */}
          <h1 className="anim-fade-up opacity-0 delay-150 font-display text-5xl sm:text-7xl lg:text-8xl font-800 leading-[0.93] tracking-tight text-dark break-words">
            {settings.heroTitleStart}{' '}
            <span className="relative inline-block bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-light">
              {settings.heroTitleHighlight}
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none">
                <path d="M2 8c40-6 80-6 196-2" stroke="#e84d1a" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
            .
          </h1>

          {/* Description */}
          <p className="anim-fade-up opacity-0 delay-300 text-dark/60 text-base sm:text-xl max-w-xl mx-auto leading-relaxed">
            {settings.heroDescription}
          </p>

          {/* CTA */}
          <div className="anim-fade-up opacity-0 delay-450 flex flex-wrap justify-center gap-3">
            <a
              href="#shop"
              className="group bg-dark text-white pl-8 pr-6 h-14 rounded-full text-sm font-bold hover:bg-accent transition-colors shadow-lg shadow-dark/15 flex items-center justify-center gap-2 active:scale-[0.98] anim-pulse-ring"
            >
              Voir le shop
              <ArrowRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={settings.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="border-2 border-dark/10 text-dark h-14 px-8 rounded-full text-sm font-bold hover:border-accent hover:text-accent transition-colors flex items-center justify-center active:scale-[0.98]"
            >
              Nous contacter
            </a>
          </div>

          {/* Trust badges */}
          <div className="anim-fade-up opacity-0 delay-600 flex flex-wrap justify-center items-center gap-2">
            {settings.trustBadges.map((badge) => (
              <div
                key={badge}
                className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-[11px] font-semibold text-dark/50 border border-dark/5"
              >
                <span className="text-green-500">✓</span> {badge}
              </div>
            ))}
          </div>

          {/* Preuve sociale */}
          <div className="anim-fade-up opacity-0 delay-750 flex flex-wrap justify-center items-center gap-x-8 gap-y-3 pt-6 border-t border-dark/10">
            {settings.reviewStats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <span className="font-display font-800 text-2xl text-dark">{s.value}</span>
                <span className="text-xs text-dark/40 font-semibold">{s.label}</span>
              </div>
            ))}
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
