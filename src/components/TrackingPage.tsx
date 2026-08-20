import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import OrderTracking from './OrderTracking';
import { readSiteSettings } from '../lib/siteSettings';

/**
 * Page dédiée « Suivi de commande » (route #suivi).
 * Séparée de la landing pour ne pas l'alourdir.
 */
export default function TrackingPage() {
  const [settings, setSettings] = useState(readSiteSettings);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    return () => window.removeEventListener('tof-settings-updated', sync);
  }, []);

  return (
    <div className="min-h-[100svh] flex flex-col bg-bg">
      {/* Header simple, sticky */}
      <header className="sticky top-0 z-50 bg-bg/95 backdrop-blur-xl border-b border-dark/5 safe-top">
        <div className="mx-auto max-w-3xl px-4 sm:px-5 h-[60px] sm:h-[68px] flex items-center justify-between gap-3">
          <a
            href="#"
            className="inline-flex items-center gap-2 h-11 px-3 -ml-3 rounded-full text-sm font-bold text-dark/60 hover:text-accent active:bg-dark/5 transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
            <span className="hidden xs:inline">Retour</span>
          </a>

          <a href="#" className="font-display text-2xl sm:text-3xl font-800 tracking-tight text-dark">
            tof<span className="text-accent">.</span>
          </a>

          <a
            href="#shop"
            className="h-11 px-4 rounded-full bg-dark text-white text-[12px] sm:text-sm font-bold flex items-center hover:bg-accent transition-colors active:scale-[0.97]"
          >
            Boutique
          </a>
        </div>
      </header>

      <main className="flex-1">
        <OrderTracking />
      </main>

      {/* Footer allégé */}
      <footer className="bg-dark text-white/40 py-8 pb-24 md:pb-8 safe-bottom">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <p className="text-xs text-white/30 leading-relaxed">
            Une question sur ta commande ? Je réponds en ~5 min, 7j/7.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5 justify-center">
            <a
              href={settings.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="h-12 px-6 rounded-full bg-[#25D366]/15 border border-[#25D366]/20 text-[#25D366] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#25D366]/25 transition-colors"
            >
              💬 WhatsApp
            </a>
            <a
              href={settings.snapchatUrl}
              target="_blank"
              rel="noreferrer"
              className="h-12 px-6 rounded-full bg-[#FFFC00]/12 border border-[#FFFC00]/20 text-[#FFFC00]/80 text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#FFFC00]/20 transition-colors"
            >
              👻 Snapchat
            </a>
          </div>
          <p className="mt-6 text-[11px] text-white/20">© {new Date().getFullYear()} tof.</p>
        </div>
      </footer>
    </div>
  );
}
