import { Heart, ShoppingBag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useInView } from '../hooks/useInView';
import AppleEmoji from './AppleEmoji';
import { addToCart, syncCartWithProducts } from '../lib/cart';
import { fetchProducts, type DbProduct } from '../lib/db';

type Product = {
  id: string;
  brand: string;
  name: string;
  category: string;
  salePrice: number;
  sizes?: string;
  colors?: string;
  status: string;
};

const filters = ['Tout', 'Sneakers', 'Vetements', 'Accessoires'];

function dbToShopProduct(d: DbProduct): Product {
  return { id: d.id, brand: d.brand, name: d.name, category: d.category, salePrice: d.sale_price, sizes: d.sizes, colors: d.colors, status: d.status };
}

async function loadProducts(): Promise<Product[]> {
  try {
    const data = await fetchProducts();
    return data.map(dbToShopProduct);
  } catch {
    return [];
  }
}

function emojiForCategory(category: string) {
  const lower = category.toLowerCase();
  if (lower.includes('sneaker')) return '👟';
  if (lower.includes('t-shirt')) return '👕';
  if (lower.includes('hoodie') || lower.includes('pull') || lower.includes('veste') || lower.includes('doudoune')) return '🧥';
  if (lower.includes('sac')) return '👜';
  if (lower.includes('casquette')) return '🧢';
  if (lower.includes('jean') || lower.includes('pantalon')) return '👖';
  return '👕';
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function productMatchesFilter(product: Product, filter: string) {
  if (filter === 'Tout') return true;
  const category = product.category.toLowerCase();
  if (filter === 'Sneakers') return category.includes('sneaker');
  if (filter === 'Vetements') return ['t-shirt', 'hoodie', 'pull', 'veste', 'doudoune', 'jean', 'pantalon'].some((w) => category.includes(w));
  if (filter === 'Accessoires') return ['sac', 'casquette'].some((w) => category.includes(w));
  return true;
}

function parseSplit(str?: string) {
  return (str || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export default function Products() {
  const { ref, isInView } = useInView(0.05);
  const [active, setActive] = useState('Tout');
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
      syncCartWithProducts(loaded.map((product) => product.id));
    };

    loadAndSync();
    const sync = () => { loadAndSync(); };
    window.addEventListener('tof-products-updated', sync);
    return () => {
      window.removeEventListener('tof-products-updated', sync);
    };
  }, []);

  const visibleProducts = useMemo(
    () => products.filter((p) => p.status === 'active' && productMatchesFilter(p, active)),
    [products, active]
  );

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

  const handleAddToCart = () => {
    if (!quickAdd || !selectedSize || !selectedColor) return;
    addToCart({
      productId: quickAdd.id,
      brand: quickAdd.brand,
      name: quickAdd.name,
      category: quickAdd.category,
      salePrice: quickAdd.salePrice,
      size: selectedSize,
      color: selectedColor,
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
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-10">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl font-800 tracking-tight text-dark flex items-center gap-3">
              le shop <AppleEmoji emoji="🛒" size={36} />
            </h2>
            <p className="mt-2 text-dark/40">choisis ta pièce, ajoute au panier</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActive(f)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  active === f ? 'bg-dark text-white' : 'bg-dark/5 text-dark/50 hover:bg-dark/10'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {visibleProducts.map((p, i) => (
            <div
              key={p.id}
              className={`group cursor-pointer ${isInView ? 'anim-fade-up opacity-0' : 'opacity-0'}`}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="relative aspect-square rounded-2xl bg-subtle overflow-hidden border border-dark/5 shadow-sm shadow-dark/5 group-hover:shadow-lg group-hover:shadow-dark/10 transition-shadow duration-300">
                <div className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <AppleEmoji emoji={emojiForCategory(p.category)} size={52} />
                </div>
                <span className="absolute top-3 left-3 bg-accent text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {i < 2 ? 'Stock limite' : 'New'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLike(p.id); }}
                  className={`absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center transition-all ${
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
                    <ShoppingBag size={13} /> Ajouter au panier
                  </button>
                </div>
              </div>
              <button onClick={() => openQuickAdd(p)} className="pt-3 px-1 text-left w-full">
                <span className="text-[11px] font-semibold text-accent uppercase tracking-wide">{p.brand}</span>
                <h3 className="text-sm font-medium text-dark/80 mt-0.5 leading-snug">{p.name}</h3>
                <span className="text-sm font-bold text-dark mt-1 block">{formatPrice(p.salePrice)}</span>
                <span className="text-[11px] text-dark/35 mt-0.5 block">Paiement via WhatsApp</span>
              </button>
            </div>
          ))}
        </div>

        {visibleProducts.length === 0 && (
          <div className="rounded-3xl bg-white border border-dark/5 p-10 text-center text-dark/40">
            Aucun produit actif dans cette catégorie.
          </div>
        )}
      </div>

      {quickAdd && (
        <div className="fixed inset-0 z-[80] bg-dark/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent">{quickAdd.brand}</span>
                <h3 className="font-display text-xl font-800 text-dark mt-1">{quickAdd.name}</h3>
                <p className="text-lg font-800 text-dark mt-1">{formatPrice(quickAdd.salePrice)}</p>
              </div>
              <button onClick={() => setQuickAdd(null)} className="h-9 w-9 rounded-full bg-dark/5 flex items-center justify-center text-dark/40 hover:text-dark">
                <X size={18} />
              </button>
            </div>

            {/* Tailles */}
            {quickSizes.length > 0 && (
              <div className="mb-5">
                <label className="text-xs font-bold text-dark/40 block mb-2">Taille</label>
                <div className="flex flex-wrap gap-2">
                  {quickSizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`h-10 min-w-12 rounded-xl px-3 text-sm font-semibold border transition-all ${
                        selectedSize === s
                          ? 'bg-dark text-white border-dark'
                          : 'bg-bg text-dark/60 border-dark/10 hover:border-dark/30'
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
              <div className="mb-5">
                <label className="text-xs font-bold text-dark/40 block mb-2">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {quickColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`h-10 rounded-xl px-4 text-sm font-semibold border transition-all ${
                        selectedColor === c
                          ? 'bg-dark text-white border-dark'
                          : 'bg-bg text-dark/60 border-dark/10 hover:border-dark/30'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(!selectedSize || !selectedColor) && (
              <p className="text-xs text-accent font-semibold mb-4">Sélectionne une taille et une couleur</p>
            )}

            <button
              onClick={handleAddToCart}
              disabled={!selectedSize || !selectedColor}
              className={`w-full rounded-full px-7 py-3.5 text-sm font-bold text-white transition-colors flex items-center justify-center gap-2 ${
                addedId
                  ? 'bg-green-500'
                  : !selectedSize || !selectedColor
                    ? 'bg-dark/20 cursor-not-allowed'
                    : 'bg-dark hover:bg-accent'
              }`}
            >
              {addedId ? '✓ Ajouté au panier !' : <><ShoppingBag size={15} /> Ajouter au panier</>}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
