import { MessageCircle, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';
import { cartCount, openCart, readCart } from '../lib/cart';

export default function MobileStickyBar() {
  const [settings, setSettings] = useState(readSiteSettings);
  const [count, setCount] = useState(() => cartCount(readCart()));

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    const syncCart = () => setCount(cartCount(readCart()));
    window.addEventListener('tof-settings-updated', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('tof-cart-updated', syncCart);
    window.addEventListener('storage', syncCart);
    document.body.classList.add('has-sticky-bar');
    return () => {
      window.removeEventListener('tof-settings-updated', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('tof-cart-updated', syncCart);
      window.removeEventListener('storage', syncCart);
      document.body.classList.remove('has-sticky-bar');
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden safe-bottom">
      <div className="grid grid-cols-3 gap-2 rounded-[22px] bg-dark/90 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl border border-white/10 ring-1 ring-black/5">
        <a
          href="#shop"
          className="flex items-center justify-center gap-1.5 rounded-[18px] bg-white text-dark py-3.5 text-[12px] font-900 active:scale-[0.97] transition-all shadow-xl min-h-[48px]"
        >
          <ShoppingBag size={15} strokeWidth={2.5} /> Boutique
        </a>
        <button
          onClick={() => openCart('cart')}
          className="relative flex items-center justify-center gap-1.5 rounded-[18px] bg-accent text-white py-3.5 text-[12px] font-900 active:scale-[0.97] transition-all shadow-lg min-h-[48px]"
        >
          <ShoppingCart size={15} strokeWidth={2.5} /> Panier
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-h-[18px] min-w-[18px] px-1 rounded-full bg-white text-accent text-[9px] font-900 flex items-center justify-center shadow">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
        <a
          href={settings.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-[18px] bg-[#25D366] text-white py-3.5 text-[12px] font-900 active:scale-[0.97] transition-all shadow-lg min-h-[48px]"
        >
          <MessageCircle size={15} strokeWidth={2.5} /> WhatsApp
        </a>
      </div>
    </div>
  );
}
