import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchRecentOrders, type PublicRecentOrder } from '../lib/db';

type ProofItem = {
  id: string;
  name: string;
  city: string;
  product: string;
  minutesAgo: number;
};

const FIRST_DELAY = 9000; // premier popup après 9s
const VISIBLE_MS = 6500;
const GAP_MS = 22000;

function firstName(full: string) {
  const clean = (full || '').trim();
  if (!clean) return 'Un client';
  const part = clean.split(/\s+/)[0];
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function productLabel(order: PublicRecentOrder): string {
  try {
    const items = order.items_json ? JSON.parse(order.items_json) : [];
    if (Array.isArray(items) && items.length > 0) {
      const first = items[0] as { brand?: string; name?: string };
      const label = [first.brand, first.name].filter(Boolean).join(' ');
      if (label) return items.length > 1 ? `${label} +${items.length - 1}` : label;
    }
  } catch {
    /* ignore */
  }
  return 'une pièce du shop';
}

function minutesSince(iso?: string) {
  if (!iso) return 12;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return diff < 1 ? 1 : diff;
}

function humanDelay(minutes: number) {
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} jours`;
}

export default function SocialProof() {
  const [items, setItems] = useState<ProofItem[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('tof-social-proof-off') === '1';
    } catch {
      return false;
    }
  });
  const timers = useRef<number[]>([]);

  // Charge les vraies commandes
  useEffect(() => {
    let alive = true;
    fetchRecentOrders(25)
      .then((orders) => {
        if (!alive) return;
        const mapped = orders
          .filter((o) => o.first_name)
          .map<ProofItem>((o, i) => ({
            id: `${o.created_at || ''}-${i}`,
            name: firstName(o.first_name),
            city: (o.city || '').trim(),
            product: productLabel(o),
            minutesAgo: minutesSince(o.created_at),
          }));
        setItems(mapped);
      })
      .catch(() => setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  // Cycle d'affichage
  useEffect(() => {
    if (dismissed || items.length === 0) return;
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };

    const schedule = (delay: number) => {
      const show = window.setTimeout(() => {
        setVisible(true);
        const hide = window.setTimeout(() => {
          setVisible(false);
          setIndex((i) => (i + 1) % items.length);
          schedule(GAP_MS - VISIBLE_MS);
        }, VISIBLE_MS);
        timers.current.push(hide);
      }, delay);
      timers.current.push(show);
    };

    schedule(FIRST_DELAY);
    return clear;
  }, [items, dismissed]);

  const current = useMemo(() => items[index], [items, index]);

  const close = () => {
    setVisible(false);
    setDismissed(true);
    try {
      sessionStorage.setItem('tof-social-proof-off', '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {/* Popup preuve sociale */}
      {current && !dismissed && (
        <div
          className={`fixed z-[70] left-4 bottom-[104px] md:bottom-6 md:left-6 max-w-[320px] transition-all duration-500 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="relative rounded-2xl bg-white border border-dark/5 shadow-[0_18px_40px_rgba(0,0,0,0.14)] p-3.5 pr-11 flex items-start gap-3">
            <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-accent/10 flex items-center justify-center text-lg">
              🛍️
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-dark leading-snug">
                {current.name}
                {current.city ? ` (${current.city})` : ''} a commandé
              </p>
              <p className="text-[12px] text-dark/55 truncate">{current.product}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mt-1">
                ✓ {humanDelay(current.minutesAgo)}
              </p>
            </div>
            <button
              onClick={close}
              aria-label="Masquer les notifications"
              className="absolute top-1.5 right-1.5 h-9 w-9 rounded-full bg-dark/5 text-dark/35 hover:text-dark hover:bg-dark/10 flex items-center justify-center transition-colors"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

    </>
  );
}
