import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  const [settings, setSettings] = useState(readSiteSettings);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tof-settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Countdown timer — ends at midnight
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) { setCountdown(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!visible || !settings.announcementEnabled) return null;

  return (
    <div className="bg-gradient-to-r from-dark via-accent to-dark text-white text-center py-2.5 px-5 relative z-[60]">
      <div className="flex items-center justify-center gap-3 text-xs sm:text-sm font-semibold">
        <span className="animate-pulse">🔥</span>
        <span>{settings.announcementText}</span>
        {countdown && (
          <span className="bg-white/20 rounded-lg px-2 py-0.5 font-800 tracking-wider tabular-nums text-[11px]">
            ⏱ {countdown}
          </span>
        )}
        <span className="animate-pulse">🔥</span>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
