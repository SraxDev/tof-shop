import { CheckCircle2, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useInView } from '../hooks/useInView';
import { readSiteSettings, type ReviewItem } from '../lib/siteSettings';
import { fetchRecentOrders, type PublicRecentOrder } from '../lib/db';

function initials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function productLabel(order: PublicRecentOrder): string {
  try {
    const items = order.items_json ? JSON.parse(order.items_json) : [];
    if (Array.isArray(items) && items.length > 0) {
      const first = items[0] as { brand?: string; name?: string };
      const label = [first.brand, first.name].filter(Boolean).join(' ');
      if (label) return label;
    }
  } catch {
    /* ignore */
  }
  return 'une pièce du shop';
}

type AutoReview = {
  id: string;
  name: string;
  city: string;
  product: string;
  verified: boolean;
};

export default function Reviews() {
  const { ref, isInView } = useInView(0.1);
  const [settings, setSettings] = useState(readSiteSettings);
  const [autoReviews, setAutoReviews] = useState<AutoReview[]>([]);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tof-settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Avis auto : tirés des vraies commandes (prénom + ville + produit), jamais de texte inventé.
  useEffect(() => {
    if (!settings.reviewsAutoEnabled) {
      setAutoReviews([]);
      return;
    }
    let alive = true;
    fetchRecentOrders(8)
      .then((orders) => {
        if (!alive) return;
        const mapped = orders
          .filter((o) => o.first_name)
          .map<AutoReview>((o, i) => ({
            id: `auto-${o.created_at || ''}-${i}`,
            name: o.first_name.trim(),
            city: (o.city || '').trim(),
            product: productLabel(o),
            verified: true,
          }));
        setAutoReviews(mapped);
      })
      .catch(() => setAutoReviews([]));
    return () => {
      alive = false;
    };
  }, [settings.reviewsAutoEnabled]);

  const manual: ReviewItem[] = settings.reviews;
  const auto: AutoReview[] = autoReviews;

  return (
    <section className="py-14 sm:py-20 lg:py-28 bg-white" ref={ref}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl sm:text-5xl font-800 tracking-tight text-dark">
            les avis
          </h2>
          <p className="mt-3 text-dark/40">des retours clients simples, pas des phrases de robot</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Avis manuels (avec texte + étoiles) */}
          {manual.map((r, i) => (
            <div
              key={r.id}
              className={`bg-bg rounded-2xl p-5 border border-dark/5 ${
                isInView ? 'anim-fade-up opacity-0' : 'opacity-0'
              }`}
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-dark text-white flex items-center justify-center text-xs font-bold">
                    {initials(r.name)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-dark">{r.name}</div>
                    <div className="text-xs text-dark/35">{r.city}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    size={13}
                    className={j < r.stars ? 'fill-amber-400 text-amber-400' : 'fill-dark/10 text-dark/10'}
                  />
                ))}
              </div>

              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-dark/45">
                <CheckCircle2 size={12} className="text-green-500" />
                Commande vérifiée
              </div>

              {r.text && <p className="text-dark/60 text-sm leading-relaxed mb-5">"{r.text}"</p>}

              <div className="border-t border-dark/5 pt-4">
                <div className="text-[10px] uppercase tracking-wider text-dark/25 font-bold">Produit acheté</div>
                <div className="text-sm font-semibold text-dark/70 mt-1">{r.product}</div>
              </div>
            </div>
          ))}

          {/* Avis auto (vraies commandes) */}
          {auto.map((r, i) => (
            <div
              key={r.id}
              className={`bg-bg rounded-2xl p-5 border border-dark/5 ${
                isInView ? 'anim-fade-up opacity-0' : 'opacity-0'
              }`}
              style={{ animationDelay: `${(manual.length + i) * 0.12}s` }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-dark text-white flex items-center justify-center text-xs font-bold">
                    {initials(r.name)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-dark">{r.name}</div>
                    <div className="text-xs text-dark/35">{r.city}</div>
                  </div>
                </div>
              </div>

              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-dark/45">
                <CheckCircle2 size={12} className="text-green-500" />
                Commande vérifiée
              </div>

              <div className="border-t border-dark/5 pt-4">
                <div className="text-[10px] uppercase tracking-wider text-dark/25 font-bold">Produit acheté</div>
                <div className="text-sm font-semibold text-dark/70 mt-1">{r.product}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-10 lg:gap-16">
          {settings.reviewStats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-display font-800 text-dark">{s.value}</div>
              <div className="text-xs text-dark/30 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
