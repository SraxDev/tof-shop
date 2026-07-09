import { useEffect, useState } from 'react';

/**
 * Timer d'offre d'ouverture.
 *
 * 🛠️ Pour relancer le compteur à 48h :
 *   - Option 1 (recommandé) : va dans l'admin → onglet "Réglages" et clique sur
 *     "Relancer l'offre 48h" OU change la date de fin manuellement.
 *   - Option 2 (rapide, sans passer par l'admin) : change la valeur de
 *     DEFAULT_END_MS ci-dessous en `Date.now() + 48 * 60 * 60 * 1000`,
 *     sauvegarde et redéploie.
 *
 * Quand le timer atteint 0 la bannière disparaît automatiquement.
 */
const STORAGE_KEY = 'tof-offer-end-v2'; // v2 pour ignorer l'ancienne valeur qui était décalée

function getEndDate(): Date {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const t = Number(stored);
      if (!Number.isNaN(t) && t > Date.now()) return new Date(t);
    }
  } catch { /* ignore */ }
  // Par défaut : 48h à partir du chargement de la page.
  const end = new Date(Date.now() + 48 * 60 * 60 * 1000);
  try { localStorage.setItem(STORAGE_KEY, String(end.getTime())); } catch { /* ignore */ }
  return end;
}

/** Export utilisé par le panneau admin pour relancer/modifier l'offre. */
export function setOfferEndDate(date: Date) {
  try { localStorage.setItem(STORAGE_KEY, String(date.getTime())); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('tof-offer-tick'));
}

export function resetOfferTo48h() {
  setOfferEndDate(new Date(Date.now() + 48 * 60 * 60 * 1000));
}

export function clearOffer() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('tof-offer-tick'));
}

type TimeLeft = {
  hours: string;
  minutes: string;
  seconds: string;
};

function formatDiff(diff: number): TimeLeft {
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

function getTimeLeft(): TimeLeft | null {
  const end = getEndDate();
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return null;
  return formatDiff(diff);
}

function TimerCells({ timeLeft, compact = false }: { timeLeft: TimeLeft; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 sm:gap-2`}>
      {[
        { label: 'h', value: timeLeft.hours },
        { label: 'm', value: timeLeft.minutes },
        { label: 's', value: timeLeft.seconds },
      ].map((item, i) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={`${compact ? 'min-w-[38px] px-2 py-1 rounded-lg' : 'min-w-[64px] sm:min-w-[74px] px-3 py-2 rounded-2xl'} bg-white/10 border border-white/10 text-center`}>
            <div className={`${compact ? 'text-sm sm:text-base' : 'text-xl sm:text-2xl'} font-800 tracking-tight tabular-nums text-white`}>
              {item.value}
            </div>
            {!compact && (
              <div className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">
                {item.label === 'h' ? 'heures' : item.label === 'm' ? 'minutes' : 'secondes'}
              </div>
            )}
          </div>
          {i < 2 && <span className="text-white/25 font-bold">:</span>}
        </div>
      ))}
    </div>
  );
}

export default function LaunchTimer() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(getTimeLeft());
  const [compactVisible, setCompactVisible] = useState(false);

  useEffect(() => {
    const tick = () => setTimeLeft(getTimeLeft());
    const interval = setInterval(tick, 1000);
    const onStorage = () => tick();
    window.addEventListener('tof-offer-tick', tick);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('tof-offer-tick', tick);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setCompactVisible(window.scrollY > 200);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!timeLeft) return null;

  return (
    <>
      {/* Grand bloc visible sous la nav */}
      <section className="px-4 pt-2">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl sm:rounded-3xl bg-dark text-white px-4 sm:px-6 py-3 sm:py-4 shadow-xl shadow-dark/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-white/45 font-bold">
                  Offre d'ouverture
                </p>
                <h3 className="mt-0.5 font-display text-lg sm:text-2xl font-800 tracking-tight leading-tight">
                  Livraison offerte + <span className="text-accent">-15%</span> avec <span className="text-accent">TOFLAUNCH</span>
                </h3>
              </div>

              <TimerCells timeLeft={timeLeft} />
            </div>
          </div>
        </div>
      </section>

      {/* Version compacte sticky au scroll */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 top-[78px] sm:top-[82px] z-40 transition-all duration-300 ${
          compactVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
      >
        <div className="rounded-full bg-dark/92 backdrop-blur-xl border border-white/10 px-3 sm:px-4 py-2 shadow-2xl shadow-dark/20">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-bold">Offre d'ouverture</div>
              <div className="text-xs font-semibold text-white/85">TOFLAUNCH -15%</div>
            </div>
            <div className="sm:hidden text-[11px] font-bold text-white/85 whitespace-nowrap">
              TOFLAUNCH -15%
            </div>
            <TimerCells timeLeft={timeLeft} compact />
          </div>
        </div>
      </div>
    </>
  );
}
