import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { readCart, cartCount } from '../lib/cart';
import CartDrawer from './CartDrawer';

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: 'Shop', href: '#shop' },
  { label: 'Drop', href: '#drop' },
  { label: 'Marques', href: '#marques' },
  { label: 'À propos', href: '#apropos' },
  { label: 'Contact', href: '#contact' },
];

function getSectionIds() {
  return NAV_LINKS.map((l) => l.href.replace('#', ''));
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [count, setCount] = useState(() => cartCount(readCart()));
  const [activeAnchor, setActiveAnchor] = useState<string>('shop');
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (open || cartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, cartOpen]);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const y = window.scrollY;
        setScrolled(y > 20);
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(docH > 0 ? Math.min(1, y / docH) : 0);

        // Active section detection
        const ids = getSectionIds();
        let current = ids[0];
        const offset = 120;
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= offset) {
            current = id;
          }
        }
        setActiveAnchor(current);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    const syncCart = () => setCount(cartCount(readCart()));
    window.addEventListener('tof-cart-updated', syncCart);
    window.addEventListener('storage', syncCart);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('tof-cart-updated', syncCart);
      window.removeEventListener('storage', syncCart);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const closeMenu = useCallback(() => setOpen(false), []);

  return (
    <>
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 safe-top ${
          scrolled ? 'bg-bg/85 backdrop-blur-xl shadow-sm' : 'bg-transparent'
        }`}
      >
        {/* Scroll progress */}
        <div
          className="absolute bottom-0 left-0 h-[2px] bg-accent transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
          aria-hidden
        />
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 py-3.5 sm:py-4">
          <a href="#" onClick={closeMenu} className="font-display text-3xl font-800 tracking-tight text-dark select-none">
            tof<span className="text-accent">.</span>
          </a>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => {
              const id = l.href.replace('#', '');
              const active = activeAnchor === id;
              return (
                <a
                  key={l.label}
                  href={l.href}
                  className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    active ? 'text-dark' : 'text-dark/55 hover:text-accent'
                  }`}
                >
                  {l.label}
                  {active && (
                    <span className="absolute left-4 right-4 -bottom-0.5 h-[2px] bg-accent rounded-full" />
                  )}
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCartOpen(true)}
              aria-label="Ouvrir le panier"
              className="relative h-11 w-11 rounded-full flex items-center justify-center text-dark/70 hover:text-accent hover:bg-dark/5 transition-all"
            >
              <ShoppingBag size={20} />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-h-[18px] min-w-[18px] px-1 bg-accent rounded-full text-[9px] font-bold text-white flex items-center justify-center shadow-sm">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
            <button
              onClick={() => setOpen(!open)}
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={open}
              className="md:hidden h-11 w-11 rounded-full flex items-center justify-center text-dark hover:bg-dark/5 transition-colors"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu — slide from right */}
      <div
        className={`fixed inset-0 z-[200] md:hidden transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-dark/40 backdrop-blur-sm" onClick={closeMenu} />
        <div
          className={`absolute top-0 right-0 h-full w-[85%] max-w-[340px] bg-white shadow-2xl flex flex-col ${
            open ? 'anim-slide-in-right' : ''
          }`}
          style={{ transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)' }}
        >
          <div className="flex items-center justify-between p-5 border-b border-dark/5">
            <span className="font-display text-2xl font-800 tracking-tight text-dark">
              menu<span className="text-accent">.</span>
            </span>
            <button
              onClick={closeMenu}
              aria-label="Fermer"
              className="h-11 w-11 rounded-full bg-dark/5 flex items-center justify-center text-dark active:scale-90 transition-transform"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-2">
            {NAV_LINKS.map((l, i) => (
              <a
                key={l.label}
                href={l.href}
                onClick={closeMenu}
                className="flex items-center justify-between text-4xl font-display font-800 text-dark hover:text-accent transition-colors py-2 anim-slide-up opacity-0"
                style={{ animationDelay: open ? `${i * 0.05 + 0.08}s` : '0s' }}
              >
                <span>{l.label}</span>
                <span className="text-accent text-2xl">→</span>
              </a>
            ))}
          </div>

          <div className="p-6 pt-4 border-t border-dark/5 safe-bottom">
            <p className="text-[11px] font-bold text-dark/30 uppercase tracking-[0.2em] mb-4">Nous contacter</p>
            <div className="grid grid-cols-2 gap-3">
              <a href="#contact" onClick={closeMenu} className="bg-[#25D366]/10 p-4 rounded-2xl active:scale-95 transition-transform min-h-[88px] flex flex-col justify-between">
                <p className="text-[11px] font-bold text-[#25D366] uppercase mb-1">WhatsApp</p>
                <p className="text-xs font-semibold text-dark/60">Support en direct</p>
              </a>
              <a href="#contact" onClick={closeMenu} className="bg-[#FFFC00]/10 p-4 rounded-2xl active:scale-95 transition-transform min-h-[88px] flex flex-col justify-between">
                <p className="text-[11px] font-bold text-dark/50 uppercase mb-1">Snapchat</p>
                <p className="text-xs font-semibold text-dark/60">Drops exclus</p>
              </a>
            </div>
          </div>
        </div>
      </div>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
