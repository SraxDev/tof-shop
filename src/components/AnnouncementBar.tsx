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
    <div className="relative z-30 px-4 pt-20 sm:pt-24 safe-top">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-2xl border border-dark/5 bg-white/90 backdrop-blur-xl shadow-sm shadow-dark/5 px-5 py-3 text-center anim-fade-down">
          <p className="pr-9 text-xs sm:text-sm font-semibold text-dark/75 leading-relaxed">
            {settings.announcementText}
          </p>
          <button
            onClick={() => {
              setVisible(false);
              try { sessionStorage.setItem('tof-announcement-closed', '1'); } catch {}
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-dark/5 text-dark/35 hover:text-dark/60 hover:bg-dark/10 transition-colors flex items-center justify-center"
            aria-label="Fermer l'annonce"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
