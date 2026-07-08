import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

// Lance date : aujourd'hui 19h — fin dans 48h
const LAUNCH_DATE = new Date();
LAUNCH_DATE.setHours(19, 0, 0, 0);
const END_DATE = new Date(LAUNCH_DATE.getTime() + 48 * 3600 * 1000);

function getTimeLeft() {
  const now = new Date();
  const diff = END_DATE.getTime() - now.getTime();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { h, m, s };
}

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  const [settings, setSettings] = useState(readSiteSettings);
  const [time, setTime] = useState(getTimeLeft);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    return () => window.removeEventListener('tof-settings-updated', sync);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!visible || !settings.announcementEnabled || !time) return null;

  return (
    <div className="relative z-[60] overflow-hidden">
      <div className="bg-dark py-2 sm:py-2.5 px-4">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <span className="text-xs sm:text-sm font-bold text-white/90 truncate">
            {settings.announcementText}
          </span>

          <div className="flex items-center gap-1 flex-shrink-0">
            {[
              { val: time.h.toString().padStart(2, '0'), label: 'h' },
              { val: time.m.toString().padStart(2, '0'), label: 'm' },
              { val: time.s.toString().padStart(2, '0'), label: 's' },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="bg-accent text-white text-[11px] sm:text-xs font-800 rounded-md px-1.5 py-0.5 tabular-nums min-w-[26px] text-center">
                  {t.val}
                </span>
                {i < 2 && <span className="text-white/30 text-xs font-bold">:</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setVisible(false)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
