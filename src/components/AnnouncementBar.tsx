import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  const [settings, setSettings] = useState(readSiteSettings);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    return () => window.removeEventListener('tof-settings-updated', sync);
  }, []);

  if (!visible || !settings.announcementEnabled) return null;

  return (
    <div className="relative z-30 px-4 pt-20 sm:pt-24">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-2xl border border-dark/5 bg-white/90 backdrop-blur-xl shadow-sm shadow-dark/5 px-5 py-3 text-center">
          <p className="pr-8 text-xs sm:text-sm font-semibold text-dark/75 leading-relaxed">
            {settings.announcementText}
          </p>
          <button
            onClick={() => setVisible(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-dark/5 text-dark/35 hover:text-dark/60 transition-colors flex items-center justify-center"
            aria-label="Fermer l'annonce"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
