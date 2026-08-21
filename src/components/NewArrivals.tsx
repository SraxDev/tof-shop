import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { readSiteSettings } from '../lib/siteSettings';
import { fetchProducts, type DbProduct } from '../lib/db';

type NewItem = {
  id: string;
  brand: string;
  name: string;
  salePrice: number;
  oldPrice?: number;
  image: string;
  isNew: boolean;
};

function toItem(d: DbProduct, newDays: number): NewItem {
  const img = (d.image_url || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';
  const createdAt = d.created_at ? new Date(d.created_at).getTime() : 0;
  const isNew = createdAt > 0 && Date.now() - createdAt < newDays * 24 * 60 * 60 * 1000;
  return {
    id: d.id,
    brand: d.brand,
    name: d.name,
    salePrice: d.sale_price,
    oldPrice: d.old_price && d.old_price > d.sale_price ? d.old_price : undefined,
    image: img,
    isNew,
  };
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export default function NewArrivals() {
  const [settings, setSettings] = useState(readSiteSettings);
  const [items, setItems] = useState<NewItem[]>([]);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tof-settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!settings.newArrivalsEnabled) return;
    let alive = true;
    fetchProducts()
      .then((rows) => {
        if (!alive) return;
        const mapped = rows
          .filter((d) => d.status === 'active')
          .map((d) => toItem(d, settings.newProductDays))
          .sort((a, b) => {
            // Les « nouveaux » d'abord, puis par prix décroissant en repli
            if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
            return b.salePrice - a.salePrice;
          })
          .slice(0, Math.max(1, settings.newArrivalsCount));
        setItems(mapped);
      })
      .catch(() => setItems([]));
    return () => {
      alive = false;
    };
  }, [settings.newArrivalsEnabled, settings.newArrivalsCount, settings.newProductDays]);

  const open = useMemo(
    () => (id: string) => {
      window.dispatchEvent(new CustomEvent('tof-open-product', { detail: id }));
    },
    [],
  );

  if (!settings.newArrivalsEnabled || items.length === 0) return null;

  return (
    <section className="py-14 sm:py-16 bg-bg border-t border-dark/5">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-800 tracking-tight text-dark flex items-center gap-2">
              🔥 {settings.newArrivalsTitle}
            </h2>
            {settings.newArrivalsSubtitle && (
              <p className="mt-1 text-dark/40 text-sm">{settings.newArrivalsSubtitle}</p>
            )}
          </div>
          <a
            href="#shop"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:underline underline-offset-4 shrink-0"
          >
            Tout voir <ArrowRight size={14} />
          </a>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x-mandatory -mx-1 px-1 pb-2">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => open(p.id)}
              className="group flex-shrink-0 w-[150px] sm:w-[180px] snap-start text-left"
            >
              <div className="relative aspect-[3/4] rounded-2xl bg-white border border-dark/5 overflow-hidden flex items-center justify-center p-3 group-hover:border-accent/25 group-hover:shadow-md transition-all">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    className="max-h-full max-w-full w-auto h-auto object-contain group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <span className="text-3xl">👟</span>
                )}
                {p.isNew && (
                  <span className="absolute top-2 left-2 bg-dark text-white text-[9px] font-900 px-2 py-1 rounded-full uppercase tracking-wider">
                    Nouveau
                  </span>
                )}
                {p.oldPrice && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-900 px-2 py-1 rounded-full">
                    -{Math.round(((p.oldPrice - p.salePrice) / p.oldPrice) * 100)}%
                  </span>
                )}
              </div>
              <p className="text-[9px] font-bold text-accent uppercase tracking-wider mt-2 truncate">{p.brand}</p>
              <p className="text-[12px] font-semibold text-dark/70 truncate leading-snug">{p.name}</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <p className="text-[13px] font-800 text-dark">{formatPrice(p.salePrice)}</p>
                {p.oldPrice && (
                  <p className="text-[11px] text-dark/30 line-through">{formatPrice(p.oldPrice)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
