import { Heart, Search, ShoppingBag, X, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useInView } from '../hooks/useInView';
import AppleEmoji from './AppleEmoji';
import { addToCart, syncCartWithProducts } from '../lib/cart';
import { fetchProducts, fetchOrders, type DbProduct } from '../lib/db';

type Product = {
  id: string;
  brand: string;
  name: string;
  category: string;
  gender: string;
  salePrice: number;
  sizes?: string;
  colors?: string;
  imageUrl?: string;
  status: string;
  createdAt?: string;
  orderCount?: number;
};

const INITIAL_SHOW = 8;

const genderFilters = ['Tout', 'Homme', 'Femme', 'Mixte'] as const;
const categoryFilters = [
  'Tout',
  'T-shirts',
  'Hoodies & pulls',
  'Vestes',
  'Pantalons',
  'Maillots',
  'Robes & jupes',
  'Sneakers',
  'Sacs',
  'Accessoires',
] as const;

function matchesGender(productGender: string, activeGender: string) {
  const g = (productGender || 'mixte').toLowerCase();
  if (activeGender === 'Tout') return true;
  if (activeGender === 'Homme') return g === 'homme';
  if (activeGender === 'Femme') return g === 'femme';
  if (activeGender === 'Mixte') return g === 'mixte';
  return true;
}

function matchesCategory(category: string, activeCategory: string) {
  const c = category.toLowerCase();
  if (activeCategory === 'Tout') return true;
  if (activeCategory === 'T-shirts') return ['t-shirt', 'polo', 'chemise'].some((w) => c.includes(w));
  if (activeCategory === 'Hoodies & pulls') return ['hoodie', 'pull', 'jogging', 'ensemble'].some((w) => c.includes(w));
  if (activeCategory === 'Vestes') return ['veste', 'doudoune'].some((w) => c.includes(w));
  if (activeCategory === 'Pantalons') return ['jean', 'pantalon', 'short'].some((w) => c.includes(w));
  if (activeCategory === 'Maillots') return ['maillot'].some((w) => c.includes(w));
  if (activeCategory === 'Robes & jupes') return ['robe', 'jupe'].some((w) => c.includes(w));
  if (activeCategory === 'Sneakers') return ['sneaker', 'chaussure', 'claquette'].some((w) => c.includes(w));
  if (activeCategory === 'Sacs') return ['sac', 'sacoche', 'portefeuille'].some((w) => c.includes(w));
  if (activeCategory === 'Accessoires') return ['casquette', 'bonnet', 'ceinture', 'lunettes', 'bijoux', 'montre', 'écharpe', 'parfum'].some((w) => c.includes(w));
  return true;
}

function dbToShopProduct(d: DbProduct): Product {
  return { id: d.id, brand: d.brand, name: d.name, category: d.category, gender: d.gender || 'mixte', salePrice: d.sale_price, sizes: d.sizes, colors: d.colors, imageUrl: d.image_url || '', status: d.status, createdAt: d.created_at };
}

async function loadProducts(): Promise<Product[]> {
  try {
    const [data, orders] = await Promise.all([fetchProducts(), fetchOrders()]);
    const orderCounts = new Map<string, number>();
    orders.forEach((o) => {
      orderCounts.set(o.product_id, (orderCounts.get(o.product_id) || 0) + 1);
    });
    return data.map((d) => ({ ...dbToShopProduct(d), orderCount: orderCounts.get(d.id) || 0 }));
  } catch {
    return [];
  }
}

function isNew(product: Product) {
  if (!product.createdAt) return false;
  const diff = Date.now() - new Date(product.createdAt).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000; // 7 jours
}

function getBadge(product: Product): { text: string; color: string } | null {
  if ((product.orderCount || 0) >= 5) return { text: 'Best-seller', color: 'bg-green-600' };
  if ((product.orderCount || 0) >= 2) return { text: 'Populaire', color: 'bg-accent' };
  if (isNew(product)) return { text: 'Nouveau', color: 'bg-dark' };
  return null;
}

