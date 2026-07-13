import { Heart, Search, ShoppingBag, X, ChevronDown, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import AppleEmoji from './AppleEmoji';
import { addToCart, syncCartWithProducts } from '../lib/cart';
import { fetchProducts, fetchOrders, type DbProduct } from '../lib/db';
import { readSiteSettings } from '../lib/siteSettings';
import { useInView } from '../hooks/useInView';

type Product = {
  id: string;
  brand: string;
  name: string;
  category: string;
  gender: string;
  salePrice: number;
  oldPrice?: number;
  sizes?: string;
  colors?: string;
  imageUrl?: string;
  status: string;
  createdAt?: string;
  orderCount?: number;
};

const INITIAL_SHOW = 8;
const LOAD_MORE_STEP = 8;
const LIKED_KEY = 'tof-liked-v1';

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
  return {
    id: d.id,
    brand: d.brand,
    name: d.name,
    category: d.category,
    gender: d.gender || 'mixte',
    salePrice: d.sale_price,
    oldPrice: (d as DbProduct & { old_price?: number | null }).old_price || undefined,
    sizes: d.sizes,
    colors: d.colors,
    imageUrl: d.image_url || '',
    status: d.status,
    createdAt: d.created_at,
  };
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
  return diff < 7 * 24 * 60 * 60 * 1000;
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

function getProductImages(p: Product) {
  if (!p.imageUrl) return [];
  return p.imageUrl
    .split('|')
    .map((s) => s.trim())
    .filter((url) => url && (url.startsWith('http') || url.startsWith('data:image')));
}

// ── Product Card with per-item in-view animation ───────────
function ProductCard({
  product,
  index,
  liked,
  onToggleLike,
  onOpen,
}: {
  product: Product;
  index: number;
  liked: boolean;
  onToggleLike: (id: string) => void;
  onOpen: (p: Product) => void;
}) {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.1, rootMargin: '0px 0px 40px 0px' });
  const images = getProductImages(product);
  const img = images[0];
  const badge = getBadge(product);
  const [hover, setHover] = useState(false);
  const eager = index < 8;

  return (
    <div
      ref={ref}
      className={`group ${isInView ? 'anim-fade-up' : 'opacity-0'}`}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.4)}s` }}
    >
      <div
        className="relative aspect-[3/4] rounded-2xl bg-white overflow-hidden border border-dark/5 shadow-sm shadow-dark/5 group-hover:shadow-lg group-hover:shadow-dark/10 transition-shadow duration-300 flex items-center justify-center p-4"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          onClick={() => onOpen(product)}
          className="absolute inset-0 z-0 cursor-pointer"
          aria-label={`Voir ${product.name}`}
        />
        <div className="h-full w-full flex items-center justify-center transition-transform duration-500 group-hover:scale-105 relative z-[1]">
          {img ? (
            <img
              src={img}
              alt={product.name}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={eager ? 'high' : 'auto'}
              width={400}
              height={533}
              className="max-h-full max-w-full w-auto h-auto object-contain"
              draggable={false}
            />
          ) : (
            <AppleEmoji emoji={emojiForCategory(product.category)} size={48} />
          )}
        </div>
        {badge && (
          <span className={`absolute top-3 left-3 ${badge.color} text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-10`}>
            {badge.text}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike(product.id);
          }}
          aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={`absolute top-3 right-3 h-11 w-11 rounded-full flex items-center justify-center transition-all z-20 active:scale-90 ${
            liked
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'bg-white/90 backdrop-blur text-dark/40 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 hover:text-red-500'
          }`}
        >
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <div
          className={`absolute bottom-0 inset-x-0 p-3 transition-transform duration-300 z-10 ${
            hover ? 'sm:translate-y-0' : 'sm:translate-y-full'
          } translate-y-0`}
        >
          <button
            onClick={() => onOpen(product)}
            className="w-full bg-dark hover:bg-accent text-white text-xs font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 h-11"
          >
            <ShoppingBag size={13} strokeWidth={2.5} /> Ajouter
          </button>
        </div>
      </div>
      <button onClick={() => onOpen(product)} className="pt-3 px-1 text-left w-full block min-h-[60px]">
        <span className="text-[10px] font-bold text-accent uppercase tracking-wider">{product.brand}</span>
        <h3 className="text-sm font-medium text-dark/80 mt-0.5 leading-snug line-clamp-2">{product.name}</h3>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-800 text-dark">{formatPrice(product.salePrice)}</span>
          {product.oldPrice && product.oldPrice > product.salePrice && (
            <span className="text-xs text-dark/30 line-through">{formatPrice(product.oldPrice)}</span>
          )}
        </div>
      </button>
    </div>
  );
}

// ── Skeleton card ──────────────────────────────────────────
function SkeletonCard() {
  return (
    <div>
      <div className="aspect-[3/4] rounded-2xl anim-shimmer mb-3" />
      <div className="h-3 w-14 anim-shimmer rounded-full mb-2" />
      <div className="h-4 w-3/4 anim-shimmer rounded-full mb-2" />
      <div className="h-4 w-1/3 anim-shimmer rounded-full" />
    </div>
  );
}

// ── QuickAdd / product modal ──────────────────────────────
function QuickAddModal({
  product,
  settings,
  relatedProducts,
  onClose,
}: {
  product: Product;
  settings: ReturnType<typeof readSiteSettings>;
  relatedProducts: Product[];
  onClose: () => void;
}) {
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImage, setActiveImage] = useState('');
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [addedId, setAddedId] = useState('');
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const touchPanelRef = useRef<HTMLDivElement>(null);

  const images = useMemo(() => getProductImages(product), [product]);
  const sizes = useMemo(() => parseSplit(product.sizes), [product]);
  const colors = useMemo(() => parseSplit(product.colors), [product]);

  useEffect(() => {
    setSelectedSize(sizes[0] || '');
    setSelectedColor(colors[0] || '');
    setActiveImage(images[0] || '');
    setShowSizeGuide(false);
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Image swipe on mobile
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setDragStartY(e.touches[0].clientY);
    setDragOffset(0);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX !== null) {
      const dx = e.touches[0].clientX - touchStartX;
      // image swipe if movement is primarily horizontal
      if (Math.abs(dx) > 10) e.stopPropagation();
    }
    if (dragStartY !== null && touchPanelRef.current) {
      const dy = e.touches[0].clientY - dragStartY;
      // Only allow drag-to-close if already scrolled to top
      if (touchPanelRef.current.scrollTop <= 0 && dy > 0) {
        setDragOffset(dy);
      }
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX !== null) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50 && images.length > 1) {
        const currentIdx = images.indexOf(activeImage);
        const nextIdx = dx < 0 ? Math.min(images.length - 1, currentIdx + 1) : Math.max(0, currentIdx - 1);
        if (nextIdx !== currentIdx) setActiveImage(images[nextIdx]);
      }
      setTouchStartX(null);
    }
    if (dragStartY !== null) {
      if (dragOffset > 120) {
        onClose();
      } else {
        setDragOffset(0);
      }
      setDragStartY(null);
    }
  };

  const handleColorSelect = (color: string, index: number) => {
    setSelectedColor(color);
    if (images[index]) {
      setActiveImage(images[index]);
    } else if (images[0]) {
      setActiveImage(images[0]);
    }
  };

  const canAdd = () => {
    if (needsSize(product) && !selectedSize) return false;
    if (needsColor(product) && !selectedColor) return false;
    return true;
  };

  const handleAddToCart = () => {
    if (!canAdd()) return;
    addToCart({
      productId: product.id,
      brand: product.brand,
      name: product.name,
      category: product.category,
      salePrice: product.salePrice,
      size: selectedSize || 'Unique',
      color: selectedColor || 'Unique',
      quantity: 1,
      imageUrl: activeImage || product.imageUrl,
    });
    setAddedId(product.id);
    setTimeout(() => {
      setAddedId('');
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-dark/60 sm:backdrop-blur-md anim-fade-in"
        onClick={onClose}
        style={{ opacity: Math.max(0, 1 - dragOffset / 400) }}
      />

      <div
        ref={touchPanelRef}
        className="relative bg-white w-full sm:max-w-4xl sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col sm:flex-row anim-slide-up will-change-transform"
        style={{
          height: '100dvh',
          maxHeight: '90vh',
          transform: `translateY(${dragOffset}px)`,
          transition: dragStartY ? 'none' : 'transform 0.25s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Close desktop */}
        <button
          onClick={onClose}
          className="absolute top-4 sm:top-6 right-4 sm:right-6 z-50 h-10 w-10 rounded-full bg-white/90 backdrop-blur border border-dark/5 flex items-center justify-center text-dark/60 hover:text-dark hover:scale-110 transition-all shadow-sm"
          aria-label="Fermer"
        >
          <X size={20} />
        </button>

        {/* Drag indicator on mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="h-1 w-10 rounded-full bg-dark/15" />
        </div>

        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
          {/* Image - Left */}
          <div className="relative w-full sm:w-[55%] h-[42vh] sm:h-auto bg-[#F9F9F9] flex flex-col items-center justify-center p-4 sm:p-12 min-h-0 flex-shrink-0">
            <div className="flex-1 flex items-center justify-center w-full min-h-0 relative select-none">
              {activeImage || images[0] ? (
                <img
                  src={activeImage || images[0]}
                  alt={product.name}
                  className="max-h-full max-w-full w-auto h-auto object-contain drop-shadow-2xl anim-fade-in"
                  key={activeImage}
                  draggable={false}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <AppleEmoji emoji={emojiForCategory(product.category)} size={120} />
                </div>
              )}

              {(() => {
                const badge = getBadge(product);
                return badge ? (
                  <span className={`absolute top-2 left-2 sm:top-0 sm:left-0 ${badge.color} text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg uppercase tracking-wider z-10`}>
                    {badge.text}
                  </span>
                ) : null;
              })()}

              {/* Mobile image arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      const i = images.indexOf(activeImage || images[0]);
                      setActiveImage(images[Math.max(0, i - 1)]);
                    }}
                    className="sm:hidden absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 shadow flex items-center justify-center text-dark/60 z-10"
                    aria-label="Image précédente"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => {
                      const i = images.indexOf(activeImage || images[0]);
                      setActiveImage(images[Math.min(images.length - 1, i + 1)]);
                    }}
                    className="sm:hidden absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 shadow flex items-center justify-center text-dark/60 z-10"
                    aria-label="Image suivante"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-4 px-2 overflow-x-auto no-scrollbar max-w-full pb-1 w-full justify-center">
                {images.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(url)}
                    className={`h-14 w-14 rounded-xl border-2 transition-all flex-shrink-0 overflow-hidden bg-white shadow-sm hover:scale-105 active:scale-95 ${
                      activeImage === url || (!activeImage && idx === 0)
                        ? 'border-accent ring-4 ring-accent/10'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    aria-label={`Voir vue ${idx + 1}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-contain p-1" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Infos - Right */}
          <div className="flex-1 flex flex-col min-h-0 bg-white border-l-0 sm:border-l border-dark/[0.03]">
            <div className="flex-1 overflow-y-auto custom-scrollbar overscroll-contain">
              <div className="p-5 sm:p-8 pb-28 sm:pb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{product.brand}</span>
                  <span className="h-1 w-1 rounded-full bg-dark/10" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-dark/30">{product.category}</span>
                </div>

                <h2 className="font-display text-2xl sm:text-4xl font-800 text-dark leading-tight">{product.name}</h2>

                <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mt-3">
                  <span className="text-2xl sm:text-3xl font-800 text-dark">{formatPrice(product.salePrice)}</span>
                  {product.oldPrice && product.oldPrice > product.salePrice && (
                    <span className="text-sm text-dark/30 line-through">{formatPrice(product.oldPrice)}</span>
                  )}
                  <span className="text-xs text-dark/30 font-medium">TVA incluse</span>
                </div>

                <div className="grid grid-cols-1 gap-2 mt-6">
                  {[
                    { icon: '📦', text: 'Livraison suivie', sub: '7-15 jours' },
                    { icon: '🛡️', text: 'Paiement Sécurisé', sub: 'via WhatsApp' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3 p-3 rounded-2xl bg-bg/70 border border-dark/[0.03]">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-[11px] font-bold text-dark/80">
                          {item.text} <span className="text-dark/30 font-medium ml-1">· {item.sub}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sizes */}
                {sizes.length > 0 && (
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-dark/40">Taille</label>
                      <button
                        onClick={() => setShowSizeGuide(!showSizeGuide)}
                        className="text-[10px] font-bold text-accent underline underline-offset-4 decoration-accent/30 hover:decoration-accent h-8"
                      >
                        Guide des tailles
                      </button>
                    </div>

                    {showSizeGuide && (
                      <div className="mb-4 p-4 bg-bg rounded-2xl border border-dark/5 anim-fade-in text-[11px] leading-relaxed">
                        <p className="font-bold text-dark/60 mb-2 uppercase tracking-tighter">Correspondances</p>
                        <div className="space-y-1 text-dark/50">
                          <p>• <span className="font-semibold text-dark/70">S/M/L</span> : Prenez votre taille habituelle.</p>
                          <p>• <span className="font-semibold text-dark/70">Sneakers</span> : Taille normalement (TTS).</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {sizes.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSelectedSize(s)}
                          className={`h-12 min-w-[44px] rounded-xl text-sm font-bold border-2 transition-all duration-200 ${
                            selectedSize === s
                              ? 'bg-dark text-white border-dark'
                              : 'bg-white text-dark/80 border-dark/10 hover:border-dark/30'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Colors */}
                {colors.length > 0 && (
                  <div className="mt-6">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-dark/40 block mb-3">Variante</label>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((c, idx) => (
                        <button
                          key={c}
                          onClick={() => handleColorSelect(c, idx)}
                          className={`h-11 min-w-[60px] px-4 rounded-xl text-sm font-bold border-2 transition-all duration-200 ${
                            selectedColor === c
                              ? 'bg-dark text-white border-dark'
                              : 'bg-white text-dark/80 border-dark/10 hover:border-dark/30'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!canAdd() && (sizes.length > 0 || colors.length > 0) && (
                  <div className="mt-6 p-3 rounded-xl bg-accent/5 border border-accent/10">
                    <p className="text-[11px] text-accent font-bold text-center">
                      {sizes.length > 0 && !selectedSize ? 'Sélectionnez une taille' : ''}
                      {sizes.length > 0 && !selectedSize && colors.length > 0 && !selectedColor ? ' et ' : ''}
                      {colors.length > 0 && !selectedColor ? 'une variante' : ''}
                    </p>
                  </div>
                )}

                {/* Related */}
                {relatedProducts.length > 0 && (
                  <div className="mt-10">
                    <p className="text-[11px] font-black uppercase tracking-widest text-dark/25 mb-4">Tu pourrais aussi aimer</p>
                    <div className="grid grid-cols-3 gap-3">
                      {relatedProducts.map((p) => {
                        const rpImg = getProductImages(p)[0];
                        return (
                          <button key={p.id} onClick={() => {
                            // handled by parent via key change — close & reopen via parent callback
                            const ev = new CustomEvent('tof-open-product', { detail: p.id });
                            window.dispatchEvent(ev);
                          }} className="group text-left">
                            <div className="aspect-square rounded-2xl bg-bg border border-dark/[0.03] overflow-hidden flex items-center justify-center p-2 group-hover:border-accent/20 transition-all">
                              {rpImg ? (
                                <img src={rpImg} alt={p.name} loading="lazy" decoding="async" className="max-h-full max-w-full w-auto h-auto object-contain group-hover:scale-110 transition-transform" />
                              ) : (
                                <AppleEmoji emoji={emojiForCategory(p.category)} size={28} />
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-dark/40 mt-2 truncate uppercase">{p.brand}</p>
                            <p className="text-[10px] font-bold text-dark truncate flex items-baseline gap-1">
                              {formatPrice(p.salePrice)}
                              {p.oldPrice && p.oldPrice > p.salePrice && (
                                <span className="text-[9px] text-dark/25 line-through font-semibold">{formatPrice(p.oldPrice)}</span>
                              )}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-dark/5 space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className="text-dark/30">Livraison</span>
                    <span className="text-green-600 font-bold">
                      {settings.freeShipping ? 'Gratuite' : settings.freeShippingThreshold > 0 ? `Offerte dès ${formatPrice(settings.freeShippingThreshold)}` : formatPrice(settings.standardShippingFee || 7.9)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className="text-dark/30">Retours</span>
                    <span className="text-dark/60 font-bold">Sous 14 jours</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky CTA desktop */}
            <div className="hidden sm:block p-5 sm:p-6 border-t border-dark/5 bg-white/95 backdrop-blur z-20 flex-shrink-0">
              <button
                onClick={handleAddToCart}
                disabled={!canAdd()}
                className={`w-full h-14 rounded-2xl text-sm font-900 text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-xl ${
                  addedId
                    ? 'bg-green-500 shadow-green-200'
                    : !canAdd()
                      ? 'bg-dark/10 text-dark/20 cursor-not-allowed shadow-none'
                      : 'bg-dark hover:bg-accent hover:scale-[1.01] active:scale-[0.99] shadow-dark/20'
                }`}
              >
                {addedId ? (
                  <>
                    <span>✓</span>
                    <span>AJOUTÉ !</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag size={18} strokeWidth={2.5} />
                    <span>AJOUTER AU PANIER — {formatPrice(product.salePrice)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile sticky CTA */}
        <div className="sm:hidden p-4 pt-3 border-t border-dark/5 bg-white/95 backdrop-blur-xl z-30 flex-shrink-0 safe-bottom">
          <button
            onClick={handleAddToCart}
            disabled={!canAdd()}
            className={`w-full h-14 rounded-2xl text-[13px] font-900 text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${
              addedId
                ? 'bg-green-500 shadow-green-200'
                : !canAdd()
                  ? 'bg-dark/10 text-dark/20 cursor-not-allowed shadow-none'
                  : 'bg-dark active:scale-[0.98] shadow-dark/20'
            }`}
          >
            {addedId ? '✓ AJOUTÉ !' : `AJOUTER — ${formatPrice(product.salePrice)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function Products() {
  const { ref, isInView: sectionInView } = useInView<HTMLElement>(0.02);
  const [activeGender, setActiveGender] = useState<(typeof genderFilters)[number]>('Tout');
  const [activeCategory, setActiveCategory] = useState<(typeof categoryFilters)[number]>('Tout');
  const [showCount, setShowCount] = useState(INITIAL_SHOW);
  const [searchRaw, setSearch] = useState('');
  const search = useDebounce(searchRaw, 200);
  const [liked, setLiked] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(LIKED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddId, setQuickAddId] = useState<string | null>(null);
  const [settings, setSettings] = useState(readSiteSettings);
  const genderChipsRef = useRef<HTMLDivElement>(null);
  const categoryChipsRef = useRef<HTMLDivElement>(null);

  // Persist wishlist
  useEffect(() => {
    try {
      localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(liked)));
    } catch {}
  }, [liked]);

  useEffect(() => {
    if (quickAddId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [quickAddId]);

  useEffect(() => {
    const syncS = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', syncS);
    return () => window.removeEventListener('tof-settings-updated', syncS);
  }, []);

  useEffect(() => {
    let alive = true;
    const loadAndSync = async () => {
      setLoading(true);
      const loaded = await loadProducts();
      if (!alive) return;
      setProducts(loaded);
      syncCartWithProducts(loaded.map((p) => p.id));
      setLoading(false);
    };
    loadAndSync();
    const sync = () => { loadAndSync(); };
    window.addEventListener('tof-products-updated', sync);
    return () => {
      alive = false;
      window.removeEventListener('tof-products-updated', sync);
    };
  }, []);

  const openProductById = useCallback((id: string) => {
    setQuickAddId(id);
    requestAnimationFrame(() => {
      const scroller = document.querySelector('.custom-scrollbar') as HTMLElement | null;
      if (scroller) scroller.scrollTop = 0;
    });
  }, []);

  // Listen for related-product clicks in modal
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      if (id) openProductById(id);
    };
    window.addEventListener('tof-open-product', handler);
    return () => window.removeEventListener('tof-open-product', handler);
  }, [openProductById]);

  // Auto-open product preview from admin "Aperçu" button
  useEffect(() => {
    if (loading || products.length === 0) return;
    try {
      const previewId = localStorage.getItem('tof-preview-product');
      if (previewId) {
        localStorage.removeItem('tof-preview-product');
        const p = products.find((x) => x.id === previewId);
        if (p) {
          // scroll to shop section first
          const el = document.getElementById('shop');
          if (el) {
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'auto' });
          }
          setTimeout(() => openProductById(previewId), 200);
        }
      }
    } catch {}
  }, [loading, products, openProductById]);

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

  // Reset show count on filter changes
  useEffect(() => {
    setShowCount(INITIAL_SHOW);
  }, [activeGender, activeCategory, search]);

  const visibleProducts = useMemo(() => allFiltered.slice(0, showCount), [allFiltered, showCount]);
  const totalFiltered = allFiltered.length;
  const hasMore = showCount < totalFiltered;

  const hasActiveFilters = activeGender !== 'Tout' || activeCategory !== 'Tout' || search.trim() !== '';

  const toggleLike = useCallback((id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const openQuickAdd = useCallback((p: Product) => {
    setQuickAddId(p.id);
  }, []);

  const resetFilters = () => {
    setActiveGender('Tout');
    setActiveCategory('Tout');
    setSearch('');
  };

  const quickAdd = useMemo(
    () => (quickAddId ? products.find((p) => p.id === quickAddId) || null : null),
    [quickAddId, products],
  );

  const relatedProducts = useMemo(() => {
    if (!quickAdd) return [];
    return products
      .filter((p) => p.id !== quickAdd.id && p.category === quickAdd.category && p.status === 'active')
      .slice(0, 3);
  }, [products, quickAdd]);

  return (
    <>
      {/* Comment ça marche */}
      <section className="py-14 sm:py-16 bg-bg border-t border-dark/5">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="font-display text-3xl sm:text-4xl font-800 tracking-tight text-dark">Comment ça marche ?</h2>
            <p className="mt-2 text-dark/50 text-sm sm:text-base">Pas de stock, pas de surprise — on vérifie chaque pièce avant que tu payes.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { emoji: '🛒', title: '1. Tu choisis', text: 'Ajoute ta pièce au panier et remplis tes infos. Pas de paiement tout de suite.' },
              { emoji: '🔍', title: '2. Je contrôle', text: "Je commande la pièce à mon agent et je reçois 5-6 photos QC détaillées (coutures, logo, matière). Je te les envoie — tu valides, ou je change." },
              { emoji: '✅', title: '3. Tu payes, tu reçois', text: "Une fois validé, tu payes via PayPal (protection acheteur). Je expédie, tu as le suivi. Livraison en 10-20 jours ouvrés." },
            ].map((step, i) => (
              <div key={i} className="rounded-2xl bg-white border border-dark/5 p-5 sm:p-6">
                <div className="text-3xl mb-3">{step.emoji}</div>
                <h3 className="font-bold text-dark text-base sm:text-lg">{step.title}</h3>
                <p className="text-dark/55 text-sm mt-1.5 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="rounded-full bg-green-500/10 text-green-700 px-3 py-1.5 text-xs font-bold">✓ QC avant paiement</span>
            <span className="rounded-full bg-green-500/10 text-green-700 px-3 py-1.5 text-xs font-bold">✓ PayPal protection acheteur</span>
            <span className="rounded-full bg-green-500/10 text-green-700 px-3 py-1.5 text-xs font-bold">✓ Livraison suivie</span>
            <span className="rounded-full bg-green-500/10 text-green-700 px-3 py-1.5 text-xs font-bold">✓ Retours 14j si erreur</span>
          </div>
        </div>
      </section>

      <section id="shop" className="py-14 sm:py-20 lg:py-28 bg-bg" ref={ref}>
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
            <div className={sectionInView ? 'anim-fade-up opacity-0' : 'opacity-0'}>
              <h2 className="font-display text-4xl sm:text-5xl font-800 tracking-tight text-dark flex items-center gap-3">
                le shop <AppleEmoji emoji="🛒" size={36} />
              </h2>
              <p className="mt-2 text-dark/40">choisis ta pièce, ajoute au panier</p>
            </div>
          </div>

        {/* Search */}
        <div className={`relative mb-3 ${sectionInView ? 'anim-fade-up opacity-0 delay-100' : 'opacity-0'}`}>
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/25 pointer-events-none" />
          <input
            value={searchRaw}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une pièce..."
            className="w-full rounded-2xl bg-white border border-dark/5 pl-11 pr-10 py-3.5 text-sm outline-none focus:border-accent/30 focus:ring-4 focus:ring-accent/5 transition-all"
            inputMode="search"
          />
          {searchRaw && (
            <button
              onClick={() => setSearch('')}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-dark/5 flex items-center justify-center text-dark/40 hover:text-dark hover:bg-dark/10 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div
          ref={genderChipsRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 mb-1 -mx-1 px-1 snap-x-mandatory"
        >
          {genderFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveGender(filter)}
              className={`px-4 py-2.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap flex-shrink-0 snap-start h-10 ${
                activeGender === filter ? 'bg-dark text-white' : 'bg-dark/5 text-dark/50 hover:bg-dark/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div
          ref={categoryChipsRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 mb-3 -mx-1 px-1 snap-x-mandatory"
        >
          {categoryFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveCategory(filter)}
              className={`px-4 py-2.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap flex-shrink-0 snap-start h-10 ${
                activeCategory === filter ? 'bg-accent text-white' : 'bg-dark/5 text-dark/50 hover:bg-dark/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs min-h-[24px]">
          <span className="text-dark/30 font-medium">
            {totalFiltered} produit{totalFiltered > 1 ? 's' : ''}
          </span>
          {search && (
            <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent max-w-[200px] truncate">
              “{search}”
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-dark/5 hover:bg-dark/10 px-3 py-1 font-semibold text-dark/60 h-7 transition-colors"
            >
              <X size={11} /> Réinitialiser
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : visibleProducts.length === 0 ? null : (
            visibleProducts.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                index={i}
                liked={liked.has(p.id)}
                onToggleLike={toggleLike}
                onOpen={openQuickAdd}
              />
            ))
          )}
        </div>

        {/* Voir plus / tout */}
        {!loading && hasMore && (
          <div className="text-center mt-10">
            <button
              onClick={() => {
                if (showCount + LOAD_MORE_STEP >= totalFiltered) {
                  setShowCount(totalFiltered);
                } else {
                  setShowCount(showCount + LOAD_MORE_STEP);
                }
              }}
              className="inline-flex items-center gap-2 bg-dark text-white px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-accent transition-colors h-12"
            >
              Voir plus ({totalFiltered - showCount}) <ChevronDown size={16} />
            </button>
          </div>
        )}

        {!loading && totalFiltered === 0 && (
          <div className="rounded-3xl bg-white border border-dark/5 p-10 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-bg flex items-center justify-center mb-4">
              <Filter size={24} className="text-dark/25" />
            </div>
            <p className="text-dark/50 font-semibold mb-2">Aucun produit trouvé</p>
            <p className="text-dark/30 text-sm mb-5">
              Aucun produit ne correspond à{' '}
              {activeGender !== 'Tout' && <span className="font-semibold text-dark/60">{activeGender}</span>}
              {activeGender !== 'Tout' && activeCategory !== 'Tout' && ' dans '}
              {activeCategory !== 'Tout' && <span className="font-semibold text-dark/60">{activeCategory}</span>}
              {search && ` pour “${search}”`}.
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 bg-dark text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-accent transition-colors"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </div>

      {quickAdd && (
        <QuickAddModal
          product={quickAdd}
          settings={settings}
          relatedProducts={relatedProducts}
          onClose={() => setQuickAddId(null)}
        />
      )}
    </section>
    </>
  );
}
