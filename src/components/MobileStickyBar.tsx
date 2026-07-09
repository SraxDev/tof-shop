import { MessageCircle, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function MobileStickyBar() {
  const [settings, setSettings] = useState(readSiteSettings);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    window.addEventListener('storage', sync);
    document.body.classList.add('has-sticky-bar');
    return () => {
      window.removeEventListener('tof-settings-updated', sync);
      window.removeEventListener('storage', sync);
      document.body.classList.remove('has-sticky-bar');
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden safe-bottom">
      <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-dark/90 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl border border-white/10 ring-1 ring-black/5">
        <a
          href="#shop"
          className="flex items-center justify-center gap-2 rounded-[18px] bg-white text-dark py-3.5 text-[13px] font-900 active:scale-[0.97] transition-all shadow-xl min-h-[48px]"
        >
          <ShoppingBag size={16} strokeWidth={2.5} /> Boutique
        </a>
        <a
          href={settings.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-[18px] bg-[#25D366] text-white py-3.5 text-[13px] font-900 active:scale-[0.97] transition-all shadow-lg min-h-[48px]"
        >
          <MessageCircle size={16} strokeWidth={2.5} /> WhatsApp
        </a>
      </div>
    </div>
  );
}