function emojiForCategory(category: string) {
  const lower = category.toLowerCase();
  if (lower.includes('sneaker') || lower.includes('chaussure') || lower.includes('claquette')) return '👟';
  if (lower.includes('t-shirt') || lower.includes('polo') || lower.includes('chemise')) return '👕';
  if (lower.includes('hoodie') || lower.includes('pull') || lower.includes('veste') || lower.includes('doudoune')) return '🧥';
  if (lower.includes('sac') || lower.includes('sacoche')) return '👜';
  if (lower.includes('casquette') || lower.includes('bonnet')) return '🧢';
  if (lower.includes('jean') || lower.includes('pantalon') || lower.includes('short') || lower.includes('jogging')) return '👖';
  if (lower.includes('robe') || lower.includes('jupe')) return '👗';
  if (lower.includes('maillot')) return '🩱';
  if (lower.includes('montre')) return '⌚';
  if (lower.includes('lunettes')) return '🕶️';
  if (lower.includes('parfum')) return '🧴';
  if (lower.includes('bijoux')) return '💍';
  return '👕';
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function parseSplit(str?: string) {
  return (str || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function needsSize(product: Product) {
  return parseSplit(product.sizes).length > 0;
}

function needsColor(product: Product) {
  return parseSplit(product.colors).length > 0;
}

export default function Products() {
  const { ref, isInView } = useInView(0.05);
  const [activeGender, setActiveGender] = useState<(typeof genderFilters)[number]>('Tout');
  const [activeCategory, setActiveCategory] = useState<(typeof categoryFilters)[number]>('Tout');
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [quickAdd, setQuickAdd] = useState<Product | null>(null);
  const [addedId, setAddedId] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  useEffect(() => {
    const loadAndSync = async () => {
      const loaded = await loadProducts();
      setProducts(loaded);
      syncCartWithProducts(loaded.map((p) => p.id));
    };
    loadAndSync();
    const sync = () => { loadAndSync(); };
    window.addEventListener('tof-products-updated', sync);
    return () => { window.removeEventListener('tof-products-updated', sync); };
  }, []);

  const allFiltered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      if (p.status !== 'active') return false;
      if (!matchesGender(p.gender, activeGender)) return false;
      if (!matchesCategory(p.category, activeCategory)) return false;
      if (q && !`${p.brand} ${p.name} ${p.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeGender, activeCategory, search]);

  const visibleProducts = showAll ? allFiltered : allFiltered.slice(0, INITIAL_SHOW);
  const totalFiltered = allFiltered.length;

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openQuickAdd = (p: Product) => {
    const sizes = parseSplit(p.sizes);
    const colors = parseSplit(p.colors);
    setQuickAdd(p);
    setSelectedSize(sizes[0] || '');
    setSelectedColor(colors[0] || '');
  };

  const canAdd = () => {
    if (!quickAdd) return false;
    if (needsSize(quickAdd) && !selectedSize) return false;
    if (needsColor(quickAdd) && !selectedColor) return false;
    return true;
  };

  const handleAddToCart = () => {
    if (!quickAdd || !canAdd()) return;
    addToCart({
      productId: quickAdd.id,
      brand: quickAdd.brand,
      name: quickAdd.name,
      category: quickAdd.category,
      salePrice: quickAdd.salePrice,
      size: selectedSize || 'Unique',
      color: selectedColor || 'Unique',
      quantity: 1,
    });
    setAddedId(quickAdd.id);
    setTimeout(() => {
      setQuickAdd(null);
      setAddedId('');
    }, 800);
  };

  const quickSizes = quickAdd ? parseSplit(quickAdd.sizes) : [];
  const quickColors = quickAdd ? parseSplit(quickAdd.colors) : [];

  return (
    <section id="shop" className="py-14 sm:py-20 lg:py-28 bg-bg" ref={ref}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl font-800 tracking-tight text-dark flex items-center gap-3">
              le shop <AppleEmoji emoji="🛒" size={36} />
            </h2>
            <p className="mt-2 text-dark/40">choisis ta pièce, ajoute au panier</p>
          </div>
        </div>

        {/* Recherche */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/25" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
            placeholder="Rechercher..."
            className="w-full rounded-2xl bg-white border border-dark/5 pl-10 pr-10 py-3 text-sm outline-none focus:border-accent/30 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-dark/5 flex items-center justify-center text-dark/40 hover:text-dark">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
          {genderFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => { setActiveGender(filter); setShowAll(false); }}
              className={`px-3 py-2 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeGender === filter ? 'bg-dark text-white' : 'bg-dark/5 text-dark/50 hover:bg-dark/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          {categoryFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => { setActiveCategory(filter); setShowAll(false); }}
              className={`px-3 py-2 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeCategory === filter ? 'bg-accent text-white' : 'bg-dark/5 text-dark/50 hover:bg-dark/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
          <span className="text-dark/30">{totalFiltered} produit{totalFiltered > 1 ? 's' : ''}</span>
          {search && (
            <>
              <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">“{search}”</span>
            </>
          )}
        </div>

        {/* Grille produits */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {visibleProducts.map((p, i) => (
            <div
              key={p.id}
              className={`group cursor-pointer ${isInView ? 'anim-fade-up opacity-0' : 'opacity-0'}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="relative aspect-[3/4] rounded-2xl bg-subtle overflow-hidden border border-dark/5 shadow-sm shadow-dark/5 group-hover:shadow-lg group-hover:shadow-dark/10 transition-shadow duration-300">
                <div className="absolute inset-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <AppleEmoji emoji={emojiForCategory(p.category)} size={48} />
                  )}
                </div>
                {(() => {
                  const badge = getBadge(p);
                  return badge ? <span className={`absolute top-3 left-3 ${badge.color} text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-10`}>{badge.text}</span> : null;
                })()}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLike(p.id); }}
                  className={`absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center transition-all z-10 ${
                    liked.has(p.id) ? 'bg-red-500 text-white' : 'bg-white/80 backdrop-blur text-dark/30 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Heart size={14} fill={liked.has(p.id) ? 'currentColor' : 'none'} />
                </button>
                <div className="absolute bottom-0 inset-x-0 p-3 translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300">
                  <button
                    onClick={() => openQuickAdd(p)}
                    className="w-full bg-dark hover:bg-accent text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag size={13} /> Ajouter
                  </button>
                </div>
              </div>
              <button onClick={() => openQuickAdd(p)} className="pt-3 px-1 text-left w-full">
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider">{p.brand}</span>
                <h3 className="text-sm font-medium text-dark/80 mt-0.5 leading-snug">{p.name}</h3>
                <span className="text-sm font-800 text-dark mt-1 block">{formatPrice(p.salePrice)}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Voir tout / moins */}
        {totalFiltered > INITIAL_SHOW && (
          <div className="text-center mt-10">
            <button
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center gap-2 bg-dark text-white px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-accent transition-colors"
            >
              {showAll ? 'Voir moins' : `Voir tout (${totalFiltered})`}
              <ChevronDown size={16} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}

        {totalFiltered === 0 && (
          <div className="rounded-3xl bg-white border border-dark/5 p-10 text-center text-dark/40">
            Aucun produit ne correspond à <span className="font-semibold text-dark/60">{activeGender}</span> dans <span className="font-semibold text-dark/60">{activeCategory}</span>{search ? ` pour “${search}”` : ''}.
          </div>
        )}
      </div>

      {/* Page détail produit */}
      {quickAdd && (
        <div className="fixed inset-0 z-[80] bg-white sm:bg-dark/60 sm:backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-5">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl shadow-2xl overflow-y-auto max-h-full flex flex-col">
            {/* Image */}
            <div className="relative aspect-square sm:aspect-[4/3] bg-subtle flex-shrink-0">
              {quickAdd.imageUrl ? (
                <img src={quickAdd.imageUrl} alt={quickAdd.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <AppleEmoji emoji={emojiForCategory(quickAdd.category)} size={80} />
                </div>
              )}
              <button onClick={() => setQuickAdd(null)} className="absolute top-4 left-4 h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-dark/60 hover:text-dark shadow-sm">
                <X size={20} />
              </button>
              {(() => {
                const badge = getBadge(quickAdd);
                return badge ? <span className={`absolute top-4 right-4 ${badge.color} text-white text-xs font-bold px-3 py-1.5 rounded-full`}>{badge.text}</span> : null;
              })()}
            </div>

            {/* Infos */}
            <div className="p-5 sm:p-6 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent">{quickAdd.brand}</span>
              <h2 className="font-display text-2xl font-800 text-dark mt-1 leading-tight">{quickAdd.name}</h2>

              <div className="flex items-center gap-3 mt-3">
                <span className="text-2xl font-800 text-dark">{formatPrice(quickAdd.salePrice)}</span>
                <span className="text-xs text-dark/30 rounded-full bg-dark/5 px-2.5 py-1">{quickAdd.category}</span>
              </div>

              {/* Infos livraison */}
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-dark/40 bg-bg rounded-full px-3 py-1.5">
                  <span className="text-green-500">✓</span> Livraison suivie
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-dark/40 bg-bg rounded-full px-3 py-1.5">
                  <span className="text-green-500">✓</span> QC avant envoi
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-dark/40 bg-bg rounded-full px-3 py-1.5">
                  <span className="text-green-500">✓</span> Paiement WhatsApp
                </div>
              </div>

              {/* Tailles */}
              {quickSizes.length > 0 && (
                <div className="mt-5">
                  <label className="text-xs font-bold text-dark/45 block mb-2">Taille</label>
                  <div className="flex flex-wrap gap-2">
                    {quickSizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        className={`h-11 min-w-12 rounded-xl px-3.5 text-sm font-semibold border-2 transition-all ${
                          selectedSize === s ? 'bg-dark text-white border-dark' : 'bg-white text-dark/60 border-dark/10 hover:border-dark/30'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Couleurs */}
              {quickColors.length > 0 && (
                <div className="mt-4">
                  <label className="text-xs font-bold text-dark/45 block mb-2">Couleur</label>
                  <div className="flex flex-wrap gap-2">
                    {quickColors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        className={`h-11 rounded-xl px-4 text-sm font-semibold border-2 transition-all ${
                          selectedColor === c ? 'bg-dark text-white border-dark' : 'bg-white text-dark/60 border-dark/10 hover:border-dark/30'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!canAdd() && (quickSizes.length > 0 || quickColors.length > 0) && (
                <p className="text-xs text-accent font-semibold mt-4">
                  {quickSizes.length > 0 && !selectedSize ? 'Sélectionne une taille' : ''}
                  {quickSizes.length > 0 && !selectedSize && quickColors.length > 0 && !selectedColor ? ' et ' : ''}
                  {quickColors.length > 0 && !selectedColor ? 'une couleur' : ''}
                </p>
              )}

              {/* Détails */}
              <div className="mt-5 pt-5 border-t border-dark/5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark/40">Délai de livraison</span>
                  <span className="font-semibold text-dark/70">7 à 20 jours</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark/40">Livraison offerte dès</span>
                  <span className="font-semibold text-dark/70">100€</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark/40">Retours</span>
                  <span className="font-semibold text-dark/70">14 jours</span>
                </div>
              </div>
            </div>

            {/* Bouton sticky */}
            <div className="sticky bottom-0 bg-white border-t border-dark/5 p-4 safe-bottom">
              <button
                onClick={handleAddToCart}
                disabled={!canAdd()}
                className={`w-full rounded-full px-7 py-4 text-sm font-bold text-white transition-colors flex items-center justify-center gap-2 ${
                  addedId ? 'bg-green-500' : !canAdd() ? 'bg-dark/20 cursor-not-allowed' : 'bg-dark hover:bg-accent'
                }`}
              >
                {addedId ? '✓ Ajouté au panier !' : <><ShoppingBag size={16} /> Ajouter au panier — {formatPrice(quickAdd.salePrice)}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
