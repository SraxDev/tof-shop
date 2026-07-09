import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem('tof-announcement-closed') !== '1';
    } catch {
      return true;
    }
  });
  const [settings, setSettings] = useState(readSiteSettings);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    return () => window.removeEventListener('tof-settings-updated', sync);
  }, []);

  if (!visible || !settings.announcementEnabled || !settings.announcementText.trim()) return null;

  return (
    <div className="relative z-30 px-4 pt-3">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-2xl border border-dark/5 bg-white shadow-sm shadow-dark/5 px-4 py-2.5 text-center">
          <p className="pr-8 text-xs sm:text-sm font-semibold text-dark/80 leading-snug">
            {settings.announcementText}
          </p>
          <button
            onClick={() => {
              setVisible(false);
              try { sessionStorage.setItem('tof-announcement-closed', '1'); } catch {}
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-dark/5 text-dark/35 hover:text-dark/60 hover:bg-dark/10 transition-colors flex items-center justify-center"
            aria-label="Fermer l'annonce"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
