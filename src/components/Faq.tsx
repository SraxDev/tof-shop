import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readSiteSettings } from '../lib/siteSettings';

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [settings, setSettings] = useState(readSiteSettings);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    return () => window.removeEventListener('tof-settings-updated', sync);
  }, []);

  return (
    <section id="faq" className="py-14 sm:py-20 bg-bg border-t border-dark/5">
      <div className="mx-auto max-w-3xl px-5">
        <div className="text-center mb-8 sm:mb-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-dark/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-dark/45">
            ❓ Questions fréquentes
          </span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-800 tracking-tight text-dark">
            tout ce que tu veux <span className="text-accent">savoir</span>
          </h2>
          <p className="mt-2 text-dark/45 text-sm sm:text-base">
            Une question qui n'est pas là ? Écris-moi, je réponds en ~5 min.
          </p>
        </div>

        <div className="space-y-2.5">
          {settings.faq.map((item, i) => {
            const open = openIndex === i;
            return (
              <div
                key={item.q}
                className={`rounded-2xl bg-white border transition-all ${
                  open ? 'border-accent/25 shadow-sm shadow-accent/5' : 'border-dark/5'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left min-h-[56px]"
                >
                  <span className={`text-sm sm:text-[15px] font-bold ${open ? 'text-accent' : 'text-dark'}`}>
                    {item.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`flex-shrink-0 transition-transform duration-300 ${
                      open ? 'rotate-180 text-accent' : 'text-dark/25'
                    }`}
                  />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm text-dark/55 leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-3xl bg-dark text-white p-6 sm:p-7 text-center">
          <p className="font-display text-xl sm:text-2xl font-800">Toujours un doute ?</p>
          <p className="mt-1.5 text-white/45 text-sm">Pose ta question directement, réponse en ~5 min, 7j/7.</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2.5 justify-center">
            <a
              href={settings.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="h-12 px-7 rounded-full bg-[#25D366] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all"
            >
              💬 WhatsApp
            </a>
            <a
              href={settings.snapchatUrl}
              target="_blank"
              rel="noreferrer"
              className="h-12 px-7 rounded-full bg-[#FFFC00] text-dark text-sm font-bold flex items-center justify-center gap-2 hover:brightness-105 transition-all"
            >
              👻 Snapchat
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
