import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

/**
 * Barre d'annonce rotative.
 * - Le texte configuré dans l'admin peut contenir plusieurs messages séparés par « | »
 *   (ex : "Livraison offerte dès 140€ | Réponse en 5 min sur WhatsApp")
 * - À défaut, une rotation par défaut est affichée quand l'annonce est activée.
 */
const FALLBACK_MESSAGES = [
  '🚚 Livraison suivie offerte dès 140€ d\u2019achat',
  '💬 Une question ? Réponse en ~5 min sur WhatsApp et Snap',
  '💳 Paiement carte sécurisé via SumUp — CB, Apple Pay, Google Pay',
  '🔍 Chaque pièce vérifiée sur photo QC avant expédition',
];

const ROTATE_MS = 4500;

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem('tof-announcement-closed') !== '1';
    } catch {
      return true;
    }
  });
  const [settings, setSettings] = useState(readSiteSettings);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    return () => window.removeEventListener('tof-settings-updated', sync);
  }, []);

  const messages = useMemo(() => {
    const custom = (settings.announcementText || '')
      .split('|')
      .map((m) => m.trim())
      .filter(Boolean);
    return custom.length > 0 ? custom : FALLBACK_MESSAGES;
  }, [settings.announcementText]);

  useEffect(() => {
    if (messages.length < 2) return;
    const interval = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length);
        setFading(false);
      }, 280);
    }, ROTATE_MS);
    return () => window.clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
    setIndex(0);
  }, [messages.length]);

  if (!visible || !settings.announcementEnabled) return null;

  return (
    <div className="relative z-30 px-4 pt-3">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-2xl border border-dark/5 bg-white shadow-sm shadow-dark/5 px-4 py-2.5 flex items-center justify-center gap-3 overflow-hidden">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-green-600 bg-green-500/10 rounded-full px-2.5 py-1 flex-shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            En ligne · répond ~5min
          </span>

          <p
            key={index}
            className={`pr-8 text-xs sm:text-sm font-semibold text-dark/80 leading-snug text-center transition-all duration-300 ${
              fading ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'
            }`}
          >
            {messages[index]}
          </p>

          {/* Indicateurs de rotation */}
          {messages.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
              {messages.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? 'w-4 bg-accent' : 'w-1.5 bg-dark/12'
                  }`}
                  aria-hidden
                />
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setVisible(false);
              try {
                sessionStorage.setItem('tof-announcement-closed', '1');
              } catch {
                /* ignore */
              }
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-dark/5 text-dark/35 hover:text-dark/60 hover:bg-dark/10 transition-colors flex items-center justify-center"
            aria-label="Fermer l'annonce"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
