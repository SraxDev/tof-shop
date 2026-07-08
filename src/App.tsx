import { useEffect, useState } from 'react';
import { useTwemoji } from './hooks/useTwemoji';
import { hydrateSiteSettings } from './lib/siteSettings';
import { trackVisitor } from './lib/db';
import AnnouncementBar from './components/AnnouncementBar';
import LaunchTimer from './components/LaunchTimer';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import BrandMarquee from './components/BrandMarquee';
import FeaturedDrop from './components/FeaturedDrop';
import Products from './components/Products';
import Brands from './components/Brands';
import WhyUs from './components/WhyUs';
import Reviews from './components/Reviews';
import CTA from './components/CTA';
import Contact from './components/Contact';
import AdminPanel from './components/AdminPanel';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';
import MobileStickyBar from './components/MobileStickyBar';
import ToastContainer from './components/Toast';
import ChatWidget from './components/ChatWidget';


const ADMIN_PASSWORD = 'tofadmin';

function AdminAccess() {
  const [password, setPassword] = useState('');
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('tof-admin-auth') === 'true');
  const [error, setError] = useState(false);

  const login = (event: React.FormEvent) => {
    event.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('tof-admin-auth', 'true');
      setIsAuthed(true);
      setError(false);
      return;
    }
    setError(true);
  };

  const logout = () => {
    sessionStorage.removeItem('tof-admin-auth');
    setIsAuthed(false);
    setPassword('');
  };

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-dark text-white flex items-center justify-center px-5">
        <form onSubmit={login} className="w-full max-w-sm rounded-3xl bg-white/5 border border-white/10 p-6">
          <a href="#" className="inline-block font-display text-3xl font-800 tracking-tight text-white mb-8">
            tof<span className="text-accent">.</span>
          </a>
          <h1 className="font-display text-3xl font-800 tracking-tight">Panel admin</h1>
          <p className="mt-2 text-sm text-white/35">Acces prive.</p>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            className="mt-6 w-full rounded-2xl bg-white/10 border border-white/10 px-5 py-4 text-sm text-white placeholder-white/25 outline-none focus:border-accent/60"
          />
          {error && <p className="mt-3 text-sm text-red-300">Mot de passe incorrect.</p>}

          <button className="mt-5 w-full rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-white hover:bg-accent-light transition-colors">
            Entrer
          </button>
          <a href="#" className="mt-4 block text-center text-xs text-white/25 hover:text-white/50 transition-colors">
            Retour au site
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-dark min-h-screen">
      <div className="sticky top-0 z-50 bg-dark/90 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto max-w-6xl px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2">
          <a href="#" className="font-display text-xl sm:text-2xl font-800 tracking-tight text-white">
            tof<span className="text-accent">.</span> admin
          </a>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a href="#" className="rounded-full bg-white/5 px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold text-white/55 hover:text-white hover:bg-white/10 transition-colors">
              Site
            </a>
            <button onClick={logout} className="rounded-full bg-accent px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold text-white hover:bg-accent-light transition-colors">
              Deco
            </button>
          </div>
        </div>
      </div>
      <AdminPanel />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  useTwemoji();
  const [isAdminRoute, setIsAdminRoute] = useState(() => window.location.hash === '#admin');

  useEffect(() => {
    hydrateSiteSettings();
    trackVisitor('shop');
  }, []);

  useEffect(() => {
    const onHashChange = () => setIsAdminRoute(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (isAdminRoute) {
    return <AdminAccess />;
  }

  return (
    <div className="font-sans antialiased bg-bg text-dark">
      <Navbar />
      <AnnouncementBar />
      <LaunchTimer />
      <Hero />
      <BrandMarquee />
      <Products />
      <FeaturedDrop />
      <Brands />
      <Reviews />
      <WhyUs />
      <CTA />
      <Contact />
      <Footer />
      <BackToTop />
      <MobileStickyBar />
      <ChatWidget />

      <ToastContainer />
    </div>
  );
}
