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
    <footer className="bg-dark text-white/40 py-12 pb-28 md:pb-12">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          <div>
            <span className="font-display text-2xl font-800 text-white tracking-tight">
              tof<span className="text-accent">.</span>
            </span>
            <p className="text-sm mt-2 text-white/30 leading-relaxed">
              Sneakers & streetwear sélectionnés pièce par pièce, vérifiés avant expédition.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold text-white/20 uppercase tracking-widest mb-3">Garanties</p>
            <ul className="space-y-1.5 text-sm">
              <li>✓ Chaque pièce vérifiée par moi</li>
              <li>✓ Paiement PayPal protection acheteur</li>
              <li>✓ Livraison suivie 10-20j, colis discret</li>
              <li>✓ Si problème, on arrange ça</li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold text-white/20 uppercase tracking-widest mb-3">Contact</p>
            <div className="flex flex-col gap-2">
              <a
                href={settings.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="h-11 px-5 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/15 rounded-full flex items-center justify-center gap-2 text-sm font-semibold text-[#25D366]/80 hover:text-[#25D366] transition-colors"
              >
                💬 WhatsApp — réponse ~5min
              </a>
              <a
                href={settings.snapchatUrl}
                target="_blank"
                rel="noreferrer"
                className="h-11 px-5 bg-[#FFFC00]/10 hover:bg-[#FFFC00]/20 border border-[#FFFC00]/15 rounded-full flex items-center justify-center gap-2 text-sm font-semibold text-[#FFFC00]/80 hover:text-[#FFFC00] transition-colors"
              >
                👻 Snapchat @tofh2b
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/20">
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="text-white/15">Paiement :</span>
            {['PayPal'].map((p) => (
              <div
                key={p}
                className="h-6 px-2.5 bg-white/5 rounded-md flex items-center justify-center text-[9px] font-bold text-white/30 tracking-wide border border-white/5"
              >
                {p}
              </div>
            ))}
          </div>
          <span>© {new Date().getFullYear()} tof.</span>
        </div>
      </div>
    </footer>
  );
}
