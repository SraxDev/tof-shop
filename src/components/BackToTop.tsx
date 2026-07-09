import { ArrowUp } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let raf: number | null = null;
    const fn = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        setShow(window.scrollY > 600);
      });
    };
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => {
      window.removeEventListener('scroll', fn);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Retour en haut"
      className={`fixed bottom-44 md:bottom-6 right-4 md:right-20 z-[60] h-11 w-11 rounded-full bg-dark text-white shadow-xl shadow-dark/20 flex items-center justify-center transition-all duration-300 hover:bg-accent ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ArrowUp size={18} strokeWidth={2.5} />
    </button>
  );
}
