import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function HowItWorks() {
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

  const steps = settings.steps;

  return (
    <section id="comment-ca-marche" className="py-14 sm:py-20 bg-bg border-t border-dark/5">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-10 sm:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-dark/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-dark/45">
            🛒 Comment ça marche
          </span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-800 tracking-tight text-dark">
            {settings.howItWorksTitle}
          </h2>
          <p className="mt-2 text-dark/45 text-sm sm:text-base max-w-lg mx-auto">
            {settings.howItWorksSubtitle}
          </p>
        </div>

        <div className="relative">
          {/* Ligne de timeline desktop */}
          <div className="hidden sm:block absolute left-[12%] right-[12%] top-[38px] h-[2px] bg-gradient-to-r from-accent/20 via-accent/40 to-accent/20" aria-hidden />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            {steps.map((step, i) => (
              <div key={step.title} className="relative flex sm:flex-col gap-4 sm:gap-0">
                {/* Pastille numérotée */}
                <div className="relative flex sm:justify-center flex-shrink-0">
                  <div className="relative z-10 h-[52px] w-[52px] sm:h-[76px] sm:w-[76px] rounded-2xl sm:rounded-3xl bg-white border border-dark/5 shadow-sm shadow-dark/5 flex items-center justify-center text-2xl sm:text-3xl">
                    {step.emoji}
                    <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-accent text-white text-[11px] font-900 flex items-center justify-center shadow-md shadow-accent/25">
                      {i + 1}
                    </span>
                  </div>
                  {/* Ligne verticale mobile */}
                  {i < steps.length - 1 && (
                    <span className="sm:hidden absolute left-[26px] top-[52px] h-[calc(100%+20px)] w-[2px] bg-dark/8" aria-hidden />
                  )}
                </div>

                <div className="flex-1 sm:mt-6 sm:text-center">
                  <div className="flex items-center sm:justify-center gap-2 mb-1.5">
                    <h3 className="font-bold text-dark text-base sm:text-lg leading-tight">{step.title}</h3>
                  </div>
                  <span className="inline-block rounded-full bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 mb-2">
                    {step.tag}
                  </span>
                  <p className="text-dark/50 text-sm leading-relaxed">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {settings.trustBadges.map((b) => (
            <span key={b} className="rounded-full bg-green-500/10 text-green-700 px-3 py-1.5 text-xs font-bold">
              ✓ {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
