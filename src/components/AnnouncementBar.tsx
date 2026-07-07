import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
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

  if (!visible || !settings.announcementEnabled) return null;

  return (
    <div className="bg-dark text-white text-center py-2.5 px-5 text-xs font-medium tracking-wide relative z-[60]">
      <span className="text-white/60">
        {settings.announcementText}
      </span>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
