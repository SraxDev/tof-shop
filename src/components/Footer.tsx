import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function Footer() {
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
    <footer className="bg-dark text-white/30 py-12 pb-28 md:pb-12">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="font-display text-2xl font-800 text-white tracking-tight">
              tof<span className="text-accent">.</span>
            </span>
            <p className="text-sm mt-1 text-white/20">ton drip, toujours.</p>
          </div>

          <div className="flex gap-4">
            <a href={settings.snapchatUrl} className="h-10 px-4 bg-[#FFFC00]/10 hover:bg-[#FFFC00]/20 border border-[#FFFC00]/15 rounded-full flex items-center gap-2 text-sm font-semibold text-[#FFFC00]/70 hover:text-[#FFFC00] transition-colors">
              👻 Snap
            </a>
            <a href={settings.whatsappUrl} className="h-10 px-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/15 rounded-full flex items-center gap-2 text-sm font-semibold text-[#25D366]/70 hover:text-[#25D366] transition-colors">
              💬 WhatsApp
            </a>
          </div>
        </div>

        <div className="border-t border-white/5 mt-8 pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/15 uppercase tracking-wider mr-1">Paiement</span>
              {['PayPal'].map((p) => (
                <div
                  key={p}
                  className="h-7 px-2.5 bg-white/5 rounded-md flex items-center justify-center text-[9px] font-bold text-white/25 tracking-wide border border-white/5"
                >
                  {p}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-white/15">
              <span>© {new Date().getFullYear()} tof.</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
