import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function WhyUs() {
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

  const points = settings.whyUsPoints;

  return (
    <section id="apropos" className="py-14 sm:py-20 lg:py-28 bg-bg">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-800 tracking-tight text-dark">
            pourquoi <span className="text-accent">tof</span> ?
          </h2>
          <p className="mt-3 text-dark/40 max-w-md mx-auto text-sm sm:text-base">
            {settings.whyUsIntro}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {points.map((p) => (
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
