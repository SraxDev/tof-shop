import { MessageCircle, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function MobileStickyBar() {
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
    <div className="fixed bottom-6 left-4 right-4 z-50 md:hidden pb-[env(safe-area-inset-bottom,0px)]">
      <div className="grid grid-cols-2 gap-3 rounded-[24px] bg-dark/90 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl border border-white/10 ring-1 ring-black/5">
        <a
          href="#shop"
          className="flex items-center justify-center gap-2 rounded-2xl bg-white text-dark py-4 text-[13px] font-900 active:scale-95 transition-all shadow-xl"
        >
          <ShoppingBag size={16} strokeWidth={2.5} /> Boutique
        </a>
        <a
          href={settings.whatsappUrl}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-white py-4 text-[13px] font-900 active:scale-95 transition-all shadow-lg"
        >
          <MessageCircle size={16} strokeWidth={2.5} /> WhatsApp
        </a>
      </div>
    </div>
  );
}