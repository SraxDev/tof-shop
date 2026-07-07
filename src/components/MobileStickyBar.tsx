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
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      <div className="grid grid-cols-2 gap-2 rounded-full bg-dark/90 p-2 shadow-2xl shadow-dark/25 backdrop-blur-xl border border-white/10">
        <a
          href="#shop"
          className="flex items-center justify-center gap-2 rounded-full bg-white text-dark px-4 py-3 text-xs font-bold"
        >
          <ShoppingBag size={15} /> Shop
        </a>
        <a
          href={settings.whatsappUrl}
          className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white px-4 py-3 text-xs font-bold"
        >
          <MessageCircle size={15} /> WhatsApp
        </a>
      </div>
    </div>
  );
}