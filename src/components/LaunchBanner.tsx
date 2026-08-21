import { useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import { readSiteSettings } from '../lib/siteSettings';

function formatPrice(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function useCountdown(endsAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return useMemo(() => {
    const target = new Date(endsAt).getTime();
    if (!endsAt || Number.isNaN(target)) return null;
    const diff = target - now;
    if (diff <= 0) return null;
    const total = Math.floor(diff / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return { d, h, m, s, done: false };
  }, [endsAt, now]);
}

export default function LaunchBanner() {
  const [settings, setSettings] = useState(readSiteSettings);
  const countdown = useCountdown(settings.launchBannerEndsAt);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tof-settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!settings.launchBannerEnabled) return null;

  const hasPrice = settings.launchBannerPrice > 0;
  const showDiscount =
    settings.launchBannerOldPrice > 0 && settings.launchBannerOldPrice > settings.launchBannerPrice;

  const cells = countdown
    ? [
        { v: countdown.d, l: 'jours' },
        { v: countdown.h, l: 'heures' },
        { v: countdown.m, l: 'min' },
        { v: countdown.s, l: 'sec' },
      ]
    : null;

  return (
    <section className="py-10 sm:py-14 bg-bg">
      <div className="mx-auto max-w-6xl px-5">
        <div className="relative overflow-hidden rounded-[28px] bg-dark text-white">
          {/* halo décoratif */}
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

          <div className="relative grid lg:grid-cols-2 gap-8 items-center p-6 sm:p-10 lg:p-14">
            {/* Texte */}
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest">
                {settings.launchBannerBadge}
              </span>

              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-800 tracking-tight leading-[1.05]">
                {settings.launchBannerTitle}
              </h2>

              {settings.launchBannerDescription && (
                <p className="text-white/50 leading-relaxed max-w-md">
                  {settings.launchBannerDescription}
                </p>
              )}

              {hasPrice && (
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-800">{formatPrice(settings.launchBannerPrice)}</span>
                  {showDiscount && (
                    <span className="text-lg text-white/30 line-through">
                      {formatPrice(settings.launchBannerOldPrice)}
                    </span>
                  )}
                  {showDiscount && (
                    <span className="rounded-full bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1">
                      -{Math.round(((settings.launchBannerOldPrice - settings.launchBannerPrice) / settings.launchBannerOldPrice) * 100)}%
                    </span>
                  )}
                </div>
              )}

              {cells && (
                <div className="flex gap-2">
                  {cells.map((c) => (
                    <div
                      key={c.l}
                      className="flex flex-col items-center rounded-2xl bg-white/5 border border-white/10 px-3 py-2 min-w-[56px]"
                    >
                      <span className="text-xl sm:text-2xl font-800 tabular-nums">
                        {String(c.v).padStart(2, '0')}
                      </span>
                      <span className="text-[9px] uppercase tracking-widest text-white/35 font-bold">
                        {c.l}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <a
                href={settings.launchBannerCtaUrl}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-light text-white px-8 h-12 rounded-full text-sm font-bold transition-colors"
              >
                <Zap size={16} fill="currentColor" />
                {settings.launchBannerCtaLabel}
              </a>
            </div>

            {/* Image */}
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                {settings.launchBannerImage ? (
                  <img
                    src={settings.launchBannerImage}
                    alt={settings.launchBannerTitle}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-6xl">🔥</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
