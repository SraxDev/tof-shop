import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { fetchOutfits, fetchProducts, type DbOutfit, type DbProduct } from '../lib/db';
import { addToCart, openCart } from '../lib/cart';
import { showToast } from './Toast';

type Outfit = DbOutfit & {
  items: DbProduct[];
  totalValue: number;
  bundlePrice: number;
  discountLabel?: string;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

// Première taille disponible (ou « Unique » si aucune).
function firstSize(sizes: string): string {
  const parts = sizes.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return 'Unique';
  // Prend la première taille qui n'est pas épuisée ("41:0" = rupture)
  for (const raw of parts) {
    const [label, stock] = raw.split(':').map((x) => x.trim());
    const n = Number(stock);
    if (stock === undefined || stock === '' || Number.isNaN(n) || n > 0) return label;
  }
  return parts[0].split(':')[0].trim() || 'Unique';
}

function firstColor(colors: string): string {
  const parts = colors.split(',').map((s) => s.trim()).filter(Boolean);
  return parts[0] || 'Unique';
}

export default function Outfits() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchOutfits(), fetchProducts()])
      .then(([outfitsRaw, products]) => {
        if (!alive) return;
        const productMap = new Map(products.map((p) => [p.id, p]));
        const mapped: Outfit[] = outfitsRaw
          .filter((o) => o.active)
          .map((o) => {
            const ids = (o.product_ids || '').split(',').map((s) => s.trim()).filter(Boolean);
            const items = ids
              .map((id) => productMap.get(id))
              .filter((p): p is DbProduct => Boolean(p) && (p as DbProduct).status === 'active');
            const totalValue = items.reduce((sum, p) => sum + p.sale_price, 0);
            let bundlePrice = totalValue;
            let discountLabel: string | undefined;
            if (o.price_eur && o.price_eur > 0) {
              bundlePrice = o.price_eur;
              if (bundlePrice < totalValue) {
                discountLabel = `-${Math.round(((totalValue - bundlePrice) / totalValue) * 100)}%`;
              }
            } else if (o.discount_pct && o.discount_pct > 0) {
              bundlePrice = Math.round(totalValue * (1 - o.discount_pct / 100));
              discountLabel = `-${o.discount_pct}%`;
            }
            return { ...o, items, totalValue, bundlePrice, discountLabel };
          })
          .filter((o) => o.items.length > 0);
        setOutfits(mapped);
      })
      .catch(() => setOutfits([]));
    return () => {
      alive = false;
    };
  }, []);

  const addOutfit = (outfit: Outfit) => {
    setBusyId(outfit.id);
    const ratio = outfit.totalValue > 0 ? outfit.bundlePrice / outfit.totalValue : 1;
    for (const p of outfit.items) {
      addToCart({
        productId: p.id,
        brand: p.brand,
        name: p.name,
        category: p.category,
        salePrice: Math.round(p.sale_price * ratio),
        size: firstSize(p.sizes),
        color: firstColor(p.colors),
        quantity: 1,
        imageUrl: (p.image_url || '').split(',')[0]?.trim() || undefined,
      });
    }
    setTimeout(() => {
      setBusyId(null);
      openCart('cart');
      showToast(`Outfit ajouté au panier ✓`);
    }, 350);
  };

  const image = useMemo(
    () => (o: Outfit) =>
      o.image_url || o.items.map((i) => (i.image_url || '').split(',')[0]).filter(Boolean)[0] || '',
    [],
  );

  if (outfits.length === 0) return null;

  return (
    <section className="py-14 sm:py-20 bg-white border-t border-dark/5">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-8 sm:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-dark/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-dark/45">
            🧥 Ensembles complets
          </span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-800 tracking-tight text-dark">
            des outfits <span className="text-accent">prêts à porter</span>
          </h2>
          <p className="mt-2 text-dark/40 text-sm sm:text-base max-w-lg mx-auto">
            Tout le look en un clic, à un prix plus doux que pièce par pièce.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {outfits.map((o) => {
            const cover = image(o);
            return (
              <div
                key={o.id}
                className="group rounded-3xl bg-bg border border-dark/5 overflow-hidden hover:shadow-xl hover:shadow-dark/5 hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-white overflow-hidden flex items-center justify-center">
                  {cover ? (
                    <img
                      src={cover}
                      alt={o.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <span className="text-5xl">🧥</span>
                  )}
                  {o.discountLabel && (
                    <span className="absolute top-3 left-3 bg-red-500 text-white text-[11px] font-900 px-2.5 py-1 rounded-full shadow">
                      {o.discountLabel}
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col p-5">
                  <h3 className="font-bold text-dark text-base sm:text-lg">{o.name}</h3>
                  {o.description && (
                    <p className="mt-1 text-dark/45 text-sm leading-relaxed line-clamp-2">{o.description}</p>
                  )}

                  {/* Les pièces de l'outfit */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {o.items.map((p) => (
                      <span key={p.id} className="rounded-full bg-white border border-dark/5 px-2.5 py-1 text-[11px] font-semibold text-dark/55">
                        {p.brand} {p.name}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-dark/5 flex items-end justify-between">
                    <div>
                      {o.bundlePrice < o.totalValue && (
                        <div className="text-xs text-dark/30 line-through">
                          {formatPrice(o.totalValue)} séparément
                        </div>
                      )}
                      <div className="text-xl font-800 text-dark">{formatPrice(o.bundlePrice)}</div>
                    </div>
                    <button
                      onClick={() => addOutfit(o)}
                      disabled={busyId === o.id}
                      className="inline-flex items-center gap-2 bg-dark hover:bg-accent text-white px-4 sm:px-5 h-11 rounded-full text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      <ShoppingBag size={15} strokeWidth={2.5} />
                      {busyId === o.id ? 'Ajout…' : 'Tout prendre'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
