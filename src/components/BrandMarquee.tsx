import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function BrandMarquee() {
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

  const brands = settings.brandNames;

  return (
    <div className="py-6 bg-dark overflow-hidden">
      <div className="flex anim-marquee whitespace-nowrap">
        {[...brands, ...brands].map((b, i) => (
          <span key={i} className="mx-6 text-xs font-semibold tracking-[0.2em] text-white/30 flex-shrink-0">
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
