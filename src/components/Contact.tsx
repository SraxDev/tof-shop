import { useEffect, useState } from 'react';
import { useInView } from '../hooks/useInView';
import AppleEmoji from './AppleEmoji';
import { readSiteSettings } from '../lib/siteSettings';

export default function Contact() {
  const { ref, isInView } = useInView(0.1);
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
    <section id="contact" className="py-14 sm:py-20 lg:py-28 bg-bg" ref={ref}>
      <div className="mx-auto max-w-4xl px-5">
        <div className={`text-center mb-12 ${isInView ? 'anim-fade-up opacity-0' : 'opacity-0'}`}>
          <h2 className="font-display text-4xl sm:text-5xl font-800 tracking-tight text-dark flex items-center justify-center gap-3">
            contacte-nous <AppleEmoji emoji="🤙" size={36} />
          </h2>
          <p className="mt-3 text-dark/40">
            Pour commander ou poser une question, passe directement par Snap ou WhatsApp
          </p>
        </div>

        <div className={`grid sm:grid-cols-2 gap-4 ${isInView ? 'anim-fade-up opacity-0 delay-200' : 'opacity-0'}`}>
          <a
            href={settings.whatsappUrl}
            className="group relative overflow-hidden rounded-3xl bg-[#25D366] p-8 min-h-56 flex flex-col justify-between text-white shadow-xl shadow-[#25D366]/15 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-800 group-hover:scale-105 transition-transform">
                W
              </div>
              <h3 className="mt-6 font-display text-3xl font-800 tracking-tight">WhatsApp</h3>
              <p className="mt-2 text-white/75 text-sm leading-relaxed">
                Finalise ta commande, envoie ton paiement ou pose-nous une question en quelques secondes.
              </p>
            </div>
            <span className="relative mt-6 text-sm font-bold">Ouvrir WhatsApp →</span>
          </a>

          <a
            href={settings.snapchatUrl}
            className="group relative overflow-hidden rounded-3xl bg-[#FFFC00] p-8 min-h-56 flex flex-col justify-between text-dark shadow-xl shadow-yellow-300/20 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/50 blur-2xl" />
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-white/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                <AppleEmoji emoji="👻" size={30} />
              </div>
              <h3 className="mt-6 font-display text-3xl font-800 tracking-tight">Snapchat</h3>
              <p className="mt-2 text-dark/55 text-sm leading-relaxed">
                Ajoute-nous sur Snap pour suivre les drops, voir les nouveautés et nous contacter rapidement.
              </p>
            </div>
            <span className="relative mt-6 text-sm font-bold">Ajouter sur Snap →</span>
          </a>
        </div>

        <p className={`mt-8 text-center text-xs text-dark/30 ${isInView ? 'anim-fade-up opacity-0 delay-400' : 'opacity-0'}`}>
          Réponse rapide sur WhatsApp et Snap pendant nos horaires d'ouverture.
        </p>
      </div>
    </section>
  );
}