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
          <div className="md:hidden bg-bg border-t border-dark/5 px-5 pb-6 pt-2">
          {['Shop', 'Marques', 'À propos', 'Contact'].map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase().replace('à propos', 'apropos')}`}
              onClick={() => setOpen(false)}
              className="block py-3 text-dark/70 font-medium border-b border-dark/5 last:border-0"
            >
              {l}
            </a>
          ))}
          </div>
        )}
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
