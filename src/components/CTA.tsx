import { useEffect, useState } from 'react';
import { useInView } from '../hooks/useInView';
import AppleEmoji from './AppleEmoji';
import { readSiteSettings } from '../lib/siteSettings';

export default function CTA() {
  const { ref, isInView } = useInView(0.2);
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
    <section className="py-14 sm:py-20 lg:py-28 bg-bg" ref={ref}>
      <div className="mx-auto max-w-6xl px-5">
        <div
          className={`relative bg-dark rounded-3xl overflow-hidden px-8 py-16 sm:px-14 sm:py-20 text-center ${
            isInView ? 'anim-fade-up opacity-0' : 'opacity-0'
          }`}
        >
          {/* Blobs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <AppleEmoji emoji="🔔" size={44} className="mx-auto block mb-6" />
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-800 text-white tracking-tight leading-tight max-w-xl mx-auto">
              {settings.ctaTitle}
            </h2>
            <p className="mt-4 text-white/40 max-w-md mx-auto">
              {settings.ctaDescription}
            </p>

            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <a
                href={settings.snapchatUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-[#FFFC00] text-dark px-7 h-12 rounded-full text-sm font-semibold hover:brightness-95 transition-all flex items-center gap-2 active:scale-[0.98]"
              >
                👻 Snapchat
              </a>
              <a
                href={settings.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-[#25D366] text-white px-7 h-12 rounded-full text-sm font-semibold hover:brightness-110 transition-all flex items-center gap-2 active:scale-[0.98]"
              >
                💬 WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
