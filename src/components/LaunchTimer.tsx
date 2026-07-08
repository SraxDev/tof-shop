import { useEffect, useState } from 'react';

// Lancement : aujourd'hui à 19h, durée 48h
const launchDate = new Date();
launchDate.setHours(19, 0, 0, 0);
const endDate = new Date(launchDate.getTime() + 48 * 60 * 60 * 1000);

type TimeLeft = {
  hours: string;
  minutes: string;
  seconds: string;
};

function getTimeLeft(): TimeLeft | null {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  if (diff <= 0) return null;

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

export default function LaunchTimer() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(getTimeLeft());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!timeLeft) return null;

  return (
    <section className="px-4 pt-3">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl bg-dark text-white px-5 py-4 shadow-xl shadow-dark/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45 font-bold">
                Offre d'ouverture
              </p>
              <h3 className="mt-1 font-display text-xl sm:text-2xl font-800 tracking-tight">
                Livraison offerte + <span className="text-accent">-15%</span> avec <span className="text-accent">TOFLAUNCH</span>
              </h3>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {[
                { label: 'heures', value: timeLeft.hours },
                { label: 'minutes', value: timeLeft.minutes },
                { label: 'secondes', value: timeLeft.seconds },
              ].map((item) => (
                <div key={item.label} className="min-w-[74px] rounded-2xl bg-white/5 px-3 py-2 text-center border border-white/10">
                  <div className="text-xl sm:text-2xl font-800 tracking-tight tabular-nums">
                    {item.value}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/35 mt-0.5">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
