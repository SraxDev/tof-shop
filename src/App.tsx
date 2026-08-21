import { Suspense, lazy, useEffect, useState } from 'react';
import { useTwemoji } from './hooks/useTwemoji';
import { hydrateSiteSettings } from './lib/siteSettings';
import { trackVisitor } from './lib/db';
import { supabase } from './lib/supabase';
import Navbar from './components/Navbar';
import AnnouncementBar from './components/AnnouncementBar';
import Hero from './components/Hero';
import Products from './components/Products';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';
import MobileStickyBar from './components/MobileStickyBar';
import ToastContainer from './components/Toast';

// Lazy-load below-the-fold sections for faster TTI
const BrandMarquee = lazy(() => import('./components/BrandMarquee'));
const FeaturedDrop = lazy(() => import('./components/FeaturedDrop'));
const NewArrivals = lazy(() => import('./components/NewArrivals'));
const LaunchBanner = lazy(() => import('./components/LaunchBanner'));
const Brands = lazy(() => import('./components/Brands'));
const Reviews = lazy(() => import('./components/Reviews'));
const WhyUs = lazy(() => import('./components/WhyUs'));
const CTA = lazy(() => import('./components/CTA'));
const Contact = lazy(() => import('./components/Contact'));
const ChatWidget = lazy(() => import('./components/ChatWidget'));
const HowItWorks = lazy(() => import('./components/HowItWorks'));
const Faq = lazy(() => import('./components/Faq'));
const SocialProof = lazy(() => import('./components/SocialProof'));
const TrackingPage = lazy(() => import('./components/TrackingPage'));
// L'admin (~200 Ko) n'est téléchargé QUE si tu vas sur #admin.
const AdminPanel = lazy(() => import('./components/AdminPanel'));

function SectionFallback() {
  return <div className="min-h-[200px] bg-bg" aria-hidden />;
}

/** Route courante déduite du hash : '#admin', '#suivi' (ou '#suivi?order=...'), sinon la landing. */
function getRoute(): 'admin' | 'tracking' | 'home' {
  const hash = window.location.hash;
  if (hash === '#admin') return 'admin';
  if (hash === '#suivi' || hash.startsWith('#suivi?')) return 'tracking';
  return 'home';
}

function AdminAccess() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Restaure la session existante et écoute les changements
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setIsAuthed(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (authError) {
      // On distingue les causes : "identifiants incorrects" est trompeur quand
      // le vrai problème est un email non confirmé ou les inscriptions fermées.
      const raw = authError.message || '';
      const code = (authError as { code?: string }).code || '';
      let message = raw;

      if (/email not confirmed/i.test(raw) || code === 'email_not_confirmed') {
        message =
          "Ce compte existe mais son email n'est pas confirmé. "
          + 'Dans Supabase → Authentication → Users, ouvre le compte et confirme-le '
          + '(ou exécute supabase/05-confirmer-admin.sql).';
      } else if (/invalid login credentials/i.test(raw) || code === 'invalid_credentials') {
        message = 'Email ou mot de passe incorrect — vérifie aussi les espaces et les majuscules.';
      } else if (/signups? not allowed|disabled/i.test(raw)) {
        message = 'Les inscriptions sont fermées (normal). Ce compte doit être créé depuis Supabase.';
      }

      setError(message);
      return;
    }
    setPassword('');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setEmail('');
    setPassword('');
  };

  // Évite le flash de l'écran de login pendant la vérification de session
  if (isAuthed === null) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-white/15 border-t-accent animate-spin" />
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-dark text-white flex items-center justify-center px-5">
        <form onSubmit={login} className="w-full max-w-sm rounded-3xl bg-white/5 border border-white/10 p-6">
          <a href="#" className="inline-block font-display text-3xl font-800 tracking-tight text-white mb-8">
            tof<span className="text-accent">.</span>
          </a>
          <h1 className="font-display text-3xl font-800 tracking-tight">Panel admin</h1>
          <p className="mt-2 text-sm text-white/35">Accès privé.</p>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className="mt-6 w-full rounded-2xl bg-white/10 border border-white/10 px-5 h-12 text-sm text-white placeholder-white/25 outline-none focus:border-accent/60"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            autoComplete="current-password"
            required
            className="mt-3 w-full rounded-2xl bg-white/10 border border-white/10 px-5 h-12 text-sm text-white placeholder-white/25 outline-none focus:border-accent/60"
          />
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

          <button
            disabled={busy}
            className="mt-5 w-full h-12 rounded-full bg-accent px-6 text-sm font-bold text-white hover:bg-accent-light disabled:opacity-50 transition-colors"
          >
            {busy ? 'Connexion…' : 'Entrer'}
          </button>
          <a href="#" className="mt-4 block text-center text-xs text-white/25 hover:text-white/50 transition-colors py-2">
            Retour au site
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-dark min-h-screen">
      <div className="sticky top-0 z-50 bg-dark/90 backdrop-blur-xl border-b border-white/10 safe-top">
        <div className="mx-auto max-w-6xl px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2">
          <a href="#" className="font-display text-xl sm:text-2xl font-800 tracking-tight text-white">
            tof<span className="text-accent">.</span> admin
          </a>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a href="#" className="rounded-full bg-white/5 px-3 sm:px-4 py-2 h-10 flex items-center text-[11px] sm:text-xs font-semibold text-white/55 hover:text-white hover:bg-white/10 transition-colors">
              Site
            </a>
            <button onClick={logout} className="rounded-full bg-accent px-3 sm:px-4 py-2 h-10 flex items-center text-[11px] sm:text-xs font-semibold text-white hover:bg-accent-light transition-colors">
              Deco
            </button>
          </div>
        </div>
      </div>
      <Suspense fallback={<div className="p-10 text-center text-white/40 text-sm">Chargement…</div>}>
        <AdminPanel />
      </Suspense>
      <ToastContainer />
    </div>
  );
}

export default function App() {
  useTwemoji();
  const [route, setRoute] = useState<'admin' | 'tracking' | 'home'>(getRoute);

  useEffect(() => {
    hydrateSiteSettings();
    trackVisitor('shop');
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const next = getRoute();
      setRoute((prev) => {
        // Remonte en haut quand on change réellement de page
        if (prev !== next) window.scrollTo({ top: 0, behavior: 'auto' });
        return next;
      });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route === 'admin') {
    return <AdminAccess />;
  }

  if (route === 'tracking') {
    return (
      <div className="font-sans antialiased bg-bg text-dark">
        <Suspense fallback={<SectionFallback />}>
          <TrackingPage />
        </Suspense>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="font-sans antialiased bg-bg text-dark">
      <Navbar />
      {/* 📢 Barre d'annonce rotative */}
      <AnnouncementBar />
      <Hero />
      <Suspense fallback={<SectionFallback />}>
        <LaunchBanner />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <BrandMarquee />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <HowItWorks />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <NewArrivals />
      </Suspense>
      <Products />
      <Suspense fallback={<SectionFallback />}>
        <FeaturedDrop />
        <Brands />
        <Reviews />
        <WhyUs />
        <Faq />
        <CTA />
        <Contact />
      </Suspense>
      <Footer />
      <BackToTop />
      <MobileStickyBar />
      <Suspense fallback={null}>
        <ChatWidget />
        <SocialProof />
      </Suspense>

      <ToastContainer />
    </div>
  );
}
