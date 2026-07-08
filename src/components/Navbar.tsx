import { useState, useEffect } from 'react';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { readCart, cartCount } from '../lib/cart';
import CartDrawer from './CartDrawer';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [count, setCount] = useState(() => cartCount(readCart()));

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn);

    const syncCart = () => setCount(cartCount(readCart()));
    window.addEventListener('tof-cart-updated', syncCart);
    window.addEventListener('storage', syncCart);

    return () => {
      window.removeEventListener('scroll', fn);
      window.removeEventListener('tof-cart-updated', syncCart);
      window.removeEventListener('storage', syncCart);
    };
  }, []);

  return (
    <>
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-bg/80 backdrop-blur-xl shadow-sm' : ''
      }`}>
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 py-4">
          <a href="#" className="font-display text-3xl font-800 tracking-tight text-dark">
            tof<span className="text-accent">.</span>
          </a>

          <div className="hidden md:flex items-center gap-8">
          {['Shop', 'Marques', 'À propos', 'Contact'].map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase().replace('à propos', 'apropos')}`}
              className="text-sm text-dark/60 hover:text-accent transition-colors font-medium"
            >
              {l}
            </a>
          ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setCartOpen(true)} className="relative p-2 text-dark/60 hover:text-accent transition-colors">
              <ShoppingBag size={20} />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-accent rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
            <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-dark">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="fixed inset-0 z-[60] bg-white anim-fade-in md:hidden flex flex-col p-6">
            <div className="flex items-center justify-between mb-12">
              <span className="font-display text-2xl font-800 tracking-tight text-dark">menu<span className="text-accent">.</span></span>
              <button onClick={() => setOpen(false)} className="h-12 w-12 rounded-full bg-dark/5 flex items-center justify-center text-dark">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              {['Shop', 'Marques', 'À propos', 'Contact'].map((l, i) => (
                <a
                  key={l}
                  href={`#${l.toLowerCase().replace('à propos', 'apropos')}`}
                  onClick={() => setOpen(false)}
                  className="text-4xl font-display font-800 text-dark hover:text-accent transition-all anim-slide-up"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {l}
                </a>
              ))}
            </div>

            <div className="mt-auto pt-8 border-t border-dark/5">
              <p className="text-[10px] font-bold text-dark/30 uppercase tracking-[0.2em] mb-4">Rejoindre la communauté</p>
              <div className="flex gap-4">
                <div className="flex-1 bg-[#25D366]/10 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-[#25D366] uppercase mb-1">WhatsApp</p>
                  <p className="text-xs font-medium text-dark/60">Support & Paiement</p>
                </div>
                <div className="flex-1 bg-[#FFFC00]/10 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-dark uppercase mb-1">Snapchat</p>
                  <p className="text-xs font-medium text-dark/60">Drops & Exclus</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
