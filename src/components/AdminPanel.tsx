import { createPortal } from 'react-dom';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy, ExternalLink, Package, Pencil, Plus, RotateCcw, Save, Search, Send,
  Trash2, Truck, X, ArrowUpDown, Flame, ArrowLeft, Calculator, Bell, BellOff, Download,
} from 'lucide-react';
import { defaultDrop, type FeaturedDropConfig } from './FeaturedDrop';
import { defaultSettings, readSiteSettings, saveSiteSettings, hydrateSiteSettings, type SiteSettings } from '../lib/siteSettings';
import {
  fetchProducts, upsertProduct, deleteProduct as dbDeleteProduct,
  fetchOrders, updateOrder, insertOrder as dbInsertOrder,
  fetchDrop, saveDrop as dbSaveDrop, fetchNotes, upsertNote,
  deleteNote as dbDeleteNote, subscribeToOrders, subscribeToProducts,
  onOnlineCountChange, getPresenceState, trackVisitor, fetchConversations,
  sendChatMessage, subscribeToChatMessages, deleteConversation, deleteChatMessage,
  fetchPromoCodes, upsertPromoCode, deletePromoCode,
  type DbProduct, type DbOrder, type DbDrop, type DbNote, type DbChatMessage, type DbPromoCode,
} from '../lib/db';
import { showToast, showActionToast } from './Toast';
import { supabase } from '../lib/supabase';
import { uploadQcPhoto } from '../lib/storage';
import { playNewOrder, playCopy, playDelete } from '../lib/sounds';
import {
  notify, requestNotifications, notificationsEnabled, setNotificationsEnabled,
  currentPermission, notificationsSupported,
} from '../lib/notifications';
import ImageUploader from './ImageUploader';
import { uploadProductImage, uploadDropImage, pathFromStorageUrl, isStorageUrl, deleteProductImages } from '../lib/storage';
import { extractSourceUrl, isShortlink } from '../lib/resolveSourceUrl';
import { SizePicker, ColorPicker } from './ui/ChipPickers';
import { useDebounce } from '../hooks/useDebounce';
import ConfirmDialog from './ui/ConfirmDialog';

type Product = {
  id: string;
  brand: string;
  name: string;
  category: string;
  gender: 'homme' | 'femme' | 'mixte';
  salePrice: number;
  oldPrice?: number;
  sourcePriceCny: number;
  weightGrams: number;
  packaging: 'none' | 'without_box' | 'with_box';
  sizes: string;
  colors: string;
  imageUrl: string;
  sourceUrl: string;
  status: 'active' | 'link_dead' | 'paused';
  /** Texte libre affiché sur la fiche (matière, coupe, détails). */
  description?: string;
  /** Conseil de taille, ex. « Taille normalement ». */
  sizeAdvice?: string;
  /** Contenu du colis, ex. « Paire + boîte + dustbag ». */
  boxContent?: string;
};

type OrderStatus = 'new' | 'to_order' | 'ordered' | 'qc_received' | 'shipped' | 'done';

type OrderItem = {
  productId: string;
  brand: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  productId: string;
  size: string;
  color: string;
  quantity: number;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  country: string;
  snapOrWhatsapp: string;
  status: OrderStatus;
  paymentStatus?: 'pending' | 'paid' | 'cancelled';
  tracking?: string;
  items?: OrderItem[];
  createdAt?: string;
  qcPhotos?: string;
};

// Legacy keys kept for reference
// const STORAGE_PRODUCTS = 'tof-admin-products-v1';
// const STORAGE_ORDERS = 'tof-orders-v1';
// const STORAGE_DROP = 'tof-featured-drop-v1';
// Taux agent ¥→€ : ~7.5 ¥ = 1 € (commission agent ~6% + change + assurance)
const CNY_TO_EUR = 1 / 7.5; // ≈ 0.1333
const SHIPPING_SAFETY_MULTIPLIER = 1.2;
const PAYMENT_FEE_PCT = 0.025;
const PAYMENT_FEE_FIXED = 0;
const RETURN_RISK_PCT = 0.03;
const AGENT_FEE_PCT = 0.06;

const categoryPresets = [
  { label: 'T-shirt', weight: 320, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1, 2' },
  { label: 'Polo', weight: 380, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1, 2' },
  { label: 'Chemise', weight: 350, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1, 2' },
  { label: 'Hoodie / pull', weight: 900, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1, 2' },
  { label: 'Veste légère', weight: 1100, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1' },
  { label: 'Doudoune', weight: 1600, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1' },
  { label: 'Jean / pantalon', weight: 750, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1, 2' },
  { label: 'Short', weight: 400, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1, 2' },
  { label: 'Jogging', weight: 650, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1, 2' },
  { label: 'Maillot de bain', weight: 200, packaging: 'none' as const, defaultSizes: 'S, M, L, XL', defaultColors: '1, 2' },
  { label: 'Ensemble', weight: 1200, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: '1, 2' },
  { label: 'Robe', weight: 500, packaging: 'none' as const, defaultSizes: 'XS, S, M, L, XL', defaultColors: '1, 2' },
  { label: 'Jupe', weight: 350, packaging: 'none' as const, defaultSizes: 'XS, S, M, L, XL', defaultColors: '1' },
  { label: 'Sous-vêtement', weight: 150, packaging: 'none' as const, defaultSizes: 'S, M, L, XL', defaultColors: '1, 2' },
  { label: 'Casquette', weight: 250, packaging: 'none' as const, defaultSizes: '', defaultColors: '1, 2' },
  { label: 'Bonnet', weight: 200, packaging: 'none' as const, defaultSizes: '', defaultColors: '1' },
  { label: 'Ceinture', weight: 300, packaging: 'none' as const, defaultSizes: '', defaultColors: '1, 2' },
  { label: 'Lunettes', weight: 150, packaging: 'none' as const, defaultSizes: '', defaultColors: '1' },
  { label: 'Bijoux', weight: 100, packaging: 'none' as const, defaultSizes: '', defaultColors: '1' },
  { label: 'Sacoche', weight: 500, packaging: 'none' as const, defaultSizes: '', defaultColors: '1, 2' },
  { label: 'Sac à main', weight: 950, packaging: 'none' as const, defaultSizes: '', defaultColors: '1, 2' },
  { label: 'Sac à dos', weight: 800, packaging: 'none' as const, defaultSizes: '', defaultColors: '1' },
  { label: 'Sneakers', weight: 1100, packaging: 'without_box' as const, defaultSizes: '39, 40, 41, 42, 43, 44, 45', defaultColors: '1, 2' },
  { label: 'Sneakers + boîte', weight: 1600, packaging: 'with_box' as const, defaultSizes: '39, 40, 41, 42, 43, 44, 45', defaultColors: '1, 2' },
  { label: 'Claquettes', weight: 500, packaging: 'none' as const, defaultSizes: '39, 40, 41, 42, 43, 44, 45', defaultColors: '1' },
  { label: 'Chaussures', weight: 1000, packaging: 'none' as const, defaultSizes: '39, 40, 41, 42, 43, 44, 45', defaultColors: '1' },
  { label: 'Montre', weight: 200, packaging: 'with_box' as const, defaultSizes: '', defaultColors: '1' },
  { label: 'Portefeuille', weight: 250, packaging: 'none' as const, defaultSizes: '', defaultColors: '1, 2' },
  { label: 'Écharpe', weight: 300, packaging: 'none' as const, defaultSizes: '', defaultColors: '1, 2' },
  { label: 'Parfum', weight: 400, packaging: 'with_box' as const, defaultSizes: '', defaultColors: '1' },
];

// packagingLabels removed — no longer used in quick form

const initialProducts: Product[] = [
  {
    id: 'p1',
    brand: 'Nike',
    name: 'Air Force 1 Low',
    category: 'Sneakers',
    gender: 'mixte',
    salePrice: 85,
    sourcePriceCny: 260,
    weightGrams: 1200,
    packaging: 'without_box',
    sizes: '39, 40, 41, 42, 43, 44, 45',
    colors: 'Black, White',
    imageUrl: '',
    sourceUrl: 'https://mulebuy.com/product?id=EXEMPLE-AF1',
    status: 'paused', // produits d'exemple en pause : invisibles côté public tant que tu ne les remplaces pas
  },
  {
    id: 'p2',
    brand: 'Stüssy',
    name: 'T-shirt Logo',
    category: 'T-shirt',
    gender: 'mixte',
    salePrice: 45,
    sourcePriceCny: 80,
    weightGrams: 300,
    packaging: 'none',
    sizes: 'S, M, L, XL',
    colors: 'Black, White, Beige',
    imageUrl: '',
    sourceUrl: 'https://mulebuy.com/product?id=EXEMPLE-STUSSY',
    status: 'paused',
  },
  {
    id: 'p3',
    brand: 'Represent',
    name: 'Hoodie Owners Club',
    category: 'Hoodie / pull',
    gender: 'mixte',
    salePrice: 89,
    sourcePriceCny: 280,
    weightGrams: 900,
    packaging: 'none',
    sizes: 'S, M, L, XL, XXL',
    colors: 'Black, Grey',
    imageUrl: '',
    sourceUrl: 'https://mulebuy.com/product?id=EXEMPLE-REPRESENT',
    status: 'paused',
  },
];

// No initial orders — loaded from Supabase

const paymentLabels = {
  pending: 'Paiement attente',
  paid: 'Payee',
  cancelled: 'Annulee',
};

const statusLabels: Record<OrderStatus, string> = {
  new: 'Nouvelle',
  to_order: 'A commander',
  ordered: 'Commandee',
  qc_received: 'QC recu',
  shipped: 'Expediee',
  done: 'Livree',
};

// readStorage kept as fallback util
function _readStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
}
void _readStorage;

function productToDb(p: Product): DbProduct {
  return {
    id: p.id, brand: p.brand, name: p.name, category: p.category, gender: p.gender || 'mixte',
    sale_price: p.salePrice, old_price: p.oldPrice || null, source_price_cny: p.sourcePriceCny,
    weight_grams: p.weightGrams, packaging: p.packaging,
    sizes: p.sizes, colors: p.colors, image_url: p.imageUrl || '',
    source_url: p.sourceUrl, status: p.status,
    description: p.description || null,
    size_advice: p.sizeAdvice || null,
    box_content: p.boxContent || null,
  };
}

function dbToProduct(d: DbProduct): Product {
  return {
    id: d.id, brand: d.brand, name: d.name, category: d.category, gender: (d.gender || 'mixte') as Product['gender'],
    salePrice: d.sale_price, oldPrice: d.old_price || undefined, sourcePriceCny: d.source_price_cny,
    weightGrams: d.weight_grams, packaging: d.packaging as Product['packaging'],
    sizes: d.sizes, colors: d.colors, imageUrl: d.image_url || '',
    sourceUrl: d.source_url, status: d.status as Product['status'],
    description: d.description || undefined,
    sizeAdvice: d.size_advice || undefined,
    boxContent: d.box_content || undefined,
  };
}

function orderToDb(o: Order): DbOrder {
  return {
    id: o.id, product_id: o.productId, size: o.size, color: o.color,
    quantity: o.quantity, customer_name: o.customerName, phone: o.phone,
    address: o.address, city: o.city, zip: o.zip, country: o.country,
    snap_or_whatsapp: o.snapOrWhatsapp, status: o.status,
    payment_status: o.paymentStatus || 'pending', tracking: o.tracking || null,
  };
}

function dbToOrder(d: DbOrder): Order {
  let items: OrderItem[] | undefined;
  try {
    if (d.items_json) items = JSON.parse(d.items_json) as OrderItem[];
  } catch { /* ignore */ }
  return {
    id: d.id, productId: d.product_id, size: d.size, color: d.color,
    quantity: d.quantity, customerName: d.customer_name, phone: d.phone,
    address: d.address, city: d.city, zip: d.zip, country: d.country,
    snapOrWhatsapp: d.snap_or_whatsapp, status: d.status as OrderStatus,
    paymentStatus: d.payment_status as Order['paymentStatus'], tracking: d.tracking || undefined,
    createdAt: d.created_at,
    qcPhotos: d.qc_photos || undefined,
    items,
  };
}

function dropToDb(d: FeaturedDropConfig): DbDrop {
  return {
    badge: d.badge, eyebrow: d.eyebrow, brand: d.brand, name: d.name,
    description: d.description, price: d.price, old_price: d.oldPrice,
    discount: d.discount, sizes: d.sizes, image_url: d.imageUrl,
  };
}

function dbToDrop(d: DbDrop): FeaturedDropConfig {
  return {
    badge: d.badge, eyebrow: d.eyebrow, brand: d.brand, name: d.name,
    description: d.description, price: d.price, oldPrice: d.old_price,
    discount: d.discount, sizes: d.sizes, imageUrl: d.image_url,
  };
}

function euro(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

function estimateMulebuyShipping(weightGrams: number, line: 'tax_free' | 'economy' | 'express' = 'tax_free') {
  // Tarifs 2026 lignes agent FR (GD-EMS / KR-EMS / DHL tax-free)
  // Taux nets, marge sécurité appliquée côté appel via SHIPPING_SAFETY_MULTIPLIER
  const kg = Math.max(weightGrams / 1000, 0.3);
  const rates = {
    economy:   { base: 0,    perKg: 75,  label: 'Économique (SAL, 15-25j)' },    // ~10€/kg
    tax_free:  { base: 0,    perKg: 80,  label: 'Tax-free GD-EMS (10-20j)' },   // ~10.7€/kg, douanes évitées
    express:   { base: 10,   perKg: 120, label: 'Express DHL (5-10j)' },        // ~16€/kg
  } as const;
  // Note : perKg est en ¥/kg → converti en € après le calcul
  const rate = rates[line];
  const costCny = rate.base + kg * rate.perKg;
  const costEur = costCny * CNY_TO_EUR;
  return {
    label: rate.label,
    low:  costEur,
    high: costEur * 1.15,
  };
}

function getCategoryDefaults(category: string) {
  const preset = categoryPresets.find((p) => p.label === category);
  if (preset) return { sizes: preset.defaultSizes, colors: preset.defaultColors, packaging: preset.packaging, weightGrams: preset.weight };
  const lower = (category || '').toLowerCase();
  // Fallback heuristics based on name
  if (lower.includes('sneaker') || lower.includes('chaussure') || lower.includes('claquette')) {
    return { sizes: '39, 40, 41, 42, 43, 44, 45', colors: 'Black, White', packaging: 'none' as const, weightGrams: 900 };
  }
  if (lower.includes('sac') || lower.includes('portefeuille') || lower.includes('ceinture') || lower.includes('lunettes') ||
      lower.includes('bijou') || lower.includes('montre') || lower.includes('parfum') || lower.includes('casquette') ||
      lower.includes('bonnet') || lower.includes('écharpe') || lower.includes('echarpe')) {
    return { sizes: '', colors: 'Black', packaging: 'none' as const, weightGrams: 250 };
  }
  return { sizes: 'S, M, L, XL', colors: 'Black, White', packaging: 'none' as const, weightGrams: 500 };
}

function normalizedProduct(product: Product): Product {
  const categoryExists = categoryPresets.some((preset) => preset.label === product.category);
  const fallbackCategory = product.category.toLowerCase().includes('sneaker')
    ? 'Sneakers'
    : product.name.toLowerCase().includes('hoodie') || product.name.toLowerCase().includes('pull')
      ? 'Hoodie / pull'
      : 'T-shirt';
  const finalCategory = categoryExists ? product.category : fallbackCategory;
  const defaults = getCategoryDefaults(finalCategory);
  return {
    ...product,
    category: finalCategory,
    packaging: product.packaging || defaults.packaging,
    sizes: product.sizes ?? defaults.sizes,
    colors: product.colors || defaults.colors,
    weightGrams: product.weightGrams || defaults.weightGrams,
    imageUrl: product.imageUrl || '',
    gender: product.gender || 'mixte',
  };
}

function estimatePaymentFees(amount: number) {
  // SumUp lien de paiement FR : 2,5% par transaction, sans frais fixe
  return amount * PAYMENT_FEE_PCT + PAYMENT_FEE_FIXED;
}

function estimateSourceCostEur(sourcePriceCny: number, quantity = 1) {
  // Prix ¥ converti + commission agent 6%
  return sourcePriceCny * CNY_TO_EUR * quantity * (1 + AGENT_FEE_PCT);
}

function roundPrice(value: number) {
  if (value <= 0) return 0;
  return Math.max(19, Math.ceil(value / 10) * 10 - 1);
}

function suggestedSalePrice(sourcePriceCny: number, weightGrams: number, packaging: Product['packaging'], targetMarginPct = 45) {
  // Résolution itérative : le prix suggéré doit donner ~targetMarginPct de marge nette
  const effWeight = weightGrams + (packaging === 'with_box' ? 450 : packaging === 'without_box' ? -100 : 0);
  const sourceCost = estimateSourceCostEur(sourcePriceCny);
  const shippingWithSafety = estimateMulebuyShipping(Math.max(effWeight, 200)).high * SHIPPING_SAFETY_MULTIPLIER;
  // Équation : net = price - sourceCost - shipping - (price*pct_fees + fixed) - price*risk_pct
  // => price * (1 - pct_fees - risk_pct) = sourceCost + shipping + fixed + net
  // On veut net = targetPct * price
  // => price * (1 - pct_fees - risk_pct - targetPct/100) = sourceCost + shipping + fixed
  const denom = 1 - PAYMENT_FEE_PCT - RETURN_RISK_PCT - targetMarginPct / 100;
  if (denom <= 0) return 99;
  const raw = (sourceCost + shippingWithSafety + PAYMENT_FEE_FIXED) / denom;
  return roundPrice(raw);
}

function effectiveWeight(product: Product) {
  const packaging = product.packaging || 'none';
  const extra = packaging === 'with_box' ? 450 : packaging === 'without_box' ? -100 : 0;
  return Math.max(product.weightGrams + extra, 200);
}

function estimateNetMargin(product: Product, quantity = 1) {
  const effective = effectiveWeight(product) * quantity;
  const shipping = estimateMulebuyShipping(effective);
  const shippingWithSafety = shipping.high * SHIPPING_SAFETY_MULTIPLIER;
  const sourceCost = estimateSourceCostEur(product.sourcePriceCny, quantity);
  const revenue = product.salePrice * quantity;
  const paymentFees = estimatePaymentFees(revenue);
  const riskProvision = revenue * RETURN_RISK_PCT;
  const totalCost = sourceCost + shippingWithSafety + paymentFees + riskProvision;
  const net = revenue - totalCost;
  const netPct = revenue > 0 ? (net / revenue) * 100 : 0;
  return {
    effectiveWeight: effective,
    shipping,
    shippingWithSafety,
    sourceCost,
    paymentFees,
    riskProvision,
    totalCost,
    net,
    netPct,
  };
}

/** Calcul rapide de marge sans passer par un Product (pour l'onglet Estimation). */
function estimateQuickMargin(sourceCny: number, weightGrams: number, salePriceEur: number, packaging: Product['packaging'] = 'none', quantity = 1) {
  const effWeight = (weightGrams + (packaging === 'with_box' ? 450 : packaging === 'without_box' ? -100 : 0)) * quantity;
  const shipping = estimateMulebuyShipping(Math.max(effWeight, 200));
  const shippingWithSafety = shipping.high * SHIPPING_SAFETY_MULTIPLIER;
  const sourceCost = estimateSourceCostEur(sourceCny, quantity);
  const revenue = salePriceEur * quantity;
  const paymentFees = estimatePaymentFees(revenue);
  const riskProvision = revenue * RETURN_RISK_PCT;
  const totalCost = sourceCost + shippingWithSafety + paymentFees + riskProvision;
  const net = revenue - totalCost;
  const netPct = revenue > 0 ? (net / revenue) * 100 : 0;
  return { effWeight: Math.max(effWeight, 200), shipping, shippingWithSafety, sourceCost, paymentFees, riskProvision, totalCost, net, netPct };
}

function marginTone(pct: number) {
  if (pct >= 45) return 'bg-green-500/10 text-green-600';
  if (pct >= 30) return 'bg-orange-500/10 text-orange-600';
  return 'bg-red-500/10 text-red-600';
}

function marginLabel(pct: number) {
  if (pct >= 45) return 'OK';
  if (pct >= 30) return 'Moyen';
  return 'Danger';
}

function rootOrderId(id: string) {
  const match = id.match(/^TOF-\d+/);
  return match ? match[0] : id;
}

// Handler d'upload stable (référence de module, pas de state) — évite de
// recréer la fonction à chaque render et ne casse pas la mémoïsation.
const productImageUploadHandler = (file: File) =>
  uploadProductImage(file, 800, 0.75).then((r) => ({ url: r.url, hasAlpha: r.hasAlpha }));

// ────────────────────────────────────────────────────────────────────────────
// ProductListItem : ligne compacte dans la liste (miniature + infos clés)
// ────────────────────────────────────────────────────────────────────────────
type ProductListItemProps = {
  product: Product;
  ordersCount: number;
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onRemove: (id: string) => void;
};

const statusMeta = {
  active:     { label: 'Actif',     cls: 'bg-green-500/10 text-green-600' },
  link_dead:  { label: 'Lien sauté', cls: 'bg-red-500/10 text-red-500' },
  paused:     { label: 'Pause',     cls: 'bg-dark/10 text-dark/40' },
} as const;

const ProductListItem = memo(function ProductListItem({ product, ordersCount, onEdit, onDuplicate, onRemove }: ProductListItemProps) {
  const margin = estimateNetMargin(product);
  const firstImage = product.imageUrl
    ? product.imageUrl.split('|').map((s) => s.trim()).find(Boolean) || ''
    : '';
  const sBadge = statusMeta[product.status];
  const marginColor =
    margin.netPct >= 45 ? 'text-green-600' :
    margin.netPct >= 30 ? 'text-orange-500' :
    'text-red-500';

  return (
    <div className="group relative flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 hover:bg-bg/80 active:bg-bg transition-colors">
      {/* Miniature */}
      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-subtle border border-dark/5 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
        {firstImage ? (
          <img
            src={firstImage}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <Package size={20} className="text-dark/20" />
        )}
        {ordersCount >= 3 && (
          <span className="absolute -top-1.5 -left-1.5 inline-flex items-center gap-0.5 rounded-full bg-accent text-white h-5 min-w-5 px-1 text-[9px] font-800 shadow">
            <Flame size={9} />
            {ordersCount}
          </span>
        )}
      </div>

      {/* Infos principales */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent truncate max-w-[140px]">
            {product.brand || 'Sans marque'}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sBadge.cls}`}>
            {sBadge.label}
          </span>
          {margin.netPct < 30 && product.status === 'active' && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
              Marge faible
            </span>
          )}
          {!firstImage && (
            <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-500">
              Sans photo
            </span>
          )}
          {(!product.brand || !product.name) && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
              Incomplet
            </span>
          )}
          {!product.sourceUrl && (
            <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold text-yellow-600">
              Sans lien
            </span>
          )}
        </div>
        <div className="font-semibold text-sm sm:text-base truncate mt-0.5">
          {product.name || 'Produit sans nom'}
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5 mt-1 text-[11px] text-dark/45 flex-wrap">
          <span className="font-800 text-dark/80">{euro(product.salePrice)}</span>
          <span className="opacity-40">·</span>
          <span>¥{product.sourcePriceCny}</span>
          <span className="opacity-40">·</span>
          <span className={`font-bold ${marginColor}`}>{euro(margin.net)}</span>
          {product.sizes && (
            <>
              <span className="hidden sm:inline opacity-40">·</span>
              <span className="hidden sm:inline truncate max-w-[180px]">
                {product.sizes.split(',').map((e) => e.split(':')[0].trim()).filter(Boolean).join(', ')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions : toujours visibles sur mobile, toujours visibles au hover desktop */}
      <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-100 sm:pointer-events-auto">
          {product.sourceUrl && (
            <a
              href={product.sourceUrl}
              target="_blank"
              rel="noreferrer"
              title="Ouvrir le lien source"
              className="h-9 w-9 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-full sm:rounded-lg bg-dark/5 text-dark/50 hover:bg-dark/10 hover:text-dark/80 transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            type="button"
            title="Aperçu dans le shop"
            onClick={() => {
              try { localStorage.setItem('tof-preview-product', product.id); } catch {}
              // Open the public shop (strip #admin hash) in a new tab
              const publicUrl = window.location.origin + window.location.pathname;
              window.open(publicUrl, '_blank', 'noreferrer');
            }}
            className="h-9 w-9 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-full sm:rounded-lg bg-dark/5 text-dark/50 hover:bg-dark/10 hover:text-dark/80 transition-colors"
          >
            <span className="text-sm sm:text-[10px]">👁</span>
          </button>
        <button
          onClick={() => onDuplicate(product)}
          title="Dupliquer"
          className="h-9 w-9 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-full sm:rounded-lg bg-dark/5 text-dark/50 hover:bg-dark/10 hover:text-dark/80 transition-colors"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={() => onEdit(product)}
          title="Modifier"
          className="inline-flex items-center gap-1.5 rounded-full sm:rounded-lg bg-dark text-white h-9 px-3 sm:h-8 sm:px-3 text-xs font-semibold hover:bg-accent hover:brightness-110 transition-colors"
        >
          <Pencil size={13} />
          <span className="hidden sm:inline">Modifier</span>
        </button>
        <button
          onClick={() => onRemove(product.id)}
          title="Supprimer"
          className="h-9 w-9 sm:h-8 sm:w-8 inline-flex items-center justify-center rounded-full sm:rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// DrawerSelect : select custom (évite le bug du <select> natif dans un
// conteneur position:fixed + overflow-y:auto : popup blanche coupée / mal
// positionnée). On rend la liste dans un portail pour qu'elle s'affiche
// toujours par-dessus tout, peu importe le z-index/overflow du parent.
// ────────────────────────────────────────────────────────────────────────────
type DrawerSelectOption = { value: string; label: string };
type DrawerSelectProps = {
  value: string;
  options: DrawerSelectOption[];
  onChange: (value: string) => void;
  label?: string;
  className?: string;
};

const DrawerSelect = memo(function DrawerSelect({
  value,
  options,
  onChange,
  label,
  className = '',
}: DrawerSelectProps) {
  const [open, setOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState(260);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; above: boolean }>({
    top: 0, left: 0, width: 0, above: false,
  });

  const selected = options.find((o) => o.value === value) || options[0];

  const openMenu = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const needAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    // Hauteur max dynamique : utilise la place disponible sans dépasser 360px
    const maxHeight = Math.max(160, Math.min(360, needAbove ? spaceAbove : spaceBelow));
    setCoords({
      top: needAbove ? r.top - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      above: needAbove,
    });
    setMaxHeight(maxHeight);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      const pop = document.getElementById('drawer-select-portal');
      if (pop && pop.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      // Navigation clavier (haut/bas/entrée)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        const pop = document.getElementById('drawer-select-portal');
        if (!pop) return;
        const buttons = Array.from(pop.querySelectorAll<HTMLButtonElement>('[role="option"]'));
        const currentIdx = buttons.findIndex((b) => b.getAttribute('aria-selected') === 'true');
        let nextIdx = currentIdx;
        if (e.key === 'ArrowDown') nextIdx = (currentIdx + 1) % buttons.length;
        if (e.key === 'ArrowUp') nextIdx = (currentIdx - 1 + buttons.length) % buttons.length;
        if (e.key === 'Enter' && currentIdx >= 0) {
          buttons[currentIdx].click();
          return;
        }
        buttons[nextIdx]?.focus();
      }
    };
    // On retire le listener sur scroll de window qui fermait le menu
    // (il empêchait de scroller dans la liste avec la molette).
    // On repositionne juste à la resize, ce qui est suffisant.
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      {label && <div className="text-xs text-white/50 mb-1">{label}</div>}
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="w-full flex items-center justify-between gap-2 rounded-xl bg-white/10 border border-white/10 hover:border-accent/40 px-3 py-2.5 text-sm text-white text-left transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.label}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12"
          className={`flex-shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && createPortal(
        <div
          id="drawer-select-portal"
          role="listbox"
          className="fixed z-[60] overflow-y-auto rounded-xl bg-neutral-800 border border-white/10 shadow-2xl shadow-black/60 py-1 overscroll-contain"
          style={{
            top: coords.top,
            left: coords.left,
            width: coords.width,
            maxHeight,
            transformOrigin: coords.above ? 'bottom left' : 'top left',
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-accent text-white' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// ProductEditDrawer : panneau latéral d'édition / création
// ────────────────────────────────────────────────────────────────────────────
type ProductEditDrawerProps = {
  open: boolean;
  isNew: boolean;
  draft: Product | null;
  original: Product | null;
  onChange: (next: Product) => void;
  onClose: () => void;
  onSave: () => void;
  onDuplicate?: (p: Product) => void;
  onAutoPrice: () => void;
};

// Petit utilitaire de style pour les champs du drawer
function inputCls(hasError: boolean) {
  return `mt-1 w-full rounded-xl bg-white/10 border px-4 py-2.5 text-sm text-white outline-none transition-colors ${
    hasError
      ? 'border-red-500/50 focus:border-red-400'
      : 'border-white/10 focus:border-accent/40'
  }`;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-white/50 block">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {error && <span className="text-[10px] font-bold text-red-400">{error}</span>}
      </span>
      <div>{children}</div>
    </label>
  );
}

// ── Petits composants pour l'onglet Réglages (thème clair) ──────────────────
function SInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="text-xs text-dark/45 block">
      <span className="mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/10 focus:border-accent/40"
      />
    </label>
  );
}

function STextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="text-xs text-dark/45 block">
      <span className="mb-1 block">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/10 focus:border-accent/40 resize-none"
      />
    </label>
  );
}

function SCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg p-4">
      <h4 className="font-bold text-sm text-dark">{title}</h4>
      {subtitle && <p className="text-xs text-dark/40 mt-0.5 mb-3">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-3'}>{children}</div>
    </div>
  );
}

function DeleteBtn({ onClick, title = 'Supprimer' }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex-shrink-0 h-9 w-9 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
    >
      <Trash2 size={14} />
    </button>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-dark text-white px-4 py-2 text-xs font-bold hover:bg-accent transition-colors"
    >
      <Plus size={14} /> {label}
    </button>
  );
}

/**
 * Source URL input with auto-cleanup on paste.
 *
 * Quand tu colles un lien Mulebuy (mulebuy.com/product?id=…), l'URL est
 * extraite automatiquement et nettoyée (ponctuation de fin enlevée).
 */
function SourceUrlInput({
  value,
  onChange,
  compact = false,
  isNew = false,
}: {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
  isNew?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Don't intercept if user is pasting into a selection that's part of an
    // already-clean URL (no Chinese, no spaces, looks like a URL).
    if (value && /^https?:\/\//.test(value) && !/[\u4e00-\u9fff\s]/.test(value)) {
      return; // let default paste happen
    }
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const cleaned = extractSourceUrl(text);
    if (cleaned && cleaned !== value) {
      onChange(cleaned);
      showToast(isShortlink(cleaned) ? 'Lien extrait (shortlink) ✓' : 'Lien nettoyé ✓');
    } else {
      // Fallback: just insert pasted text
      const el = inputRef.current;
      if (el) {
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        onChange(value.slice(0, start) + text + value.slice(end));
      }
    }
  };

  const handleBlur = () => {
    const cleaned = extractSourceUrl(value);
    if (cleaned && cleaned !== value) onChange(cleaned);
  };

  return (
    <div className="relative mt-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder="Colle le lien Mulebuy (mulebuy.com/product?id=…)…"
        spellCheck={false}
        autoComplete="off"
        className={`${
          compact
            ? 'w-full rounded-xl bg-white px-4 py-2.5 sm:py-3 text-sm text-dark outline-none border border-dark/5 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-colors'
            : 'w-full rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-accent/40'
        } ${value ? 'pr-10' : ''} text-xs`}
      />
      {value && !isNew && /^https?:\/\//.test(value) && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          title="Ouvrir le lien"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
}

const ProductEditDrawer = memo(function ProductEditDrawer({
  open, isNew, draft, original, onChange, onClose, onSave, onDuplicate, onAutoPrice,
}: ProductEditDrawerProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 's' || e.key === 'Enter')) {
        e.preventDefault();
        onSave();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (inField) return;
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => firstFieldRef.current?.focus(), 150);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onSave, onClose]);

  const isDirty = useMemo(() => {
    if (!draft) return false;
    if (isNew) {
      return Boolean(draft.brand || draft.name || draft.sourceUrl || draft.imageUrl);
    }
    if (!original) return false;
    return (
      draft.brand !== original.brand ||
      draft.name !== original.name ||
      draft.sourceUrl !== original.sourceUrl ||
      draft.category !== original.category ||
      draft.gender !== original.gender ||
      draft.packaging !== original.packaging ||
      draft.status !== original.status ||
      draft.salePrice !== original.salePrice ||
      (draft.oldPrice || 0) !== (original.oldPrice || 0) ||
      draft.sourcePriceCny !== original.sourcePriceCny ||
      draft.weightGrams !== original.weightGrams ||
      draft.sizes !== original.sizes ||
      draft.colors !== original.colors ||
      draft.imageUrl !== original.imageUrl ||
      (draft.description || '') !== (original.description || '') ||
      (draft.sizeAdvice || '') !== (original.sizeAdvice || '') ||
      (draft.boxContent || '') !== (original.boxContent || '')
    );
  }, [draft, original, isNew]);

  useEffect(() => {
    if (!open || !isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, isDirty]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      if (!window.confirm('Modifications non enregistrées. Fermer sans sauvegarder ?')) return;
    }
    onClose();
  }, [isDirty, onClose]);

  if (!open || !draft) return null;

  const margin = estimateNetMargin(draft);

  const validation = {
    brand: !draft.brand.trim(),
    name: !draft.name.trim(),
    price: draft.salePrice <= 0,
  };
  const canSave = !validation.brand && !validation.name && !validation.price;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={handleClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[640px] lg:w-[760px] bg-dark text-white shadow-2xl shadow-black/40 flex flex-col">
        <div className="flex items-center justify-between gap-4 p-4 sm:p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleClose}
              aria-label="Retour"
              className="lg:hidden h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 inline-flex items-center justify-center flex-shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-accent">
                {isNew ? 'Nouveau produit' : 'Édition produit'}
              </div>
              <h3 className="font-display text-lg sm:text-xl font-800 mt-0.5 truncate flex items-center gap-2">
                {(draft.brand || draft.name) ? `${draft.brand || ''} ${draft.name ? `- ${draft.name}` : ''}` : 'Nouveau produit'}
                {isDirty && <span className="inline-block h-2 w-2 rounded-full bg-amber-400" title="Modifications non sauvegardées" />}
              </h3>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="hidden lg:inline-flex h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 items-center justify-center flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {margin.netPct < 30 && draft.status === 'active' && (
          <div className="mx-4 sm:mx-5 mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-xs text-red-200 flex items-start gap-2 flex-shrink-0">
            <span className="font-bold text-red-300">⚠ Marge faible</span>
            <span className="opacity-90">Marge nette {euro(margin.net)} ({margin.netPct.toFixed(0)}%). Augmente le prix ou vérifie le poids.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Identité</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Marque" error={validation.brand ? 'Requis' : undefined}>
                <input
                  ref={firstFieldRef}
                  value={draft.brand}
                  onChange={(e) => onChange({ ...draft, brand: e.target.value })}
                  className={inputCls(validation.brand)}
                />
              </Field>
              <Field label="Nom du produit" error={validation.name ? 'Requis' : undefined}>
                <input
                  value={draft.name}
                  onChange={(e) => onChange({ ...draft, name: e.target.value })}
                  className={inputCls(validation.name)}
                />
              </Field>
            </div>
            <Field label="Lien source (Mulebuy)">
              <SourceUrlInput
                value={draft.sourceUrl}
                onChange={(v) => onChange({ ...draft, sourceUrl: v })}
                isNew={isNew}
              />
            </Field>
          </div>

          {/* Ce que le client lit avant de se décider. Tout est facultatif :
              un produit sans description s'affiche comme avant. */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
              Description <span className="text-white/25 normal-case font-medium">— facultatif, mais ça fait vendre</span>
            </h4>
            <Field label="Description">
              <textarea
                value={draft.description || ''}
                onChange={(e) => onChange({ ...draft, description: e.target.value })}
                rows={4}
                maxLength={600}
                placeholder="Matière, coupe, finitions, détails qui rassurent. Ex : Coton épais 280g, coupe droite, broderie sur la poitrine. Finitions propres, coutures renforcées."
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-accent/40 resize-y"
              />
            </Field>
            <div className="text-[10px] text-white/25 -mt-1">
              {(draft.description || '').length}/600 caractères
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Conseil de taille">
                <input
                  value={draft.sizeAdvice || ''}
                  onChange={(e) => onChange({ ...draft, sizeAdvice: e.target.value })}
                  maxLength={120}
                  placeholder="Taille normalement"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 h-11 text-sm text-white placeholder:text-white/20 outline-none focus:border-accent/40"
                />
              </Field>
              <Field label="Contenu du colis">
                <input
                  value={draft.boxContent || ''}
                  onChange={(e) => onChange({ ...draft, boxContent: e.target.value })}
                  maxLength={120}
                  placeholder="Paire + boîte + dustbag"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 h-11 text-sm text-white placeholder:text-white/20 outline-none focus:border-accent/40"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Catégorisation</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <DrawerSelect
                label="Genre"
                value={draft.gender}
                onChange={(v) => onChange({ ...draft, gender: v as Product['gender'] })}
                options={[
                  { value: 'homme', label: 'Homme' },
                  { value: 'femme', label: 'Femme' },
                  { value: 'mixte', label: 'Mixte' },
                ]}
              />
              <DrawerSelect
                label="Catégorie"
                value={draft.category}
                onChange={(v) => {
                  const preset = categoryPresets.find((item) => item.label === v);
                  onChange({
                    ...draft,
                    category: v,
                    weightGrams: preset?.weight || draft.weightGrams,
                    packaging: preset?.packaging || draft.packaging,
                    sizes: preset ? preset.defaultSizes : draft.sizes,
                    colors: preset ? preset.defaultColors : draft.colors,
                  });
                }}
                options={categoryPresets.map((p) => ({ value: p.label, label: p.label }))}
                className="sm:col-span-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DrawerSelect
                label="Packaging"
                value={draft.packaging}
                onChange={(v) => onChange({ ...draft, packaging: v as Product['packaging'] })}
                options={[
                  { value: 'none', label: 'Standard' },
                  { value: 'without_box', label: 'Sans boîte' },
                  { value: 'with_box', label: 'Avec boîte' },
                ]}
              />
              <DrawerSelect
                label="Statut"
                value={draft.status}
                onChange={(v) => onChange({ ...draft, status: v as Product['status'] })}
                options={[
                  { value: 'active', label: 'Actif' },
                  { value: 'link_dead', label: 'Lien sauté' },
                  { value: 'paused', label: 'En pause' },
                ]}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Prix &amp; poids</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Prix vente €" error={validation.price ? '>0' : undefined}>
                <input
                  type="number"
                  value={draft.salePrice}
                  onChange={(e) => onChange({ ...draft, salePrice: Number(e.target.value) })}
                  className={inputCls(validation.price)}
                />
              </Field>
              <Field label="Prix barré €">
                <input
                  type="number"
                  value={draft.oldPrice || ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onChange({ ...draft, oldPrice: e.target.value === '' ? undefined : v });
                  }}
                  placeholder="—"
                  className={inputCls(false)}
                />
              </Field>
              <Field label="Prix source ¥">
                <input
                  type="number"
                  value={draft.sourcePriceCny}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const next = { ...draft, sourcePriceCny: v };
                    // live auto-price: recalc sale price if it looks like default/zero
                    onChange(next);
                  }}
                  className={inputCls(false)}
                />
              </Field>
              <Field label="Poids g">
                <input
                  type="number"
                  value={draft.weightGrams}
                  onChange={(e) => onChange({ ...draft, weightGrams: Number(e.target.value) })}
                  className={inputCls(false)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] pt-1">
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/60">Poids {margin.effectiveWeight}g</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/60">Livr. {euro(margin.shipping.low)}–{euro(margin.shipping.high)}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/60">+20% {euro(margin.shippingWithSafety)}</span>
              <span className={`rounded-full px-3 py-1 font-bold ${marginTone(margin.netPct).replace('bg-green-500/10', 'bg-green-500/20').replace('bg-orange-500/10', 'bg-orange-500/20').replace('bg-red-500/10', 'bg-red-500/20').replace('text-green-600', 'text-green-300').replace('text-orange-600', 'text-orange-300').replace('text-red-600', 'text-red-300')}`}>
                {marginLabel(margin.netPct)} · {euro(margin.net)} ({margin.netPct.toFixed(0)}%)
              </span>
              <button
                type="button"
                onClick={onAutoPrice}
                className="rounded-full bg-accent/20 hover:bg-accent/30 text-accent px-3 py-1 font-bold transition-colors"
              >
                ⚡ Prix auto
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Tailles &amp; variantes</h4>
            <div>
              <div className="text-[11px] text-white/40 font-semibold mb-2">Tailles</div>
              <SizePicker
                value={draft.sizes}
                onChange={(v) => onChange({ ...draft, sizes: v })}
                category={draft.category}
                theme="dark"
              />
            </div>
            <div>
              <div className="text-[11px] text-white/40 font-semibold mb-2">Variantes photo (1, 2, 3... — correspond à l'ordre des images)</div>
              <ColorPicker
                value={draft.colors}
                onChange={(v) => onChange({ ...draft, colors: v })}
                theme="dark"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">Photos produit</h4>
            <ImageUploader
              value={draft.imageUrl}
              onChange={(next) => onChange({ ...draft, imageUrl: next })}
              uploadHandler={productImageUploadHandler}
              maxSize={800}
              quality={0.75}
              label="Images"
              hint="Glisse-dépose, colle (Ctrl+V), clique ou ajoute une URL. Ordre 1:1 avec les couleurs."
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-t border-white/10 bg-black/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onAutoPrice}
              className="rounded-full bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-white/70 transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw size={12} /> Prix auto
            </button>
            {onDuplicate && !isNew && (
              <button
                onClick={() => onDuplicate(draft)}
                className="rounded-full bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-white/70 transition-colors hidden sm:inline-flex items-center gap-1.5"
              >
                <Copy size={12} /> Dupliquer
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="rounded-full bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/60 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onSave}
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent hover:brightness-110/90 disabled:bg-white/10 disabled:text-white/30 px-5 py-2.5 text-sm font-bold text-white transition-colors"
            >
              <Save size={14} />
              {isNew ? 'Créer' : 'Enregistrer'}
              <span className="hidden sm:inline text-xs opacity-60 font-normal ml-1">⌘S</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});


// ────────────────────────────────────────────────────────────────────────────
// OrderCard (mémoïsé)
// ────────────────────────────────────────────────────────────────────────────
type OrderCardProps = {
  order: Order;
  product: Product;
  margin: ReturnType<typeof estimateNetMargin>;
  copied: boolean;
  copiedPayment: boolean;
  onFieldChange: (id: string, field: string, value: string) => void;
  onCopyOrder: (order: Order) => void;
  onCopyClientMessage: (order: Order, type: 'payment' | 'paid' | 'tracking' | 'delay' | 'reminder') => void;
  whatsappLink: (order: Order, type: 'payment' | 'paid' | 'tracking' | 'delay' | 'reminder') => string;
};

/**
 * Photos de contrôle qualité : l'admin photographie l'article avant expédition,
 * le client les voit sur la page #suivi. C'est LE point qui rassure sur ce
 * type de boutique.
 */
function QcPhotos({
  order,
  onFieldChange,
}: {
  order: Order;
  onFieldChange: (id: string, field: string, value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const photos = (order.qcPhotos || '').split(',').map((u) => u.trim()).filter(Boolean);

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        const res = await uploadQcPhoto(file);
        uploaded.push(res.url);
      }
      onFieldChange(order.id, 'qc_photos', [...photos, ...uploaded].join(', '));
    } catch {
      alert("L'upload a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removePhoto = (url: string) => {
    onFieldChange(order.id, 'qc_photos', photos.filter((p) => p !== url).join(', '));
  };

  return (
    <div className="mt-4 rounded-2xl bg-bg p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-dark/45">
            📸 Photos QC {photos.length > 0 && `(${photos.length})`}
          </div>
          <p className="text-[11px] text-dark/35 mt-0.5">
            Visibles par le client sur la page de suivi.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-full bg-dark px-4 py-2 text-xs font-bold text-white hover:bg-accent transition-colors disabled:opacity-50"
        >
          {busy ? 'Envoi…' : 'Ajouter'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void addPhotos(e.target.files)}
        />
      </div>

      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((url) => (
            <div key={url} className="relative group/qc">
              <img src={url} alt="Photo QC" className="h-20 w-20 rounded-xl object-cover border border-dark/10" />
              <button
                onClick={() => removePhoto(url)}
                className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-red-500 text-white grid place-items-center shadow-md"
                aria-label="Supprimer la photo"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Marqueur interne posé par le bot quand il n'a pas su répondre. */
const ESCALATION_TAG = '⚠️ À REPRENDRE';

type ConvoData = {
  name: string;
  messages: DbChatMessage[];
  lastMsg: DbChatMessage;
  hasUnread: boolean;
  /** Le bot a séché : question à reprendre à la main. */
  needsHelp: boolean;
  /** Minutes d'attente depuis le dernier message client sans réponse. */
  waitingMinutes: number;
  /** Nombre de messages envoyés par le client. */
  clientCount: number;
};

const OrderCard = memo(function OrderCard({ order, product, margin, copied, copiedPayment, onFieldChange, onCopyOrder, onCopyClientMessage, whatsappLink }: OrderCardProps) {
  return (
    <div className="rounded-3xl bg-white text-dark p-5 shadow-xl shadow-black/10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">{rootOrderId(order.id)}</span>
            <span className="rounded-full bg-dark/5 px-3 py-1 text-xs font-semibold text-dark/45">
              {statusLabels[order.status]}
            </span>
            {/* Signal clair : ne rien commander tant que ce n'est pas encaissé. */}
            {(order.paymentStatus || 'pending') === 'pending' && order.status !== 'done' && (
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-600">
                ⏳ NON PAYÉE — ne pas commander
              </span>
            )}
            {order.paymentStatus === 'paid' && (
              <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-black text-green-700">
                ✓ PAYÉE
              </span>
            )}
          </div>
          <h3 className="font-bold">
            {order.items && order.items.length > 1
              ? `${order.items.length} articles`
              : `${product.brand} - ${product.name}`}
          </h3>
          <p className="text-sm text-dark/45 mt-1">
            {order.items && order.items.length > 1
              ? `pour ${order.customerName}`
              : `${order.size} / ${order.color} / x${order.quantity} pour ${order.customerName}`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={order.paymentStatus || 'pending'}
            onChange={(event) => onFieldChange(order.id, 'paymentStatus', event.target.value)}
            className="rounded-xl bg-bg px-3 py-2 text-xs font-semibold outline-none"
          >
            {Object.entries(paymentLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={order.status}
            onChange={(event) => onFieldChange(order.id, 'status', event.target.value)}
            className="rounded-xl bg-bg px-3 py-2 text-xs font-semibold outline-none"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {order.items && order.items.length > 1 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold text-dark/35">Articles de la commande</div>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-bg p-3">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-accent uppercase">{item.brand}</span>
                <div className="text-sm font-semibold text-dark truncate">{item.name}</div>
                <div className="text-xs text-dark/40">{item.size} / {item.color} × {item.quantity}</div>
              </div>
              <span className="text-sm font-800 text-dark flex-shrink-0">{euro(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between rounded-xl bg-dark/5 p-3">
            <span className="text-xs font-bold text-dark/50">Total commande</span>
            <span className="text-sm font-800 text-dark">{euro(order.items.reduce((s, i) => s + i.price * i.quantity, 0))}</span>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mt-5 text-sm">
        <div className="rounded-2xl bg-bg p-4">
          <div className="text-dark/35 text-xs">Client</div>
          <div className="font-semibold mt-1">{order.customerName}</div>
          <div className="text-dark/45 text-xs mt-1">{order.phone}</div>
        </div>
        <div className="rounded-2xl bg-bg p-4">
          <div className="text-dark/35 text-xs">Adresse</div>
          <div className="font-semibold mt-1">{order.city}, {order.zip}</div>
          <div className="text-dark/45 text-xs mt-1">{order.country}</div>
        </div>
        <div className="rounded-2xl bg-bg p-4">
          <div className="text-dark/35 text-xs">Livraison estimée</div>
          <div className="font-semibold mt-1">{euro(margin.shipping.low)} - {euro(margin.shipping.high)}</div>
          <div className="text-dark/45 text-xs mt-1">{margin.shipping.label} · {margin.effectiveWeight}g</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 font-bold ${marginTone(margin.netPct)}`}>
          Marge {marginLabel(margin.netPct)} : {euro(margin.net)} ({margin.netPct.toFixed(0)}%)
        </span>
        <span className="rounded-full bg-dark/5 px-3 py-1 text-dark/40">
          Livraison securisee (+20%) : {euro(margin.shippingWithSafety)}
        </span>
        <span className="rounded-full bg-dark/5 px-3 py-1 text-dark/40">
          Frais paiement : {euro(margin.paymentFees)}
        </span>
      </div>

      <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-2">
        <input
          value={order.tracking || ''}
          onChange={(event) => onFieldChange(order.id, 'tracking', event.target.value)}
          placeholder="Tracking colis"
          className="rounded-xl bg-bg px-4 py-3 text-sm outline-none"
        />
        <a
          href={whatsappLink(order, 'tracking')}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-[#25D366]/10 px-4 py-3 text-center text-sm font-bold text-[#1cae54] hover:bg-[#25D366]/20 transition-colors"
        >
          Envoyer tracking
        </a>
      </div>

      <QcPhotos order={order} onFieldChange={onFieldChange} />

      <div className="flex flex-wrap gap-2 mt-5">
        <button
          onClick={() => onCopyOrder(order)}
          className="inline-flex items-center gap-2 rounded-full bg-dark px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-accent hover:brightness-110 transition-colors"
        >
          <Copy size={14} /> {copied ? 'Copie !' : 'Mulebuy'}
        </button>
        <a
          href={product.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-dark/5 px-5 py-3 text-sm font-semibold text-dark/60 hover:bg-dark/10 transition-colors"
        >
          <ExternalLink size={15} /> Ouvrir lien source
        </a>
        <a href={whatsappLink(order, 'payment')} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366]/10 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[#1cae54] hover:bg-[#25D366]/20 transition-colors">
          WA paiement
        </a>
        <a href={whatsappLink(order, 'reminder')} target="_blank" rel="noreferrer" className="rounded-full bg-accent/10 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-accent hover:bg-accent/20 transition-colors">
          WA relance
        </a>
        <a href={whatsappLink(order, 'paid')} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366]/10 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[#1cae54] hover:bg-[#25D366]/20 transition-colors">
          WA paye
        </a>
        <a href={whatsappLink(order, 'delay')} target="_blank" rel="noreferrer" className="rounded-full bg-dark/5 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-dark/60 hover:bg-dark/10 transition-colors">
          WA retard
        </a>
        <button onClick={() => onCopyClientMessage(order, 'payment')} className="rounded-full bg-dark/5 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-dark/60 hover:bg-dark/10 transition-colors">
          {copiedPayment ? 'Copie !' : 'Copier'}
        </button>
      </div>
    </div>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// AdminPanel
// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// EstimatorTab : calculateur de marge rapide ¥ + poids → prix suggéré
// ────────────────────────────────────────────────────────────────────────────
type EstimatorTabProps = {
  products: Product[];
  selectedEstimateProduct: string;
  setSelectedEstimateProduct: (id: string) => void;
  getProduct: (id: string) => Product;
};

function EstimatorTab({ products, selectedEstimateProduct, setSelectedEstimateProduct, getProduct }: EstimatorTabProps) {
  // Calculateur rapide (sans produit existant)
  const [cny, setCny] = useState(150);
  const [weight, setWeight] = useState(900);
  const [packaging, setPackaging] = useState<'none' | 'without_box' | 'with_box'>('none');
  const [salePrice, setSalePrice] = useState(75);
  const [qty, setQty] = useState(1);

  const product = products.length > 0 ? getProduct(selectedEstimateProduct) : null;
  const productMargin = product ? estimateNetMargin(product) : null;

  // Auto-prix suggéré sur le calculateur
  useEffect(() => {
    setSalePrice(suggestedSalePrice(cny, weight, packaging, 45));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cny, weight, packaging]);

  const q = estimateQuickMargin(cny, weight, salePrice, packaging, qty);
  const suggested = suggestedSalePrice(cny, weight, packaging, 45);
  const suggestedConservative = suggestedSalePrice(cny, weight, packaging, 50);

  const tone = (pct: number) =>
    pct >= 45 ? 'bg-green-500/10 text-green-700 border-green-500/20' :
    pct >= 30 ? 'bg-orange-500/10 text-orange-700 border-orange-500/20' :
    'bg-red-500/10 text-red-600 border-red-500/20';
  const toneLabel = (pct: number) =>
    pct >= 45 ? 'Bonne marge' :
    pct >= 30 ? 'Marge juste' :
    'Danger — perte possible';

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Calculateur ¥ → € rapide */}
      <div className="rounded-3xl bg-white text-dark p-6 space-y-5">
        <h3 className="font-bold text-xl flex items-center gap-2">
          <Calculator size={20} className="text-accent" /> Calculateur ¥ → €
        </h3>
        <p className="text-sm text-dark/40 -mt-3">
          Entre le prix source en <b>¥ CNY</b> (celui affiché sur Mulebuy) et le poids estimé. Le taux utilisé est <b>7.5 ¥ = 1 €</b> (commission agent 6% incluse).
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="space-y-1 col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dark/35">Prix source (¥)</span>
            <input type="number" min={0} value={cny} onChange={(e) => setCny(Number(e.target.value) || 0)}
              className="w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold outline-none focus:ring-4 focus:ring-accent/5" />
          </label>
          <label className="space-y-1 col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dark/35">Poids (g)</span>
            <input type="number" min={100} step={50} value={weight} onChange={(e) => setWeight(Number(e.target.value) || 0)}
              className="w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold outline-none focus:ring-4 focus:ring-accent/5" />
          </label>
          <label className="space-y-1 col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dark/35">Quantité</span>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold outline-none focus:ring-4 focus:ring-accent/5" />
          </label>
          <label className="space-y-1 col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dark/35">Boîte</span>
            <select value={packaging} onChange={(e) => setPackaging(e.target.value as typeof packaging)}
              className="w-full rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold outline-none">
              <option value="none">Sans boîte</option>
              <option value="without_box">Sans boîte (-100g)</option>
              <option value="with_box">Avec boîte (+450g)</option>
            </select>
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-dark/35">Prix de vente (€)</span>
          <div className="flex gap-2">
            <input type="number" min={0} value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
              className="flex-1 rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold outline-none focus:ring-4 focus:ring-accent/5" />
            <button type="button" onClick={() => setSalePrice(suggested)}
              className="rounded-xl bg-accent text-white px-4 text-xs font-bold hover:bg-accent/90">
              Auto 45%
            </button>
            <button type="button" onClick={() => setSalePrice(suggestedConservative)}
              className="rounded-xl bg-dark text-white px-4 text-xs font-bold hover:bg-dark/80">
              Sécu 50%
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {[55, 65, 70, 75, 85, 95, 110, 120].map((p) => (
              <button key={p} type="button" onClick={() => setSalePrice(p)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                  salePrice === p ? 'bg-accent text-white' : 'bg-bg text-dark/50 hover:bg-dark/10'
                }`}>
                {p}€
              </button>
            ))}
          </div>
        </label>

        {/* Détail des coûts */}
        <div className="rounded-2xl bg-bg p-4 text-sm space-y-2">
          <div className="flex justify-between"><span className="text-dark/50">Prix article {qty > 1 ? `×${qty}` : ''}</span><span className="font-semibold">{q.sourceCost.toFixed(2)} €</span></div>
          <div className="flex justify-between"><span className="text-dark/50">Livraison tax-free (sécurité 20%)</span><span className="font-semibold">{q.shippingWithSafety.toFixed(2)} €</span></div>
          <div className="flex justify-between"><span className="text-dark/50">Frais SumUp 2,5%</span><span className="font-semibold">{q.paymentFees.toFixed(2)} €</span></div>
          <div className="flex justify-between"><span className="text-dark/50">Provision retours/pertes 3%</span><span className="font-semibold">{q.riskProvision.toFixed(2)} €</span></div>
          <div className="border-t border-dark/10 pt-2 flex justify-between">
            <span className="text-dark/70 font-bold">Coût total</span><span className="font-bold">{q.totalCost.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dark/70">Chiffre d'affaires</span><span className="font-semibold">{(salePrice * qty).toFixed(2)} €</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="font-bold">Marge nette</span>
            <span className={`rounded-full px-3 py-1 font-bold text-sm ${tone(q.netPct)} border`}>
              {q.net.toFixed(2)} € · {q.netPct.toFixed(0)}%
            </span>
          </div>
          <div className="text-[11px] text-dark/40 pt-1">{toneLabel(q.netPct)}. Poids retenu : {q.effWeight}g · Livraison estimée {q.shipping.low.toFixed(2)}–{q.shipping.high.toFixed(2)}€.</div>
        </div>

        {qty > 1 && (
          <div className="rounded-2xl bg-accent/10 border border-accent/20 p-3 text-sm">
            <b className="text-accent">×{qty} articles</b> — marge totale <b>{q.net.toFixed(2)} €</b> (soit {(q.net / qty).toFixed(2)} € / article).
            Les commandes multiples augmentent la marge grâce au groupage de port.
          </div>
        )}
      </div>

      {/* Estimation produit existant */}
      <div className="space-y-5">
        <div className="rounded-3xl bg-white text-dark p-6">
          <h3 className="font-bold text-xl flex items-center gap-2"><Truck size={20} /> Marge d'un produit existant</h3>
          <p className="text-sm text-dark/40 mt-2">Sélectionne un produit de ta boutique pour voir sa marge réelle.</p>
          {products.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-bg p-6 text-center text-sm text-dark/40">Ajoute un produit d'abord.</div>
          ) : (
            <>
              <select
                value={selectedEstimateProduct}
                onChange={(event) => setSelectedEstimateProduct(event.target.value)}
                className="mt-5 w-full rounded-2xl bg-bg px-5 py-4 text-sm font-semibold outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.brand} - {p.name} · {p.salePrice}€</option>
                ))}
              </select>
              {productMargin && product && (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {(['economy', 'tax_free', 'express'] as const).map((line) => {
                      const est = estimateMulebuyShipping(productMargin.effectiveWeight, line);
                      return (
                        <div key={line} className="rounded-2xl bg-bg p-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-dark/35">{est.label}</div>
                          <div className="font-800 text-base mt-1">{est.low.toFixed(2)} €</div>
                          <div className="text-[10px] text-dark/35">à {est.high.toFixed(2)} €</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="rounded-2xl bg-bg p-4 text-sm space-y-1.5">
                    <div className="flex justify-between"><span className="text-dark/50">Poids retenu</span><span className="font-semibold">{productMargin.effectiveWeight}g</span></div>
                    <div className="flex justify-between"><span className="text-dark/50">Prix source</span><span className="font-semibold">{product.sourcePriceCny} ¥ · {productMargin.sourceCost.toFixed(2)} €</span></div>
                    <div className="flex justify-between"><span className="text-dark/50">Livraison sécu</span><span className="font-semibold">{productMargin.shippingWithSafety.toFixed(2)} €</span></div>
                    <div className="flex justify-between"><span className="text-dark/50">Frais paiement</span><span className="font-semibold">{productMargin.paymentFees.toFixed(2)} €</span></div>
                    <div className="flex justify-between"><span className="text-dark/50">Provision risques</span><span className="font-semibold">{productMargin.riskProvision.toFixed(2)} €</span></div>
                    <div className="border-t border-dark/10 pt-2 flex justify-between items-center">
                      <span className="font-bold">Marge nette</span>
                      <span className={`rounded-full px-3 py-1 font-bold ${marginTone(productMargin.netPct)}`}>
                        {productMargin.net.toFixed(2)} € · {productMargin.netPct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Aide / taux */}
        <div className="rounded-3xl bg-white/5 border border-white/10 p-6 text-white/80">
          <h3 className="font-bold text-xl flex items-center gap-2"><Package size={20} /> Taux & règles utilisées</h3>
          <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Taux ¥→€</div>
              <div className="text-lg font-800 mt-1">1 € = 7.5 ¥</div>
              <div className="text-[11px] text-white/40">commission agent 6% incluse</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Port tax-free</div>
              <div className="text-lg font-800 mt-1">~10.7 €/kg</div>
              <div className="text-[11px] text-white/40">GD-EMS 10-20j + marge sécu 20%</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Frais paiement</div>
              <div className="text-lg font-800 mt-1">2,5%</div>
              <div className="text-[11px] text-white/40">SumUp lien de paiement</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Risques</div>
              <div className="text-lg font-800 mt-1">3% du CA</div>
              <div className="text-[11px] text-white/40">retours, pertes, douane</div>
            </div>
          </div>
          <div className="mt-5 space-y-2 text-sm text-white/50 leading-relaxed">
            <p><b className="text-white/80">Règle simple :</b> vise <b>≥45% de marge nette</b> (bouton Auto), mets <b>50% (Sécu)</b> sur les pièces à risque (premium, tailles rares).</p>
            <p>En dessous de 30%, c'est dangereux : un retour ou une saisie douanière et tu perds de l'argent.</p>
            <p>Les prix ronds "finissant par 5" (65/75/85€) convertissent mieux que les prix ronds à 0.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  // La garde d'accès repose sur la session Supabase Auth (plus sur un drapeau
  // sessionStorage posé par l'ancien mot de passe en dur).
  // null = vérification en cours, on n'affiche pas encore "non autorisé".
  const [isAdminAuthed, setIsAdminAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setIsAdminAuthed(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminAuthed(Boolean(session));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products' | 'drop' | 'promos' | 'settings' | 'estimate' | 'notes' | 'chat'>('dashboard');
  const [notes, setNotes] = useState<DbNote[]>([]);
  const [noteFilter, setNoteFilter] = useState<'all' | 'idea' | 'todo' | 'urgent' | 'done'>('all');
  const [newNote, setNewNote] = useState({ text: '', category: 'todo' });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [noteSort, setNoteSort] = useState<'priority' | 'date'>('priority');
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatSearch, setChatSearch] = useState('');
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'needsHelp'>('all');
  const [notifOn, setNotifOn] = useState(false);
  const [chatMessages, setChatMessages] = useState<DbChatMessage[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [chatReply, setChatReply] = useState('');
  const [promoCodes, setPromoCodes] = useState<DbPromoCode[]>([]);
  const [newPromo, setNewPromo] = useState({ code: '', discount: 15, maxUses: 0, expiresIn: '' });

  // ── Conversations chat (dérivées de chatMessages) ──
  const convoMap = useMemo(() => {
    const convos = new Map<string, ConvoData>();
    chatMessages.forEach((m) => {
      const existing = convos.get(m.conversation_id);
      if (existing) {
        existing.messages.push(m);
        existing.lastMsg = m;
        if (m.sender === 'client') {
          const hasAdminReply = existing.messages.some(
            (x) => x.sender === 'admin' && x.id > m.id,
          );
          existing.hasUnread = !hasAdminReply;
        }
      } else {
        convos.set(m.conversation_id, {
          name: m.client_name || 'Anonyme',
          messages: [m],
          lastMsg: m,
          hasUnread: m.sender === 'client',
          needsHelp: false,
          waitingMinutes: 0,
          clientCount: 0,
        });
      }
    });

    // Enrichissement : signaux utiles pour prioriser les réponses
    convos.forEach((c) => {
      // "À répondre" = le dernier message client n'a aucune réponse admin après lui.
      const lastClientIdx = c.messages.map((m) => m.sender).lastIndexOf('client');
      c.hasUnread = lastClientIdx >= 0
        && !c.messages.some((m, i) => i > lastClientIdx && m.sender === 'admin');

      // Le bot a laissé un marqueur "à reprendre" → question sans réponse
      c.needsHelp = c.messages.some((m) => m.message.startsWith(ESCALATION_TAG));

      c.clientCount = c.messages.filter((m) => m.sender === 'client').length;

      // Depuis combien de temps le client attend-il une réponse humaine ?
      if (c.hasUnread) {
        const lastClient = [...c.messages].reverse().find((m) => m.sender === 'client');
        if (lastClient?.created_at) {
          c.waitingMinutes = Math.max(
            0,
            Math.round((Date.now() - new Date(lastClient.created_at).getTime()) / 60000),
          );
        }
      }
    });

    return convos;
  }, [chatMessages]);

  const convoList = useMemo(() => {
    let list = Array.from(convoMap.entries());

    // Recherche : nom du client ou contenu des messages
    const q = chatSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(([, c]) =>
        c.name.toLowerCase().includes(q)
        || c.messages.some((m) => m.message.toLowerCase().includes(q)));
    }

    if (chatFilter === 'unread') list = list.filter(([, c]) => c.hasUnread);
    if (chatFilter === 'needsHelp') list = list.filter(([, c]) => c.needsHelp);

    // Tri par priorité : d'abord ceux que le bot n'a pas su traiter, puis
    // les non-répondus (le plus ancien en attente en premier), puis le reste.
    list.sort((a, b) => {
      const [, x] = a; const [, y] = b;
      if (x.needsHelp !== y.needsHelp) return Number(y.needsHelp) - Number(x.needsHelp);
      if (x.hasUnread !== y.hasUnread) return Number(y.hasUnread) - Number(x.hasUnread);
      if (x.hasUnread && y.hasUnread) return y.waitingMinutes - x.waitingMinutes;
      return (y.lastMsg.created_at || '').localeCompare(x.lastMsg.created_at || '');
    });
    return list;
  }, [convoMap, chatSearch, chatFilter]);

  /** Délai de première réponse humaine, sur les 20 dernières conversations. */
  const avgResponseMinutes = useMemo(() => {
    const deltas: number[] = [];
    Array.from(convoMap.values()).slice(0, 20).forEach((c) => {
      for (let i = 0; i < c.messages.length - 1; i += 1) {
        const cur = c.messages[i];
        const nxt = c.messages.find((m, j) => j > i && m.sender === 'admin');
        if (cur.sender === 'client' && nxt?.created_at && cur.created_at) {
          const d = (new Date(nxt.created_at).getTime() - new Date(cur.created_at).getTime()) / 60000;
          if (d >= 0 && d < 60 * 24) deltas.push(d);
          break;
        }
      }
    });
    if (!deltas.length) return null;
    return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
  }, [convoMap]);

  const needsHelpTotal = useMemo(
    () => Array.from(convoMap.values()).filter((c) => c.needsHelp).length,
    [convoMap],
  );

  // Auto-sélection de la première conversation non-lue à l'arrivée
  useEffect(() => {
    if (!activeConvo && convoList.length > 0) {
      const firstUnread = convoList.find(([, c]) => c.hasUnread);
      setActiveConvo(firstUnread ? firstUnread[0] : convoList[0][0]);
    }
  }, [activeConvo, convoList]);

  function timeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'à l\'instant';
    if (m < 60) return `il y a ${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h}h`;
    const d = Math.floor(h / 24);
    return `il y a ${d}j`;
  }

  function formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // Messages rapides admin
  /** Personnalise une réponse rapide avec le prénom du client si on le connaît. */
  const personalize = useCallback((text: string, name?: string) => {
    const first = (name || '').trim().split(/\s+/)[0];
    if (!first || first.toLowerCase() === 'anonyme') return text;
    return text.replace(/^Salut !/, `Salut ${first} !`);
  }, []);

  const quickReplies = useMemo(() => [
    'Salut ! Comment puis-je t\'aider ?',
    'Je regarde ça et je reviens vers toi rapidement.',
    'Tu peux commander directement depuis le shop, le lien est dans la bio !',
    'Le paiement se fait par carte via SumUp, lien de paiement sécurisé disponible après validation du panier.',
    'Les délais de livraison sont de 10-20 jours en standard, 5-10 jours en express.',
    'Je t\'envoie les photos QC très vite !',
    'C\'est noté, je m\'en occupe.',
  ], []);

  const sendAdminReply = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? chatReply).trim();
    if (!text || !activeConvo) return;
    const convo = convoMap.get(activeConvo);
    const msg: DbChatMessage = {
      id: `m-admin-${Date.now()}`,
      conversation_id: activeConvo,
      sender: 'admin',
      message: text,
      client_name: convo?.name || '',
    };
    await sendChatMessage(msg);
    setChatMessages((prev) => [...prev, msg]);
    setChatReply('');
    showToast('Réponse envoyée ✓');
    playNewOrder();
  }, [chatReply, activeConvo, convoMap]);

  const activeMessages = activeConvo ? convoMap.get(activeConvo)?.messages || [] : [];
  const activeConvoData = activeConvo ? convoMap.get(activeConvo) : null;

  /** Commandes rattachées au client de la conversation active (rapprochement par nom). */
  const activeConvoOrders = useMemo(() => {
    const name = activeConvoData?.name?.trim().toLowerCase();
    if (!name || name === 'anonyme') return [];
    return orders
      .filter((o) => o.customerName?.trim().toLowerCase() === name)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [orders, activeConvoData]);

  /** Numéro connu du client, pour ouvrir WhatsApp directement sur la bonne discussion. */
  const activeConvoPhone = useMemo(() => {
    const raw = activeConvoOrders.find((o) => o.phone?.trim())?.phone || '';
    const digits = raw.replace(/[^\d+]/g, '');
    if (!digits) return '';
    if (digits.startsWith('+')) return digits.slice(1);
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.startsWith('0')) return `33${digits.slice(1)}`;
    return digits;
  }, [activeConvoOrders]);

  const unreadTotal = Array.from(convoMap.values()).filter((c) => c.hasUnread).length;
  const todayMsgCount = useMemo(() => chatMessages.filter((m) => {
    if (!m.created_at) return false;
    return new Date(m.created_at).toDateString() === new Date().toDateString();
  }).length, [chatMessages]);

  // Drawer produit (remplace l'édition inline editingId/draftProduct)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerIsNew, setDrawerIsNew] = useState(false);
  const [drawerDraft, setDrawerDraft] = useState<Product | null>(null);
  const [drawerOriginal, setDrawerOriginal] = useState<Product | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebounce(productSearch, 180);
  type ProductFilter = 'all' | 'active' | 'low_margin' | 'link_dead' | 'paused' | 'no_photo';
  type ProductSort = 'name' | 'price_desc' | 'margin_desc' | 'margin_asc' | 'orders_desc' | 'recent';
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [productSort, setProductSort] = useState<ProductSort>('name');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    tone?: 'danger' | 'accent';
    onConfirm?: () => void;
  }>({ open: false, title: '' });
  const [selectedEstimateProduct, setSelectedEstimateProduct] = useState<string>('');
  const [newOrder, setNewOrder] = useState<Omit<Order, 'id' | 'status'>>({
    productId: products[0]?.id || '',
    size: '42',
    color: 'Black',
    quantity: 1,
    customerName: '',
    phone: '',
    address: '',
    city: '',
    zip: '',
    country: 'France',
    snapOrWhatsapp: '',
  });
  const defaultPreset = categoryPresets.find((preset) => preset.label === 'T-shirt') || categoryPresets[0];
  const [quickProduct, setQuickProduct] = useState<Omit<Product, 'id' | 'status'>>({
    brand: '',
    name: '',
    category: defaultPreset.label,
    salePrice: suggestedSalePrice(100, defaultPreset.weight, defaultPreset.packaging),
    oldPrice: undefined,
    sourcePriceCny: 100,
    weightGrams: defaultPreset.weight,
    packaging: defaultPreset.packaging,
    sizes: defaultPreset.defaultSizes,
    colors: defaultPreset.defaultColors,
    imageUrl: '',
    gender: 'mixte',
    sourceUrl: '',
  });
  const [dropDraft, setDropDraft] = useState<FeaturedDropConfig>(defaultDrop);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({ ...defaultSettings });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'vitrine' | 'avis' | 'faq' | 'comment' | 'pourquoi' | 'footer' | 'marques' | 'nouveautes' | 'lancement' | 'apparence'>('vitrine');

  const totals = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        acc.stockValue += product.sourcePriceCny * CNY_TO_EUR;
        acc.avgMargin += estimateNetMargin(product).net;
        return acc;
      },
      { stockValue: 0, avgMargin: 0 },
    );
  }, [products]);

  // Compte de commandes par produit (pour le badge 🔥)
  const ordersCountByProduct = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      if (o.items && o.items.length > 1) {
        o.items.forEach((it) => map.set(it.productId, (map.get(it.productId) || 0) + it.quantity));
      } else {
        map.set(o.productId, (map.get(o.productId) || 0) + o.quantity);
      }
    });
    return map;
  }, [orders]);

  // Filtre + tri + recherche produits (debounced pour la recherche)
  const filteredProducts = useMemo(() => {
    const q = debouncedProductSearch.trim().toLowerCase();
    let list = products;
    if (q) {
      list = list.filter((p) =>
        p.brand.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sourceUrl.toLowerCase().includes(q),
      );
    }
    if (productFilter !== 'all') {
      list = list.filter((p) => {
        const m = estimateNetMargin(p).net;
        const firstImg = p.imageUrl.split('|').map((s) => s.trim()).find(Boolean);
        if (productFilter === 'active') return p.status === 'active';
        if (productFilter === 'link_dead') return p.status === 'link_dead';
        if (productFilter === 'paused') return p.status === 'paused';
        if (productFilter === 'low_margin') return p.status === 'active' && m < 20;
        if (productFilter === 'no_photo') return !firstImg;
        return true;
      });
    }
    const sorted = [...list];
    switch (productSort) {
      case 'price_desc': sorted.sort((a, b) => b.salePrice - a.salePrice); break;
      case 'margin_desc': sorted.sort((a, b) => estimateNetMargin(b).net - estimateNetMargin(a).net); break;
      case 'margin_asc': sorted.sort((a, b) => estimateNetMargin(a).net - estimateNetMargin(b).net); break;
      case 'orders_desc': sorted.sort((a, b) => (ordersCountByProduct.get(b.id) || 0) - (ordersCountByProduct.get(a.id) || 0)); break;
      case 'recent': sorted.sort((a, b) => (b.id > a.id ? 1 : -1)); break;
      case 'name':
      default: sorted.sort((a, b) => {
        const an = `${a.brand} ${a.name}`.toLowerCase();
        const bn = `${b.brand} ${b.name}`.toLowerCase();
        return an.localeCompare(bn, 'fr');
      });
    }
    return sorted;
  }, [products, debouncedProductSearch, productFilter, productSort, ordersCountByProduct]);

  // Compteurs pour les filtres
  const productCounts = useMemo(() => {
    const c = { all: products.length, active: 0, low_margin: 0, link_dead: 0, paused: 0, no_photo: 0 };
    products.forEach((p) => {
      const firstImg = p.imageUrl.split('|').map((s) => s.trim()).find(Boolean);
      if (p.status === 'active') c.active++;
      if (p.status === 'link_dead') c.link_dead++;
      if (p.status === 'paused') c.paused++;
      if (p.status === 'active' && estimateNetMargin(p).net < 20) c.low_margin++;
      if (!firstImg) c.no_photo++;
    });
    return c;
  }, [products]);

  // ── Supabase load ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dbProds, dbOrds, dbDr, dbNotes, dbChat, dbPromos] = await Promise.all([fetchProducts(), fetchOrders(), fetchDrop(), fetchNotes(), fetchConversations(), fetchPromoCodes()]);
      await hydrateSiteSettings();
      setProducts(dbProds.map(dbToProduct).map(normalizedProduct));
      setOrders(dbOrds.map(dbToOrder));
      if (dbDr) setDropDraft(dbToDrop(dbDr));
      setNotes(dbNotes);
      setChatMessages(dbChat);
      setPromoCodes(dbPromos);
      setSiteSettings(readSiteSettings());
    } catch (e) { console.error('load error', e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    trackVisitor('admin');
    onOnlineCountChange(setOnlineCount);
  }, [loadAll]);

  // Sync sélecteurs quand les produits chargent
  useEffect(() => {
    if (products.length === 0) return;
    const exists = products.some((p) => p.id === selectedEstimateProduct);
    if (!exists) setSelectedEstimateProduct(products[0].id);
    const orderExists = products.some((p) => p.id === newOrder.productId);
    if (!orderExists) setNewOrder((prev) => ({ ...prev, productId: products[0].id }));
  }, [products, selectedEstimateProduct, newOrder.productId]);

  useEffect(() => {
    setNotifOn(notificationsEnabled());
  }, []);

  const toggleNotifications = useCallback(async () => {
    if (notifOn) {
      setNotificationsEnabled(false);
      setNotifOn(false);
      showToast('Notifications désactivées');
      return;
    }
    const result = await requestNotifications();
    if (result === 'granted') {
      setNotifOn(true);
      showToast('Notifications activées ✓');
    } else if (result === 'denied') {
      showToast('Notifications bloquées dans les réglages du navigateur');
    } else if (result === 'unsupported') {
      showToast('Ce navigateur ne gère pas les notifications');
    }
  }, [notifOn]);

  useEffect(() => {
    const unsubOrders = subscribeToOrders(
      () => {
        fetchOrders().then((data) => setOrders(data.map(dbToOrder)));
        showToast('Nouvelle commande reçue !');
        playNewOrder();
        notify('🛒 Nouvelle commande', 'Une commande vient de tomber sur tof. — ouvre le panel pour la traiter.', 'order');
      },
      () => {
        fetchOrders().then((data) => setOrders(data.map(dbToOrder)));
      },
    );
    const unsubProducts = subscribeToProducts(() => {
      fetchProducts().then((data) => setProducts(data.map(dbToProduct).map(normalizedProduct)));
    });
    const unsubChat = subscribeToChatMessages(() => {
      fetchConversations().then(setChatMessages);
      showToast('Nouveau message chat !');
      notify('💬 Nouveau message', 'Un client vient de t\'écrire dans le chat.', 'chat');
    });
    return () => {
      unsubOrders();
      unsubProducts();
      unsubChat();
    };
  }, []);

  // ── Save helpers ──
  const saveProducts = async (
    next: Product[] | ((prev: Product[]) => Product[]),
    itemToSave?: Product,
  ) => {
    setProducts((prev) => (typeof next === 'function' ? next(prev) : next));
    if (itemToSave) {
      try {
        await upsertProduct(productToDb(itemToSave));
      } catch (err) {
        console.error('save product failed', err);
        showToast('Erreur lors de la sauvegarde du produit');
        fetchProducts()
          .then((data) => setProducts(data.map(dbToProduct).map(normalizedProduct)))
          .catch(() => { /* dernier filet */ });
        return;
      }
    }
    showToast('Mise à jour réussie ✓');
  };

  // Supprime un produit AVEC confirmation (via dialog custom) + undo (6s) + nettoyage
  // des fichiers orphelins dans Supabase Storage.
  const removeProduct = useCallback(async (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Supprimer ce produit ?',
      message: 'Cette action est irréversible. Tu peux annuler dans les 6 secondes qui suivent.',
      confirmLabel: 'Supprimer',
      tone: 'danger',
      onConfirm: async () => {
        setConfirmDialog((c) => ({ ...c, open: false }));
        // Copie avant suppression pour permettre l'undo
        const deleted = productsRef.current.find((p) => p.id === id);
        const snapshot = productsRef.current;
        await dbDeleteProduct(id);
        setProducts((prev) => prev.filter((p) => p.id !== id));
        if (drawerDraft?.id === id) {
          setDrawerOpen(false);
          setDrawerDraft(null);
          setDrawerOriginal(null);
        }
        window.dispatchEvent(new CustomEvent('tof-products-updated'));
        playDelete();
        // Nettoyage des images orphelines dans Storage (meilleur effort, pas de throw si erreur)
        if (deleted?.imageUrl) {
          try {
            const paths = deleted.imageUrl
              .split('|')
              .map((u) => u.trim())
              .filter(Boolean)
              .filter(isStorageUrl)
              .map(pathFromStorageUrl)
              .filter((p): p is string => Boolean(p));
            if (paths.length > 0) deleteProductImages(paths).catch(() => { /* silent */ });
          } catch { /* ignore */ }
        }
        // Toast avec undo
        showActionToast(
          `"${deleted?.brand ?? ''} ${deleted?.name ?? ''}" supprimé`,
          'Annuler',
          async () => {
            if (!deleted) return;
            try {
              await upsertProduct(productToDb(deleted));
              setProducts(snapshot.includes(deleted) ? snapshot : [deleted, ...snapshot]);
              showToast('Produit restauré ✓');
            } catch {
              showToast('Impossible de restaurer', 'error');
            }
          },
          6500,
        );
      },
    });
  }, [drawerDraft]);

  const duplicateProduct = useCallback((source: Product) => {
    const copy: Product = {
      ...source,
      id: `p${Date.now()}`,
      name: source.name ? `${source.name} (copie)` : 'Copie',
      imageUrl: '', // on repart sans les photos pour éviter les collisions/confusion
    };
    void saveProducts((prev) => [copy, ...prev], copy);
    setSelectedEstimateProduct(copy.id);
    setNewOrder((prev) => ({ ...prev, productId: copy.id }));
    // Ouvre directement le drawer sur la copie
    setDrawerIsNew(false);
    setDrawerOriginal(null);
    setDrawerDraft({ ...copy });
    setDrawerOpen(true);
    showToast('Produit dupliqué ✓');
  }, []);

  // ── Drawer handlers ──
  const openEditDrawer = useCallback((product: Product) => {
    setDrawerIsNew(false);
    setDrawerOriginal({ ...product });
    setDrawerDraft({ ...product });
    setDrawerOpen(true);
    // Ferme les menus filtres/tri si ouverts
    setFilterMenuOpen(false);
    setSortMenuOpen(false);
  }, []);

  const openCreateDrawer = useCallback(() => {
    const preset = categoryPresets.find((p) => p.label === 'T-shirt') || categoryPresets[0];
    const newId = `p${Date.now()}`;
    const blank: Product = {
      id: newId,
      brand: '',
      name: '',
      category: preset.label,
      gender: 'mixte',
      salePrice: 99,
      sourcePriceCny: 100,
      weightGrams: preset.weight,
      packaging: preset.packaging,
      sizes: preset.defaultSizes,
      colors: preset.defaultColors,
      imageUrl: '',
      sourceUrl: '',
      status: 'active',
    };
    setDrawerIsNew(true);
    setDrawerOriginal(null);
    setDrawerDraft(blank);
    setDrawerOpen(true);
    setFilterMenuOpen(false);
    setSortMenuOpen(false);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerDraft(null);
      setDrawerOriginal(null);
    }, 220);
  }, []);

  // Refs pour lire les valeurs à jour dans les callbacks sans casser la stabilité
  const drawerDraftRef = useRef(drawerDraft);
  drawerDraftRef.current = drawerDraft;
  const drawerIsNewRef = useRef(drawerIsNew);
  drawerIsNewRef.current = drawerIsNew;
  const drawerOriginalRef = useRef(drawerOriginal);
  drawerOriginalRef.current = drawerOriginal;
  const productsRef = useRef(products);
  productsRef.current = products;
  const siteSettingsRef = useRef(siteSettings);
  siteSettingsRef.current = siteSettings;

  // Quand on sauvegarde un produit, si imageUrl a changé, on supprime les anciennes
  // images Storage qui ne sont plus référencées (nettoyage orphelins).
  const saveDrawer = useCallback(() => {
    const draft = drawerDraftRef.current;
    const original = drawerOriginalRef.current;
    if (!draft) return;
    // Validation
    if (!draft.brand.trim() || !draft.name.trim() || draft.salePrice <= 0) return;

    // Nettoyage des orphelins Storage si on a remplacé/supprimé des images
    if (original && original.imageUrl !== draft.imageUrl) {
      try {
        const newUrls = new Set(
          draft.imageUrl.split('|').map((u) => u.trim()).filter(Boolean),
        );
        const toDelete = original.imageUrl
          .split('|')
          .map((u) => u.trim())
          .filter(Boolean)
          .filter((u) => isStorageUrl(u) && !newUrls.has(u))
          .map(pathFromStorageUrl)
          .filter((p): p is string => Boolean(p));
        if (toDelete.length > 0) deleteProductImages(toDelete).catch(() => { /* silent */ });
      } catch { /* ignore */ }
    }

    if (drawerIsNewRef.current) {
      setSelectedEstimateProduct(draft.id);
      setNewOrder((prev) => ({ ...prev, productId: draft.id }));
      void saveProducts((prev) => [draft, ...prev], draft);
      showToast('Produit créé ✓');
    } else {
      const next = productsRef.current.map((p) => (p.id === draft.id ? draft : p));
      void saveProducts(next, draft);
    }
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerDraft(null);
      setDrawerOriginal(null);
    }, 220);
  }, []);

  const autoPriceDrawer = useCallback(() => {
    const d = drawerDraftRef.current;
    if (!d) return;
    setDrawerDraft({
      ...d,
      salePrice: suggestedSalePrice(d.sourcePriceCny, d.weightGrams, d.packaging),
    });
  }, []);



  const saveOrderField = useCallback(async (id: string, field: string, value: string) => {
    const dbField: Record<string, string> = {
      status: 'status', paymentStatus: 'payment_status', tracking: 'tracking', qc_photos: 'qc_photos',
    };
    // Clé côté état React (camelCase) ≠ clé côté base (snake_case)
    const stateField: Record<string, string> = { qc_photos: 'qcPhotos' };

    const patch: Record<string, string> = { [dbField[field] || field]: value };
    const statePatch: Record<string, string> = { [stateField[field] || field]: value };

    // Règle métier : on ne commande rien tant que ce n'est pas payé.
    // Dès que tu encaisses, la commande bascule seule en « À commander ».
    if (field === 'paymentStatus' && value === 'paid') {
      const current = orders.find((o) => o.id === id);
      if (current && current.status === 'new') {
        patch.status = 'to_order';
        statePatch.status = 'to_order';
      }
    }

    await updateOrder(id, patch);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, ...statePatch } : o));
  }, [orders]);

  const saveDrop = async () => {
    await dbSaveDrop(dropToDb(dropDraft));
    window.dispatchEvent(new CustomEvent('tof-drop-updated'));
    showToast('Drop de la semaine sauvegardé ✓');
  };

  const addNote = async () => {
    if (!newNote.text.trim()) return;
    const note: DbNote = {
      id: `n${Date.now()}`,
      text: newNote.text.trim(),
      category: newNote.category,
      done: false,
      priority: newNote.category === 'urgent' ? 0 : newNote.category === 'todo' ? 1 : 2,
    };
    await upsertNote(note);
    setNotes((prev) => [note, ...prev]);
    setNewNote({ text: '', category: 'todo' });
    showToast('Note ajoutée ✓');
  };

  const toggleNoteDone = async (note: DbNote) => {
    const updated = { ...note, done: !note.done, category: !note.done ? 'done' : 'todo' };
    await upsertNote(updated);
    setNotes((prev) => prev.map((n) => n.id === note.id ? updated : n));
    showToast(updated.done ? 'Marqué comme fait ✓' : 'Remis en cours');
  };

  const removeNote = async (id: string) => {
    await dbDeleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    showToast('Note supprimée ✓');
    playDelete();
  };

  const updateNoteText = async (note: DbNote, text: string) => {
    const updated = { ...note, text };
    await upsertNote(updated);
    setNotes((prev) => prev.map((n) => n.id === note.id ? updated : n));
    setEditingNoteId(null);
    showToast('Note modifiée ✓');
  };

  const changeNoteCategory = async (note: DbNote, category: string) => {
    const updated = { ...note, category, done: category === 'done', priority: category === 'urgent' ? 0 : category === 'todo' ? 1 : 2 };
    await upsertNote(updated);
    setNotes((prev) => prev.map((n) => n.id === note.id ? updated : n));
    showToast('Catégorie mise à jour ✓');
  };

  const markAllDone = async () => {
    const toUpdate = notes.filter((n) => !n.done);
    for (const n of toUpdate) {
      const updated = { ...n, done: true, category: 'done' };
      await upsertNote(updated);
    }
    setNotes((prev) => prev.map((n) => ({ ...n, done: true, category: 'done' })));
    showToast(`${toUpdate.length} notes marquées comme faites ✓`);
  };

  const clearDone = async () => {
    const toDelete = notes.filter((n) => n.done);
    for (const n of toDelete) await dbDeleteNote(n.id);
    setNotes((prev) => prev.filter((n) => !n.done));
    showToast(`${toDelete.length} notes terminées supprimées ✓`);
  };

  const filteredNotes = notes.filter((n) => {
    if (noteFilter === 'all') return true;
    if (noteFilter === 'done') return n.done;
    if (noteFilter === 'idea') return n.category === 'idea' && !n.done;
    if (noteFilter === 'todo') return n.category === 'todo' && !n.done;
    if (noteFilter === 'urgent') return n.category === 'urgent' && !n.done;
    return true;
  }).sort((a, b) => {
    if (noteSort === 'date') return (b.created_at || '').localeCompare(a.created_at || '');
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.priority - b.priority;
  });

  const noteStats = {
    total: notes.length,
    done: notes.filter((n) => n.done).length,
    urgent: notes.filter((n) => n.category === 'urgent' && !n.done).length,
    todo: notes.filter((n) => n.category === 'todo' && !n.done).length,
    idea: notes.filter((n) => n.category === 'idea' && !n.done).length,
  };

  const progressPercent = noteStats.total > 0 ? Math.round((noteStats.done / noteStats.total) * 100) : 0;

  const saveSettings = async () => {
    await saveSiteSettings(siteSettings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 1600);
    showToast('Réglages sauvegardés ✓');
  };

  const handleDropImageUpload = useCallback(
    (file: File) => uploadDropImage(file, 1200, 0.8).then((r) => ({ url: r.url, hasAlpha: r.hasAlpha })),
    [],
  );

  const addQuickProduct = async () => {
    if (!quickProduct.brand || !quickProduct.name || !quickProduct.sourceUrl) return;
    const product: Product = {
      ...quickProduct,
      id: `p${Date.now()}`,
      status: 'active',
    };
    setProducts((prev) => [product, ...prev]);
    try {
      await upsertProduct(productToDb(product));
    } catch (err) {
      console.error('quick add failed', err);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      showToast("Erreur lors de l'ajout du produit");
      return;
    }

    setSelectedEstimateProduct(product.id);
    setNewOrder((prev) => ({ ...prev, productId: product.id }));
    const resetPreset = categoryPresets.find((p) => p.label === quickProduct.category) || defaultPreset;
    setQuickProduct({
      brand: '',
      name: '',
      category: quickProduct.category,
      salePrice: suggestedSalePrice(150, resetPreset.weight, resetPreset.packaging),
      oldPrice: undefined,
      sourcePriceCny: 150,
      weightGrams: resetPreset.weight,
      packaging: resetPreset.packaging,
      sizes: resetPreset.defaultSizes,
      colors: resetPreset.defaultColors,
      imageUrl: '',
      gender: 'mixte',
      sourceUrl: '',
    });
    showToast('Produit ajouté au catalogue ✓');
  };

  const updateQuickPreset = (category: string) => {
    const preset = categoryPresets.find((item) => item.label === category) || categoryPresets[0];
    const next = {
      ...quickProduct,
      category,
      weightGrams: preset.weight,
      packaging: preset.packaging,
      sizes: preset.defaultSizes ?? quickProduct.sizes,
      colors: preset.defaultColors ?? quickProduct.colors,
    };
    setQuickProduct({
      ...next,
      salePrice: suggestedSalePrice(next.sourcePriceCny, next.weightGrams, next.packaging),
    });
  };

  const autoPriceQuickProduct = () => {
    setQuickProduct({
      ...quickProduct,
      salePrice: suggestedSalePrice(quickProduct.sourcePriceCny, quickProduct.weightGrams, quickProduct.packaging),
    });
  };


  const addOrder = async () => {
    if (!newOrder.customerName || !newOrder.phone || !newOrder.address) return;
    const order: Order = {
      ...newOrder,
      id: `TOF-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'to_order',
      paymentStatus: 'pending',
    };
    setOrders((prev) => [order, ...prev]);
    try {
      await dbInsertOrder(orderToDb(order));
    } catch (err) {
      console.error('add order failed', err);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      showToast('Erreur lors de la création de la commande');
      return;
    }
    setNewOrder((prev) => ({ ...prev, customerName: '', phone: '', address: '', city: '', zip: '', snapOrWhatsapp: '' }));
    showToast('Commande créée ✓');
  };

  const fallbackProduct: Product = { id: '', brand: '-', name: '-', category: 'T-shirt', gender: 'mixte', salePrice: 0, sourcePriceCny: 0, weightGrams: 300, packaging: 'none', sizes: '', colors: '', imageUrl: '', sourceUrl: '', status: 'active' };
  const getProduct = useCallback(
    (id: string) => productsRef.current.find((product) => product.id === id) || productsRef.current[0] || fallbackProduct,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const dashboard = useMemo(() => {
    const statusCounts = orders.reduce<Record<OrderStatus, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, { new: 0, to_order: 0, ordered: 0, qc_received: 0, shipped: 0, done: 0 });
    const paymentCounts = orders.reduce<Record<'pending' | 'paid' | 'cancelled', number>>((acc, order) => {
      const status = order.paymentStatus || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { pending: 0, paid: 0, cancelled: 0 });

    const productStats = new Map<string, { product: Product; orders: number; units: number; revenue: number; margin: number }>();
    let revenue = 0;
    let netMargin = 0;
    let sourceCost = 0;
    let shippingBudget = 0;

    orders.forEach((order) => {
      const product = getProduct(order.productId);
      if (!product) return;
      const margin = estimateNetMargin(product, order.quantity);
      const orderRevenue = product.salePrice * order.quantity;
      revenue += orderRevenue;
      netMargin += margin.net;
      sourceCost += margin.sourceCost;
      shippingBudget += margin.shippingWithSafety;

      const current = productStats.get(product.id) || { product, orders: 0, units: 0, revenue: 0, margin: 0 };
      current.orders += 1;
      current.units += order.quantity;
      current.revenue += orderRevenue;
      current.margin += margin.net;
      productStats.set(product.id, current);
    });

    const topProducts = Array.from(productStats.values()).sort((a, b) => b.units - a.units).slice(0, 5);

    const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
    const paidRevenue = paidOrders.reduce((s, o) => {
      if (o.items && o.items.length > 0) return s + o.items.reduce((si, i) => si + i.price * i.quantity, 0);
      const p = getProduct(o.productId);
      return s + p.salePrice * o.quantity;
    }, 0);

    const pendingAction = orders.some((o) => o.status === 'new' || o.status === 'to_order')
      ? 'en attente'
      : orders.length === 0
        ? 'aucune'
        : 'toutes traitées';

    const riskyProducts = products
      .map((product) => ({ product, margin: estimateNetMargin(product).net }))
      .filter((item) => item.product.status === 'link_dead' || item.margin < 20)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 5);

    return {
      revenue,
      netMargin,
      sourceCost,
      shippingBudget,
      statusCounts,
      paymentCounts,
      topProducts,
      pendingAction,
      riskyProducts,
      activeProducts: products.filter((product) => product.status === 'active').length,
      toProcess: statusCounts.new + statusCounts.to_order,
      inProgress: statusCounts.ordered + statusCounts.qc_received + statusCounts.shipped,
      done: statusCounts.done,
      paidRevenue,
      paidOrders: paidOrders.length,
      totalOrders: orders.length,
      conversionRate: orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0,
    };
  }, [orders, products, getProduct]);

  const orderText = useCallback((order: Order) => {
    let productsBlock = '';

    if (order.items && order.items.length > 0) {
      productsBlock = order.items.map((item, idx) => {
        const p = getProduct(item.productId);
        return `ARTICLE ${idx + 1}\nBrand: ${item.brand}\nName: ${item.name}\nSource link: ${p.sourceUrl}\nSize: ${item.size}\nColor: ${item.color}\nQuantity: ${item.quantity}\nPrice: ${euro(item.price)}`;
      }).join('\n\n');
    } else {
      const product = getProduct(order.productId);
      productsBlock = `ARTICLE 1\nBrand: ${product.brand}\nName: ${product.name}\nSource link: ${product.sourceUrl}\nSource price: ${product.sourcePriceCny} CNY\nSize: ${order.size}\nColor: ${order.color}\nQuantity: ${order.quantity}`;
    }

    const product = getProduct(order.productId);
    const margin = estimateNetMargin(product, order.quantity);

    return `ORDER ${rootOrderId(order.id)}\n\n${productsBlock}\n\nCUSTOMER\nName: ${order.customerName}\nPhone: ${order.phone}\nAddress: ${order.address}\nCity: ${order.city}\nZip: ${order.zip}\nCountry: ${order.country}\nSnap/WhatsApp: ${order.snapOrWhatsapp}\n\nSHIPPING\nEstimated shipping: ${euro(margin.shipping.low)} - ${euro(margin.shipping.high)}\nPackaging: discreet, no invoice\nQC: please send photos before shipping`;
  }, [getProduct]);

  const copyOrder = useCallback(async (order: Order) => {
    await navigator.clipboard.writeText(orderText(order));
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 1800);
    showToast('Bloc Mulebuy copié ✓');
    playCopy();
  }, [orderText]);

  const clientMessage = useCallback((order: Order, type: 'payment' | 'paid' | 'tracking' | 'delay' | 'reminder') => {
    let itemsText = '';
    let totalAmount = '';

    if (order.items && order.items.length > 0) {
      itemsText = order.items.map((i) => `- ${i.brand} ${i.name} (${i.size}/${i.color}) ×${i.quantity} = ${euro(i.price * i.quantity)}`).join('\n');
      totalAmount = euro(order.items.reduce((s, i) => s + i.price * i.quantity, 0));
    } else {
      const product = getProduct(order.productId);
      itemsText = `- ${product.brand} ${product.name} (${order.size}/${order.color}) ×${order.quantity}`;
      totalAmount = euro(product.salePrice * order.quantity);
    }

    if (type === 'payment') {
      return `Salut ${order.customerName}, ta commande ${rootOrderId(order.id)} est bien réservée.\n\n${itemsText}\n\nTotal : ${totalAmount}\n\nPaiement par carte (SumUp) : ${siteSettingsRef.current.sumupUrl}\n\nEnvoie une capture ici quand c'est fait et je lance la commande.`;
    }
    if (type === 'paid') {
      return `Paiement reçu pour ta commande ${rootOrderId(order.id)}, merci.\nJe lance la commande et je te tiens au courant pour le QC / suivi.`;
    }
    if (type === 'reminder') {
      return `Hello ${order.customerName} 👋\n\nPetit rappel pour ta commande ${rootOrderId(order.id)} (${totalAmount}) : je n'ai pas encore reçu le paiement, donc je n'ai pas encore lancé la commande.\n\n${itemsText}\n\n💳 Payer par carte (SumUp, 3D Secure) : ${siteSettingsRef.current.sumupUrl}\n\nDès que c'est réglé, envoie-moi une capture ici et je commande ta pièce dans la foulée. Si tu veux annuler ou changer un article, dis-le moi, aucun souci.`;
    }
    if (type === 'tracking') {
      return `Ta commande ${rootOrderId(order.id)} est expédiée.\nTracking : ${order.tracking || '[COLLE LE TRACKING ICI]'}\n\nDélai estimé : 7-20 jours selon la ligne.`;
    }
    return `Petit update pour ta commande ${rootOrderId(order.id)} : il y a un léger délai côté traitement/livraison. Je suis dessus et je t'envoie les nouvelles infos dès que je les ai.`;
  }, [getProduct]);

  const copyClientMessage = useCallback(async (order: Order, type: 'payment' | 'paid' | 'tracking' | 'delay' | 'reminder') => {
    await navigator.clipboard.writeText(clientMessage(order, type));
    setCopiedId(`${order.id}-${type}`);
    setTimeout(() => setCopiedId(null), 1800);
    showToast('Message copié ✓');
    playCopy();
  }, [clientMessage]);

  const whatsappLink = useCallback((order: Order, type: 'payment' | 'paid' | 'tracking' | 'delay' | 'reminder') => {
    let phone = order.phone.replace(/[^0-9+]/g, '');
    if (phone.startsWith('0') && phone.length === 10) {
      phone = '33' + phone.slice(1);
    }
    phone = phone.replace(/^\+/, '');
    const text = encodeURIComponent(clientMessage(order, type));
    return `https://wa.me/${phone}?text=${text}`;
  }, [clientMessage]);

  // Refs pour les raccourcis clavier
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Raccourcis clavier globaux (hors drawer qui a ses propres handlers)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      if (inField) return;
      // "/" focus la recherche produit si on est sur l'onglet produits
      if (e.key === '/' && activeTab === 'products' && !drawerOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // "n" nouveau produit
      if ((e.key === 'n' || e.key === 'N') && activeTab === 'products' && !drawerOpen) {
        e.preventDefault();
        openCreateDrawer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab, drawerOpen, openCreateDrawer]);

  // Fermeture des menus déroulants filtre/tri au clic extérieur
  useEffect(() => {
    if (!filterMenuOpen && !sortMenuOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-filter-menu]') || t.closest('[data-sort-menu]')) return;
      setFilterMenuOpen(false);
      setSortMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [filterMenuOpen, sortMenuOpen]);

  // Nombre de commandes nécessitant une action (pour le badge sur l'onglet)
  // Commandes créées mais jamais payées (paniers abandonnés)
  const unpaidOrders = useMemo(
    () => orders.filter((o) => (o.paymentStatus || 'pending') === 'pending' && o.status !== 'done'),
    [orders],
  );

  const unpaidTotal = useMemo(
    () =>
      unpaidOrders.reduce((sum, o) => {
        if (o.items && o.items.length > 0) {
          return sum + o.items.reduce((s2, i) => s2 + i.price * i.quantity, 0);
        }
        const p = getProduct(o.productId);
        return sum + p.salePrice * o.quantity;
      }, 0),
    [unpaidOrders, getProduct],
  );

  const ordersNeedingAction = useMemo(
    () => orders.filter((o) => o.status === 'new' || o.status === 'to_order').length,
    [orders],
  );

  if (isAdminAuthed === null) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-white/15 border-t-accent animate-spin" />
      </div>
    );
  }

  if (!isAdminAuthed) {
    return (
      <div className="p-10 text-center bg-dark min-h-screen">
        <h2 className="text-red-500 font-bold">Accès non autorisé</h2>
        <p className="text-white/40 mt-2">Ta session a expiré. Recharge la page pour te reconnecter.</p>
      </div>
    );
  }

  return (
    <section id="admin" className="py-8 sm:py-20 lg:py-28 bg-dark text-white">
      <div className="mx-auto max-w-6xl px-3 sm:px-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <span className="text-accent text-xs font-bold uppercase tracking-widest">Panel privé</span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-800 tracking-tight mt-2">admin tof.</h2>
            <p className="text-white/35 mt-3 max-w-xl">
              {loading ? 'Chargement depuis Supabase...' : 'Données synchronisées avec Supabase.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-800">{products.length}</div>
              <div className="text-[10px] sm:text-[11px] text-white/30">produits</div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
              <div className="text-xl sm:text-2xl font-800">{orders.length}</div>
              <div className="text-[10px] sm:text-[11px] text-white/30">commandes</div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
              <div className="text-lg sm:text-2xl font-800">{euro(totals.avgMargin / Math.max(products.length, 1))}</div>
              <div className="text-[10px] sm:text-[11px] text-white/30">marge moy.</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'orders', label: 'Commandes', badge: ordersNeedingAction },
            { id: 'products', label: 'Produits & liens' },
            { id: 'drop', label: 'Drop semaine' },
            { id: 'promos', label: 'Promos' },
            { id: 'settings', label: 'Réglages' },
            { id: 'chat', label: 'Chat' },
            { id: 'notes', label: 'Notes & idées' },
            { id: 'estimate', label: 'Estimation livraison' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`relative rounded-full px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 inline-flex items-center gap-2 ${
                  isActive ? 'bg-accent text-white' : 'bg-white/5 text-white/45 hover:bg-white/10'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 && (
                  <span className={`h-5 min-w-5 px-1.5 rounded-full text-[10px] font-800 inline-flex items-center justify-center ${
                    isActive ? 'bg-white/20 text-white' : 'bg-accent text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            {notificationsSupported() && currentPermission() === 'default' && (
              <button
                onClick={() => void toggleNotifications()}
                className="w-full flex items-center gap-3 rounded-2xl bg-accent/10 border border-accent/25 px-4 py-3 text-left hover:bg-accent/15 transition-colors"
              >
                <Bell size={18} className="text-accent flex-shrink-0" />
                <span className="text-sm text-white/70">
                  <span className="font-bold text-white">Active les notifications</span> — sois prévenu dès qu'une commande tombe, même onglet fermé.
                </span>
              </button>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 text-white p-5 relative">
                {notificationsSupported() && (
                  <button
                    onClick={() => void toggleNotifications()}
                    title={notifOn ? 'Notifications activées — cliquer pour couper' : 'Être prévenu des nouvelles commandes'}
                    className={`absolute top-4 right-4 h-9 w-9 rounded-full grid place-items-center transition-colors ${
                      notifOn ? 'bg-white/25 text-white' : 'bg-black/15 text-white/60 hover:bg-black/25'
                    }`}
                    aria-label={notifOn ? 'Désactiver les notifications' : 'Activer les notifications'}
                  >
                    {notifOn ? <Bell size={16} /> : <BellOff size={16} />}
                  </button>
                )}
                <div className="text-xs font-bold uppercase tracking-wider text-white/60">En ligne</div>
                <div className="mt-3 text-3xl font-display font-800 tracking-tight flex items-center gap-2">
                  <span className="h-3 w-3 bg-white rounded-full animate-pulse" />
                  {onlineCount}
                </div>
                <div className="mt-1 text-xs text-white/50">visiteurs maintenant</div>
              </div>
              {[
                { label: 'CA potentiel', value: euro(dashboard.revenue), hint: `${orders.length} commandes` },
                { label: 'Marge estimée', value: euro(dashboard.netMargin), hint: 'après livraison + frais' },
                { label: 'Paiements reçus', value: String(dashboard.paymentCounts.paid), hint: `${dashboard.paymentCounts.pending} en attente` },
                { label: 'À traiter', value: String(dashboard.toProcess), hint: 'nouvelles / à commander' },
              ].map((card) => (
                <div key={card.label} className="rounded-3xl bg-white text-dark p-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-dark/25">{card.label}</div>
                  <div className="mt-3 text-3xl font-display font-800 tracking-tight">{card.value}</div>
                  <div className="mt-1 text-xs text-dark/35">{card.hint}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-4 gap-5">
              <div className="rounded-3xl bg-white text-dark p-6">
                <h3 className="font-bold text-xl mb-4">Activité en direct</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-bg p-4">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-semibold">{onlineCount} visiteur{onlineCount > 1 ? 's' : ''} en ligne</span>
                    </div>
                    <span className="text-xs text-dark/30">temps réel</span>
                  </div>
                  {(() => {
                    const state = getPresenceState();
                    const visitors = Object.values(state).flat();
                    const shopCount = visitors.filter((v) => v.page === 'shop').length;
                    const adminCount = visitors.filter((v) => v.page === 'admin').length;
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-bg p-3 text-center">
                          <div className="text-lg font-800">{shopCount}</div>
                          <div className="text-[10px] text-dark/30">sur le shop</div>
                        </div>
                        <div className="rounded-2xl bg-bg p-3 text-center">
                          <div className="text-lg font-800">{adminCount}</div>
                          <div className="text-[10px] text-dark/30">sur l'admin</div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="border-t border-dark/5 pt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-2xl bg-bg p-3">
                      <span className="text-xs font-semibold text-dark/50">Non traitées</span>
                      <span className={`text-sm font-800 ${dashboard.toProcess > 0 ? 'text-accent' : 'text-green-600'}`}>{dashboard.toProcess}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-bg p-3">
                      <span className="text-xs font-semibold text-dark/50">Taux conversion</span>
                      <span className="text-sm font-800">{dashboard.conversionRate}%</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-bg p-3">
                      <span className="text-xs font-semibold text-dark/50">CA confirmé (payé)</span>
                      <span className="text-sm font-800 text-green-600">{euro(dashboard.paidRevenue)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-bg p-3">
                      <span className="text-xs font-semibold text-dark/50">Commandes payées</span>
                      <span className="text-sm font-800">{dashboard.paidOrders}/{dashboard.totalOrders}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 rounded-3xl bg-white text-dark p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="font-bold text-xl">Ce qui marche le mieux</h3>
                    <p className="text-sm text-dark/40 mt-1">Classement selon les commandes créées depuis le shop.</p>
                  </div>
                  <button onClick={() => setActiveTab('orders')} className="rounded-full bg-dark/5 px-4 py-2 text-xs font-bold text-dark/50 hover:text-accent transition-colors">
                    Voir commandes
                  </button>
                </div>

                <div className="space-y-3">
                  {dashboard.topProducts.length > 0 ? dashboard.topProducts.map((item, index) => (
                    <div key={item.product.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl bg-bg p-4">
                      <div className="h-10 w-10 rounded-xl bg-dark text-white flex items-center justify-center text-sm font-800">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{item.product.brand} - {item.product.name}</div>
                        <div className="text-xs text-dark/40 mt-1">{item.orders} commandes · {item.units} pieces</div>
                      </div>
                      <div className="text-right">
                        <div className="font-800 text-sm">{euro(item.revenue)}</div>
                        <div className={`mt-1 text-xs font-bold ${item.margin >= 20 ? 'text-green-600' : 'text-red-500'}`}>{euro(item.margin)} marge</div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl bg-bg p-6 text-center text-sm text-dark/40">
                      Pas encore assez de commandes pour savoir ce qui marche.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl bg-white text-dark p-6">
                <h3 className="font-bold text-xl mb-5">Pipeline commandes</h3>
                <div className="space-y-3">
                  {Object.entries(statusLabels).map(([status, label]) => {
                    const count = dashboard.statusCounts[status as OrderStatus] || 0;
                    const percent = orders.length ? Math.round((count / orders.length) * 100) : 0;
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-dark/55">{label}</span>
                          <span className="text-dark/35">{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-dark/5 overflow-hidden">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <div className="rounded-3xl bg-white text-dark p-6">
                <h3 className="font-bold text-xl mb-4">Répartition argent</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-dark/45">Prix source</span><span className="font-bold">{euro(dashboard.sourceCost)}</span></div>
                  <div className="flex justify-between"><span className="text-dark/45">Budget livraison</span><span className="font-bold">{euro(dashboard.shippingBudget)}</span></div>
                  <div className="flex justify-between"><span className="text-dark/45">Marge estimée</span><span className="font-bold text-green-600">{euro(dashboard.netMargin)}</span></div>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-3xl bg-white/5 border border-white/10 p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-bold text-xl text-white">A surveiller</h3>
                    <p className="text-sm text-white/35 mt-1">Liens sautes ou marges trop basses.</p>
                  </div>
                  <button onClick={() => setActiveTab('products')} className="rounded-full bg-white/5 px-4 py-2 text-xs font-bold text-white/45 hover:text-white transition-colors">
                    Corriger
                  </button>
                </div>
                <div className="space-y-3">
                  {dashboard.riskyProducts.length > 0 ? dashboard.riskyProducts.map(({ product, margin }) => (
                    <div key={product.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                      <div>
                        <div className="font-bold text-sm text-white">{product.brand} - {product.name}</div>
                        <div className="text-xs text-white/30 mt-1">{product.status === 'link_dead' ? 'Lien saute' : 'Marge faible'}</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${margin >= 20 ? 'bg-orange-500/10 text-orange-300' : 'bg-red-500/10 text-red-300'}`}>
                        {euro(margin)}
                      </span>
                    </div>
                  )) : (
                    <div className="rounded-2xl bg-white/5 p-5 text-center text-sm text-white/35">
                      Rien d'inquietant pour le moment.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              {/* 💸 Paniers abandonnés : commandes créées mais jamais payées */}
              {unpaidOrders.length > 0 && (
                <div className="rounded-3xl bg-accent/10 border border-accent/25 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        💸 {unpaidOrders.length} paiement{unpaidOrders.length > 1 ? 's' : ''} en attente
                      </h3>
                      <p className="text-xs text-white/45 mt-1">
                        Commandes enregistrées mais non réglées — {euro(unpaidTotal)} à récupérer.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {unpaidOrders.map((order) => {
                      const hours = order.createdAt
                        ? Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 3600000)
                        : null;
                      return (
                        <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl bg-dark/30 px-4 py-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">
                              {rootOrderId(order.id)} · {order.customerName}
                            </div>
                            <div className="text-[11px] text-white/40">
                              {hours !== null && (hours < 24 ? `il y a ${hours}h` : `il y a ${Math.floor(hours / 24)}j`)}
                              {hours !== null && hours >= 24 && ' · à relancer'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={whatsappLink(order, 'reminder')}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-white hover:brightness-110 transition-all"
                            >
                              Relancer
                            </a>
                            <button
                              onClick={() => saveOrderField(order.id, 'paymentStatus', 'paid')}
                              className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/20 transition-colors"
                            >
                              Payée ✓
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {orders.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] p-10 text-center">
                  <div className="mx-auto h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl mb-4">
                    📦
                  </div>
                  <p className="font-bold text-white/80">Aucune commande pour l'instant</p>
                  <p className="text-sm text-white/35 mt-2 max-w-sm mx-auto leading-relaxed">
                    Les commandes passées depuis le site arriveront ici automatiquement.
                    Tu peux aussi en saisir une à la main avec le formulaire ci-contre
                    (commande reçue sur Snap ou WhatsApp).
                  </p>
                </div>
              )}

              {orders.map((order) => {
                const product = getProduct(order.productId);
                const margin = estimateNetMargin(product, order.quantity);
                return (
                  <OrderCard
                    key={order.id}
                    order={order}
                    product={product}
                    margin={margin}
                    copied={copiedId === order.id}
                    copiedPayment={copiedId === `${order.id}-payment`}
                    onFieldChange={saveOrderField}
                    onCopyOrder={copyOrder}
                    onCopyClientMessage={copyClientMessage}
                    whatsappLink={whatsappLink}
                  />
                );
              })}
            </div>

            <div className="rounded-3xl bg-white/5 border border-white/10 p-5 h-fit">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Plus size={18} /> Ajouter une commande</h3>
              <div className="space-y-3">
                <select
                  value={newOrder.productId}
                  onChange={(event) => setNewOrder({ ...newOrder, productId: event.target.value })}
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none"
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.brand} - {product.name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input className="rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none" placeholder="Taille" value={newOrder.size} onChange={(e) => setNewOrder({ ...newOrder, size: e.target.value })} />
                  <input className="rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none" placeholder="Couleur" value={newOrder.color} onChange={(e) => setNewOrder({ ...newOrder, color: e.target.value })} />
                </div>
                <input className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none" placeholder="Nom client" value={newOrder.customerName} onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })} />
                <input className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none" placeholder="Telephone" value={newOrder.phone} onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })} />
                <input className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none" placeholder="Adresse" value={newOrder.address} onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none" placeholder="Ville" value={newOrder.city} onChange={(e) => setNewOrder({ ...newOrder, city: e.target.value })} />
                  <input className="rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none" placeholder="Code postal" value={newOrder.zip} onChange={(e) => setNewOrder({ ...newOrder, zip: e.target.value })} />
                </div>
                <input className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm outline-none" placeholder="Snap ou WhatsApp" value={newOrder.snapOrWhatsapp} onChange={(e) => setNewOrder({ ...newOrder, snapOrWhatsapp: e.target.value })} />
                <button onClick={addOrder} className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hue-rotate-0 hover:brightness-110 transition-colors">
                    Créer la commande
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="rounded-3xl bg-white text-dark overflow-hidden flex flex-col">
            {/* Sticky header : titre + bouton nouveau */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 border-b border-dark/5">
              <div>
                <h3 className="font-bold">Catalogue produits</h3>
                <p className="text-xs sm:text-sm text-dark/40">
                  {productCounts.active} actifs · {productCounts.low_margin} marges faibles · {productCounts.link_dead} liens sautés
                  <span className="hidden sm:inline"> ·</span>
                  <kbd className="ml-0.5 sm:ml-1.5 hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-dark/5 text-dark/50 font-mono">/</kbd>
                  <span className="hidden sm:inline text-dark/35 text-xs"> rechercher ·</span>
                  <kbd className="ml-0.5 sm:ml-1.5 hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-dark/5 text-dark/50 font-mono">N</kbd>
                  <span className="hidden sm:inline text-dark/35 text-xs"> nouveau</span>
                </p>
              </div>
              <button onClick={openCreateDrawer} className="inline-flex items-center gap-2 rounded-full bg-dark px-5 py-2.5 sm:py-3 text-sm font-semibold text-white hover:bg-accent hover:brightness-110 transition-colors self-start sm:self-auto flex-shrink-0">
                <Plus size={15} /> Nouveau produit
              </button>
            </div>

            {/* Barre recherche + filtres + tri */}
            <div className="sticky top-[72px] sm:top-[76px] z-10 bg-white/95 backdrop-blur border-b border-dark/5 p-3 sm:p-4 flex flex-col gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/25" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={`Rechercher parmi ${products.length} produits (marque, nom, catégorie, lien)…`}
                  className="w-full rounded-xl bg-bg pl-11 pr-20 py-2.5 text-sm outline-none border border-dark/5 focus:border-accent/40 transition-colors"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-dark/30 hover:text-dark/60 hover:bg-dark/5 text-xs font-bold flex items-center justify-center"
                    aria-label="Effacer"
                  >✕</button>
                )}
                {!productSearch && (
                  <span className="hidden sm:inline absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-dark/25 border border-dark/10 rounded px-1.5 py-0.5">/</span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                {/* Chips filtres (scrollable horizontalement sur mobile) */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 flex-1 min-w-0">
                  {([
                    { id: 'all',        label: 'Tous',       count: productCounts.all },
                    { id: 'active',     label: 'Actifs',     count: productCounts.active },
                    { id: 'low_margin', label: 'À surveiller', count: productCounts.low_margin },
                    { id: 'link_dead',  label: 'Lien sauté', count: productCounts.link_dead },
                    { id: 'no_photo',   label: 'Sans photo', count: productCounts.no_photo },
                    { id: 'paused',     label: 'Pause',      count: productCounts.paused },
                  ] as { id: ProductFilter; label: string; count: number }[]).map((f) => {
                    const active = productFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setProductFilter(f.id)}
                        className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                          active ? 'bg-dark text-white' : 'bg-dark/5 text-dark/55 hover:bg-dark/10'
                        }`}
                      >
                        {f.label}
                        <span className={`text-[10px] font-800 rounded-full px-1.5 py-0.5 ${active ? 'bg-white/20' : 'bg-dark/10 text-dark/40'}`}>
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Menu tri */}
                <div className="relative flex-shrink-0" data-sort-menu>
                  <button
                    onClick={() => { setSortMenuOpen((v) => !v); setFilterMenuOpen(false); }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-dark/5 hover:bg-dark/10 px-3 py-1.5 text-xs font-semibold text-dark/60 transition-colors"
                  >
                    <ArrowUpDown size={13} />
                    <span className="hidden sm:inline">
                      {({
                        name: 'Nom',
                        price_desc: 'Prix ↓',
                        margin_desc: 'Marge ↓',
                        margin_asc: 'Marge ↑',
                        orders_desc: 'Populaires',
                        recent: 'Récents',
                      } as Record<ProductSort, string>)[productSort]}
                    </span>
                  </button>
                  {sortMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-neutral-800 border border-white/10 shadow-2xl shadow-black/40 py-1 z-30">
                      {([
                        { id: 'name',        label: 'Nom (A→Z)' },
                        { id: 'orders_desc', label: 'Les plus vendus' },
                        { id: 'margin_desc', label: 'Meilleure marge' },
                        { id: 'margin_asc',  label: 'Marge faible' },
                        { id: 'price_desc',  label: 'Prix élevé' },
                        { id: 'recent',      label: 'Plus récents' },
                      ] as { id: ProductSort; label: string }[]).map((o) => (
                        <button
                          key={o.id}
                          onClick={() => { setProductSort(o.id); setSortMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${
                            productSort === o.id ? 'bg-accent text-white' : 'text-white/80 hover:bg-white/10'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(productSearch || productFilter !== 'all') && (
                <p className="text-[11px] text-dark/40">
                  {filteredProducts.length} résultat{filteredProducts.length > 1 ? 's' : ''} sur {products.length}
                  {productSearch && <> · recherche "<span className="font-semibold text-dark/60">{productSearch}</span>"</>}
                  {productFilter !== 'all' && <> · filtre <span className="font-semibold text-dark/60">
                    {({ all: 'tous', active: 'actifs', low_margin: 'à surveiller', link_dead: 'lien sauté', paused: 'pause', no_photo: 'sans photo' } as Record<ProductFilter, string>)[productFilter]}
                  </span></>}
                  <button
                    onClick={() => { setProductSearch(''); setProductFilter('all'); }}
                    className="ml-2 text-accent font-bold underline-offset-2 hover:underline"
                  >
                    Réinitialiser
                  </button>
                </p>
              )}
            </div>

            {/* Bloc ajout rapide */}
            <details className="group border-b border-dark/5 bg-bg/30 open:bg-bg/60">
              <summary className="cursor-pointer list-none p-4 sm:p-5 flex items-center justify-between gap-3 select-none">
                <div>
                  <h4 className="font-bold text-sm">Ajout rapide</h4>
                  <p className="text-xs text-dark/40 mt-0.5">Remplis le minimum. Pour plus de détails, ouvre la fiche via Modifier.</p>
                </div>
                <span className="text-xs font-bold text-dark/40 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="p-4 sm:p-5 pt-0 space-y-2 sm:space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <input value={quickProduct.brand} onChange={(e) => setQuickProduct({ ...quickProduct, brand: e.target.value })} placeholder="Marque *" className="rounded-xl bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none border border-dark/5" />
                  <input value={quickProduct.name} onChange={(e) => setQuickProduct({ ...quickProduct, name: e.target.value })} placeholder="Nom produit *" className="rounded-xl bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none border border-dark/5 sm:col-span-2" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <select value={quickProduct.gender} onChange={(e) => setQuickProduct({ ...quickProduct, gender: e.target.value as Product['gender'] })} className="rounded-xl bg-white px-3 py-2.5 sm:py-3 text-sm outline-none border border-dark/5">
                    <option value="homme">Homme</option>
                    <option value="femme">Femme</option>
                    <option value="mixte">Mixte</option>
                  </select>
                  <select value={quickProduct.category} onChange={(e) => updateQuickPreset(e.target.value)} className="rounded-xl bg-white px-3 py-2.5 sm:py-3 text-sm outline-none border border-dark/5">
                    {categoryPresets.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                  </select>
                  <input type="number" value={quickProduct.sourcePriceCny} onChange={(e) => {
                    const v = Number(e.target.value);
                    setQuickProduct({ ...quickProduct, sourcePriceCny: v, salePrice: suggestedSalePrice(v, quickProduct.weightGrams, quickProduct.packaging) });
                  }} placeholder="Prix ¥ *" className="rounded-xl bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none border border-dark/5" />
                  <div className="flex gap-1.5">
                    <input type="number" value={quickProduct.salePrice} onChange={(e) => setQuickProduct({ ...quickProduct, salePrice: Number(e.target.value) })} placeholder="Prix €" className="rounded-xl bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none border border-dark/5 flex-1 min-w-0" />
                    <button onClick={autoPriceQuickProduct} className="rounded-xl bg-accent text-white px-3 py-2.5 sm:py-3 text-xs font-bold hue-rotate-0 hover:brightness-110 transition-colors flex-shrink-0">Auto</button>
                  </div>
                </div>
                <div className="rounded-xl bg-white/80 border border-dark/5 p-3 space-y-2">
                  <div className="text-[11px] font-bold text-dark/40 uppercase tracking-wider">Tailles</div>
                  <SizePicker
                    value={quickProduct.sizes}
                    onChange={(v) => setQuickProduct({ ...quickProduct, sizes: v })}
                    category={quickProduct.category}
                    theme="light"
                  />
                </div>
                <div className="rounded-xl bg-white/80 border border-dark/5 p-3 space-y-2">
                  <div className="text-[11px] font-bold text-dark/40 uppercase tracking-wider">Variantes (1, 2, 3…)</div>
                  <ColorPicker
                    value={quickProduct.colors}
                    onChange={(v) => setQuickProduct({ ...quickProduct, colors: v })}
                    theme="light"
                  />
                </div>
                <SourceUrlInput
                  value={quickProduct.sourceUrl}
                  onChange={(v) => setQuickProduct({ ...quickProduct, sourceUrl: v })}
                  compact
                />
                <div>
                  <ImageUploader
                    value={quickProduct.imageUrl}
                    onChange={(next) => setQuickProduct((prev) => ({ ...prev, imageUrl: next }))}
                    uploadHandler={productImageUploadHandler}
                    multiple={false}
                    maxSize={800}
                    quality={0.75}
                    label="Photo"
                    hint="Glisse, colle ou clique. Stockée sur Supabase Storage."
                    dropHeightClass="min-h-[80px]"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                  {(() => {
                    const preview: Product = { ...quickProduct, id: 'preview', status: 'active' };
                    const margin = estimateNetMargin(preview);
                    return (
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full bg-white px-2.5 py-1 text-dark/40">{margin.effectiveWeight}g</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-dark/40">Livr. {euro(margin.shippingWithSafety)}</span>
                        <span className={`rounded-full px-2.5 py-1 font-bold ${marginTone(margin.netPct)}`}>Marge {euro(margin.net)} · {margin.netPct.toFixed(0)}%</span>
                      </div>
                    );
                  })()}
                  <button onClick={addQuickProduct} className="rounded-xl bg-accent px-6 py-2.5 sm:py-3 text-sm font-bold text-white hue-rotate-0 hover:brightness-110 transition-colors w-full sm:w-auto">
                    Ajouter au shop
                  </button>
                </div>
              </div>
            </details>

            {/* Liste */}
            {filteredProducts.length === 0 ? (
              <div className="p-10 sm:p-14 text-center">
                <div className="h-16 w-16 mx-auto rounded-3xl bg-bg flex items-center justify-center mb-4">
                  <Package size={24} className="text-dark/20" />
                </div>
                <p className="text-sm text-dark/50 font-semibold">
                  {productSearch || productFilter !== 'all' ? 'Aucun produit ne correspond.' : 'Aucun produit pour le moment.'}
                </p>
                <p className="text-xs text-dark/35 mt-1 mb-4">
                  {productSearch || productFilter !== 'all' ? "Essayez un autre terme ou réinitialisez les filtres." : "Ajoute ton premier produit via le bouton ci-dessus ou l'ajout rapide."}
                </p>
                <button onClick={openCreateDrawer} className="inline-flex items-center gap-2 rounded-full bg-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent hover:brightness-110 transition-colors">
                  <Plus size={14} /> Créer un produit
                </button>
              </div>
            ) : (
              <div className="divide-y divide-dark/5">
                {filteredProducts.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    ordersCount={ordersCountByProduct.get(product.id) || 0}
                    onEdit={openEditDrawer}
                    onDuplicate={duplicateProduct}
                    onRemove={removeProduct}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'drop' && (
          <div className="grid lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 rounded-3xl bg-white text-dark p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-xl">Configurer le drop de la semaine</h3>
                  <p className="text-sm text-dark/40 mt-1">
                    Modifie la photo, le prix, les tailles et le texte. Le bloc public se met a jour tout seul.
                  </p>
                </div>
                <button
                  onClick={saveDrop}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hue-rotate-0 hover:brightness-110 transition-colors"
                >
                  <Save size={15} /> Sauvegarder
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs text-dark/35">Badge
                  <input value={dropDraft.badge} onChange={(e) => setDropDraft({ ...dropDraft, badge: e.target.value })} className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none" />
                </label>
                <label className="text-xs text-dark/35">Eyebrow
                  <input value={dropDraft.eyebrow} onChange={(e) => setDropDraft({ ...dropDraft, eyebrow: e.target.value })} className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none" />
                </label>
                <label className="text-xs text-dark/35">Marque
                  <input value={dropDraft.brand} onChange={(e) => setDropDraft({ ...dropDraft, brand: e.target.value })} className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none" />
                </label>
                <label className="text-xs text-dark/35">Nom produit
                  <input value={dropDraft.name} onChange={(e) => setDropDraft({ ...dropDraft, name: e.target.value })} className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none" />
                </label>
                <div className="sm:col-span-2 rounded-2xl bg-bg p-4">
                  <ImageUploader
                    value={dropDraft.imageUrl}
                    onChange={(next) => setDropDraft((prev) => ({ ...prev, imageUrl: next }))}
                    uploadHandler={handleDropImageUpload}
                    multiple={false}
                    maxSize={1200}
                    quality={0.8}
                    label="Photo du drop"
                    hint="Glisse-dépose, colle (Ctrl+V) ou clique pour uploader. Ratio carré recommandé. Stockée sur Supabase Storage."
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-xs text-dark/35 flex-1">
                      Ou URL directe
                      <input
                        value={dropDraft.imageUrl.startsWith('data:') ? '' : dropDraft.imageUrl}
                        onChange={(e) => setDropDraft({ ...dropDraft, imageUrl: e.target.value })}
                        placeholder="https://… ou /images/drop.jpg"
                        className="mt-1 w-full rounded-xl bg-white px-4 py-2.5 text-xs text-dark outline-none border border-dark/5"
                      />
                    </label>
                  </div>
                </div>
                <label className="text-xs text-dark/35 sm:col-span-2">Description
                  <textarea value={dropDraft.description} onChange={(e) => setDropDraft({ ...dropDraft, description: e.target.value })} rows={3} className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none resize-none" />
                </label>
                <label className="text-xs text-dark/35">Prix vente €
                  <input type="number" value={dropDraft.price} onChange={(e) => setDropDraft({ ...dropDraft, price: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none" />
                </label>
                <label className="text-xs text-dark/35">Ancien prix €
                  <input type="number" value={dropDraft.oldPrice} onChange={(e) => setDropDraft({ ...dropDraft, oldPrice: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none" />
                </label>
                <label className="text-xs text-dark/35">Promo
                  <input value={dropDraft.discount} onChange={(e) => setDropDraft({ ...dropDraft, discount: e.target.value })} className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none" />
                </label>
                <label className="text-xs text-dark/35">Tailles
                  <input value={dropDraft.sizes} onChange={(e) => setDropDraft({ ...dropDraft, sizes: e.target.value })} placeholder="39, 40, 41, 42" className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none" />
                </label>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-3xl bg-white/5 border border-white/10 p-6 text-white">
              <h3 className="font-bold text-xl mb-4">Preview rapide</h3>
              <div className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="aspect-square bg-white/5 flex items-center justify-center">
                  {dropDraft.imageUrl ? (
                    <img src={dropDraft.imageUrl} alt="Preview drop" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-white/20 text-sm">ta photo ici</span>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-accent text-xs font-bold uppercase tracking-widest">{dropDraft.eyebrow}</span>
                  <h4 className="font-display text-2xl font-800 mt-2">{dropDraft.brand}</h4>
                  <p className="text-white/40 text-sm mt-1">{dropDraft.name}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="text-2xl font-800">{euro(dropDraft.price)}</span>
                    {dropDraft.oldPrice > 0 && <span className="text-white/25 line-through">{euro(dropDraft.oldPrice)}</span>}
                    {dropDraft.discount && <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-bold text-green-400">{dropDraft.discount}</span>}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-white/35">
                Pour une photo locale, place-la dans <span className="font-semibold">public/images/</span> et mets par exemple <span className="font-semibold">/images/drop.jpg</span>.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'promos' && (
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-3">
              {promoCodes.length === 0 && (
                <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center text-white/30">Aucun code promo. Crée ton premier code !</div>
              )}
              {promoCodes.map((promo) => {
                const expired = promo.expires_at && new Date(promo.expires_at) < new Date();
                const maxed = promo.max_uses > 0 && promo.uses >= promo.max_uses;
                return (
                  <div key={promo.id} className={`rounded-2xl p-4 flex items-center justify-between gap-4 ${promo.active && !expired && !maxed ? 'bg-white text-dark' : 'bg-white/5 text-white/40 border border-white/10'}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-800 text-lg tracking-wider">{promo.code}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${promo.active && !expired && !maxed ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-400'}`}>
                          {expired ? 'Expiré' : maxed ? 'Épuisé' : promo.active ? 'Actif' : 'Désactivé'}
                        </span>
                      </div>
                      <div className={`text-xs ${promo.active && !expired && !maxed ? 'text-dark/40' : 'text-white/25'}`}>
                        -{promo.discount_percent}% · {promo.uses} utilisations{promo.max_uses > 0 ? ` / ${promo.max_uses} max` : ''}
                        {promo.expires_at ? ` · Expire le ${new Date(promo.expires_at).toLocaleDateString('fr-FR')}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={async () => {
                        await upsertPromoCode({ ...promo, active: !promo.active });
                        setPromoCodes((prev) => prev.map((p) => p.id === promo.id ? { ...p, active: !p.active } : p));
                        showToast(promo.active ? 'Code désactivé' : 'Code activé ✓');
                      }} className={`rounded-xl px-3 py-2 text-xs font-bold ${promo.active ? 'bg-dark/5 text-dark/50' : 'bg-green-500/10 text-green-600'}`}>
                        {promo.active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button onClick={async () => {
                        await deletePromoCode(promo.id);
                        setPromoCodes((prev) => prev.filter((p) => p.id !== promo.id));
                        showToast('Code supprimé ✓');
                        playDelete();
                      }} className="rounded-xl px-3 py-2 text-xs font-bold bg-red-500/10 text-red-400">
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-3xl bg-white/5 border border-white/10 p-5 h-fit space-y-4">
              <h3 className="font-bold text-white text-lg">Créer un code promo</h3>
              <input
                value={newPromo.code}
                onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                placeholder="Code (ex: TOFLAUNCH)"
                className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/25 outline-none uppercase tracking-wider"
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-white/35">Réduction %
                  <input type="number" value={newPromo.discount} onChange={(e) => setNewPromo({ ...newPromo, discount: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white outline-none" />
                </label>
                <label className="text-xs text-white/35">Max utilisations (0 = illimité)
                  <input type="number" value={newPromo.maxUses} onChange={(e) => setNewPromo({ ...newPromo, maxUses: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white outline-none" />
                </label>
              </div>
              <label className="text-xs text-white/35 block">Expire dans (heures, 0 = jamais)
                <input type="number" value={newPromo.expiresIn} onChange={(e) => setNewPromo({ ...newPromo, expiresIn: e.target.value })} placeholder="48" className="mt-1 w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/15 outline-none" />
              </label>
              <button onClick={async () => {
                if (!newPromo.code.trim()) return;
                const hours = Number(newPromo.expiresIn);
                const promo: DbPromoCode = {
                  id: `promo-${Date.now()}`,
                  code: newPromo.code.trim().toUpperCase(),
                  discount_percent: newPromo.discount,
                  active: true,
                  uses: 0,
                  max_uses: newPromo.maxUses,
                  expires_at: hours > 0 ? new Date(Date.now() + hours * 3600000).toISOString() : null,
                };
                await upsertPromoCode(promo);
                setPromoCodes((prev) => [promo, ...prev]);
                setNewPromo({ code: '', discount: 15, maxUses: 0, expiresIn: '' });
                showToast('Code promo créé ✓');
              }} className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hue-rotate-0 hover:brightness-110 transition-colors">
                Créer le code
              </button>

              <div className="border-t border-white/5 pt-4">
                <h4 className="font-bold text-white/60 text-sm mb-3">Suggestions lancement</h4>
                <div className="space-y-2">
                  {[
                    { code: 'TOFLAUNCH', discount: 15, label: '-15% lancement' },
                    { code: 'FIRST10', discount: 10, label: '-10% premier achat' },
                    { code: 'FLASH20', discount: 20, label: '-20% vente flash' },
                    { code: 'VIP25', discount: 25, label: '-25% VIP' },
                  ].map((s) => (
                    <button
                      key={s.code}
                      onClick={() => setNewPromo({ ...newPromo, code: s.code, discount: s.discount })}
                      className="block w-full text-left rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-white/35 hover:text-white/55 transition-colors"
                    >
                      <span className="font-bold">{s.code}</span> — {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="font-bold text-2xl text-white">Réglages du site</h2>
                <p className="text-sm text-white/40 mt-1">
                  Tout le contenu de la vitrine est modifiable ici. Pense à sauvegarder en bas ou en haut.
                </p>
              </div>
              <button
                onClick={saveSettings}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hover:brightness-110 transition-colors"
              >
                <Save size={15} /> {settingsSaved ? 'Sauvegardé ✓' : 'Sauvegarder'}
              </button>
            </div>

            <div className="grid lg:grid-cols-4 gap-5 items-start">
              {/* ── Navigation latérale ── */}
              <div className="lg:col-span-1">
                <nav className="rounded-3xl bg-white/5 border border-white/10 p-2 flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide">
                  {([
                    { id: 'vitrine', label: 'Vitrine & liens' },
                    { id: 'avis', label: 'Avis clients' },
                    { id: 'faq', label: 'FAQ' },
                    { id: 'comment', label: 'Comment ça marche' },
                    { id: 'pourquoi', label: 'Pourquoi tof' },
                    { id: 'footer', label: 'Footer' },
                    { id: 'marques', label: 'Marques' },
                    { id: 'nouveautes', label: 'Nouveautés' },
                    { id: 'lancement', label: 'Lancement (drop)' },
                    { id: 'apparence', label: 'Apparence' },
                  ] as { id: typeof settingsSection; label: string }[]).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSettingsSection(s.id)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-left whitespace-nowrap transition-colors ${
                        settingsSection === s.id
                          ? 'bg-accent text-white'
                          : 'text-white/55 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* ── Contenu ── */}
              <div className="lg:col-span-3 rounded-3xl bg-white text-dark p-5 sm:p-6 space-y-4">
                {/* ============ VITRINE ============ */}
                {settingsSection === 'vitrine' && (
                  <>
                    <SCard title="Barre d'annonce rotative" subtitle="Sépare plusieurs messages par « | » : ils défilent automatiquement.">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-dark/50">
                          <input
                            type="checkbox"
                            checked={siteSettings.announcementEnabled}
                            onChange={(e) => setSiteSettings({ ...siteSettings, announcementEnabled: e.target.checked })}
                            className="h-4 w-4"
                          />
                          Activée
                        </label>
                      </div>
                      <input
                        value={siteSettings.announcementText}
                        onChange={(e) => setSiteSettings({ ...siteSettings, announcementText: e.target.value })}
                        placeholder="Livraison offerte dès 140€ | Paiement CB sécurisé SumUp | Réponse en 5 min"
                        className="w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/10"
                      />
                    </SCard>

                    <SCard title="Hero principal">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <SInput label="Badge" value={siteSettings.heroBadge} onChange={(v) => setSiteSettings({ ...siteSettings, heroBadge: v })} />
                        <SInput label="Badge flottant" value={siteSettings.heroTopBadge} onChange={(v) => setSiteSettings({ ...siteSettings, heroTopBadge: v })} />
                        <SInput label="Titre début" value={siteSettings.heroTitleStart} onChange={(v) => setSiteSettings({ ...siteSettings, heroTitleStart: v })} />
                        <SInput label="Titre souligné" value={siteSettings.heroTitleHighlight} onChange={(v) => setSiteSettings({ ...siteSettings, heroTitleHighlight: v })} />
                        <div className="sm:col-span-2">
                          <STextarea label="Description" value={siteSettings.heroDescription} onChange={(v) => setSiteSettings({ ...siteSettings, heroDescription: v })} rows={2} />
                        </div>
                        <div className="sm:col-span-2">
                          <SInput label="Note sous description" value={siteSettings.heroSubnote} onChange={(v) => setSiteSettings({ ...siteSettings, heroSubnote: v })} />
                        </div>
                        <SInput label="Stat flottante" value={siteSettings.heroStatValue} onChange={(v) => setSiteSettings({ ...siteSettings, heroStatValue: v })} />
                        <SInput label="Label stat" value={siteSettings.heroStatLabel} onChange={(v) => setSiteSettings({ ...siteSettings, heroStatLabel: v })} />
                      </div>
                      {/* Aperçu en direct */}
                      <div className="mt-4 rounded-2xl bg-bg p-4">
                        <p className="text-[10px] uppercase tracking-widest text-dark/30 font-bold mb-2">Aperçu</p>
                        <h3 className="font-display text-2xl font-800 tracking-tight">
                          {siteSettings.heroTitleStart || 'Titre'}{' '}
                          <span className="text-accent underline decoration-accent/40">{siteSettings.heroTitleHighlight || 'souligné'}</span>.
                        </h3>
                      </div>
                    </SCard>

                    <SCard title="Badges de confiance" subtitle="Affichés dans le hero et sous « Comment ça marche ».">
                      {siteSettings.trustBadges.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                          <input
                            value={b}
                            onChange={(e) =>
                              setSiteSettings((s) => ({
                                ...s,
                                trustBadges: s.trustBadges.map((x, j) => (j === i ? e.target.value : x)),
                              }))
                            }
                            className="flex-1 rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/10"
                          />
                          <DeleteBtn onClick={() => setSiteSettings((s) => ({ ...s, trustBadges: s.trustBadges.filter((_, j) => j !== i) }))} />
                        </div>
                      ))}
                      <AddBtn label="Ajouter un badge" onClick={() => setSiteSettings((s) => ({ ...s, trustBadges: [...s.trustBadges, 'Nouveau badge'] }))} />
                    </SCard>

                    <SCard title="Bloc Snap / WhatsApp">
                      <div className="space-y-3">
                        <SInput label="Titre CTA" value={siteSettings.ctaTitle} onChange={(v) => setSiteSettings({ ...siteSettings, ctaTitle: v })} />
                        <STextarea label="Description CTA" value={siteSettings.ctaDescription} onChange={(v) => setSiteSettings({ ...siteSettings, ctaDescription: v })} rows={2} />
                      </div>
                    </SCard>

                    <SCard title="Livraison">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-dark/70">Livraison offerte sur tout</div>
                          <div className="text-xs text-dark/40">Active pour l'offre d'ouverture.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={siteSettings.freeShipping}
                          onChange={(e) => setSiteSettings({ ...siteSettings, freeShipping: e.target.checked })}
                          className="h-5 w-5"
                        />
                      </div>
                      {!siteSettings.freeShipping && (
                        <div className="grid grid-cols-3 gap-3 mt-3">
                          <SInput label="Gratuit dès €" type="number" value={siteSettings.freeShippingThreshold} onChange={(v) => setSiteSettings({ ...siteSettings, freeShippingThreshold: Number(v) })} />
                          <SInput label="Standard €" type="number" value={siteSettings.standardShippingFee} onChange={(v) => setSiteSettings({ ...siteSettings, standardShippingFee: Number(v) })} />
                          <SInput label="Express €" type="number" value={siteSettings.expressShippingFee} onChange={(v) => setSiteSettings({ ...siteSettings, expressShippingFee: Number(v) })} />
                        </div>
                      )}
                    </SCard>

                    <SCard title="Liens & paiement">
                      <div className="space-y-3">
                        <SInput label="Lien WhatsApp" value={siteSettings.whatsappUrl} onChange={(v) => setSiteSettings({ ...siteSettings, whatsappUrl: v })} placeholder="https://wa.me/33..." />
                        <SInput label="Lien Snapchat" value={siteSettings.snapchatUrl} onChange={(v) => setSiteSettings({ ...siteSettings, snapchatUrl: v })} placeholder="https://www.snapchat.com/add/tonpseudo" />
                        <SInput label="Lien de paiement SumUp" value={siteSettings.sumupUrl} onChange={(v) => setSiteSettings({ ...siteSettings, sumupUrl: v })} placeholder="https://pay.sumup.com/b2c/..." />
                        <STextarea label="Texte paiement" value={siteSettings.paymentText} onChange={(v) => setSiteSettings({ ...siteSettings, paymentText: v })} rows={3} />
                      </div>
                    </SCard>
                  </>
                )}

                {/* ============ AVIS ============ */}
                {settingsSection === 'avis' && (
                  <>
                    <SCard title="Statistiques affichées" subtitle="Les 3 chiffres sous la grille d'avis.">
                      <div className="grid grid-cols-3 gap-3">
                        {siteSettings.reviewStats.map((s, i) => (
                          <div key={i}>
                            <SInput label={`Valeur ${i + 1}`} value={s.value} onChange={(v) => setSiteSettings((s0) => ({ ...s0, reviewStats: s0.reviewStats.map((x, j) => (j === i ? { ...x, value: v } : x)) }))} />
                            <div className="mt-1">
                              <SInput label="Libellé" value={s.label} onChange={(v) => setSiteSettings((s0) => ({ ...s0, reviewStats: s0.reviewStats.map((x, j) => (j === i ? { ...x, label: v } : x)) }))} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </SCard>

                    <SCard title="Avis automatiques" subtitle="Affiche les vraies commandes (prénom, ville, produit) en plus de tes avis rédigés.">
                      <label className="flex items-center gap-2 text-sm font-semibold text-dark/70">
                        <input
                          type="checkbox"
                          checked={siteSettings.reviewsAutoEnabled}
                          onChange={(e) => setSiteSettings({ ...siteSettings, reviewsAutoEnabled: e.target.checked })}
                          className="h-4 w-4"
                        />
                        Activer les avis tirés des commandes réelles
                      </label>
                    </SCard>

                    <SCard title="Avis rédigés" subtitle="Modifie, ajoute ou supprime les témoignages.">
                      {siteSettings.reviews.map((r, i) => (
                        <div key={r.id} className="rounded-2xl bg-white border border-dark/10 p-4 mb-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 grid sm:grid-cols-2 gap-3">
                              <SInput label="Nom" value={r.name} onChange={(v) => setSiteSettings((s) => ({ ...s, reviews: s.reviews.map((x, j) => (j === i ? { ...x, name: v } : x)) }))} />
                              <SInput label="Ville" value={r.city} onChange={(v) => setSiteSettings((s) => ({ ...s, reviews: s.reviews.map((x, j) => (j === i ? { ...x, city: v } : x)) }))} />
                              <SInput label="Produit acheté" value={r.product} onChange={(v) => setSiteSettings((s) => ({ ...s, reviews: s.reviews.map((x, j) => (j === i ? { ...x, product: v } : x)) }))} />
                              <SInput label="Étoiles (1-5)" type="number" value={r.stars} onChange={(v) => setSiteSettings((s) => ({ ...s, reviews: s.reviews.map((x, j) => (j === i ? { ...x, stars: Math.min(5, Math.max(1, Number(v) || 5)) } : x)) }))} />
                              <div className="sm:col-span-2">
                                <STextarea label="Texte de l'avis" value={r.text} onChange={(v) => setSiteSettings((s) => ({ ...s, reviews: s.reviews.map((x, j) => (j === i ? { ...x, text: v } : x)) }))} rows={3} />
                              </div>
                            </div>
                            <DeleteBtn onClick={() => setSiteSettings((s) => ({ ...s, reviews: s.reviews.filter((_, j) => j !== i) }))} />
                          </div>
                        </div>
                      ))}
                      <AddBtn
                        label="Ajouter un avis"
                        onClick={() =>
                          setSiteSettings((s) => ({
                            ...s,
                            reviews: [
                              ...s.reviews,
                              { id: `r${Date.now()}`, name: 'Prénom N.', city: 'Ville', product: 'Produit', text: '', stars: 5 },
                            ],
                          }))
                        }
                      />
                    </SCard>
                  </>
                )}

                {/* ============ FAQ ============ */}
                {settingsSection === 'faq' && (
                  <SCard title="Questions fréquentes" subtitle="Chaque entrée est une question + sa réponse.">
                    {siteSettings.faq.map((f, i) => (
                      <div key={i} className="rounded-2xl bg-white border border-dark/10 p-4 mb-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-3">
                            <SInput label="Question" value={f.q} onChange={(v) => setSiteSettings((s) => ({ ...s, faq: s.faq.map((x, j) => (j === i ? { ...x, q: v } : x)) }))} />
                            <STextarea label="Réponse" value={f.a} onChange={(v) => setSiteSettings((s) => ({ ...s, faq: s.faq.map((x, j) => (j === i ? { ...x, a: v } : x)) }))} rows={3} />
                          </div>
                          <DeleteBtn onClick={() => setSiteSettings((s) => ({ ...s, faq: s.faq.filter((_, j) => j !== i) }))} />
                        </div>
                      </div>
                    ))}
                    <AddBtn
                      label="Ajouter une question"
                      onClick={() => setSiteSettings((s) => ({ ...s, faq: [...s.faq, { q: 'Nouvelle question ?', a: 'Réponse...' }] }))}
                    />
                  </SCard>
                )}

                {/* ============ COMMENT ÇA MARCHE ============ */}
                {settingsSection === 'comment' && (
                  <>
                    <SCard title="En-tête">
                      <div className="space-y-3">
                        <SInput label="Titre" value={siteSettings.howItWorksTitle} onChange={(v) => setSiteSettings({ ...siteSettings, howItWorksTitle: v })} />
                        <SInput label="Sous-titre" value={siteSettings.howItWorksSubtitle} onChange={(v) => setSiteSettings({ ...siteSettings, howItWorksSubtitle: v })} />
                      </div>
                    </SCard>
                    <SCard title="Les étapes" subtitle="Emoji + titre + durée + description.">
                      {siteSettings.steps.map((st, i) => (
                        <div key={i} className="rounded-2xl bg-white border border-dark/10 p-4 mb-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 grid sm:grid-cols-2 gap-3">
                              <SInput label="Emoji" value={st.emoji} onChange={(v) => setSiteSettings((s) => ({ ...s, steps: s.steps.map((x, j) => (j === i ? { ...x, emoji: v } : x)) }))} />
                              <SInput label="Durée (ex : 2 min)" value={st.tag} onChange={(v) => setSiteSettings((s) => ({ ...s, steps: s.steps.map((x, j) => (j === i ? { ...x, tag: v } : x)) }))} />
                              <div className="sm:col-span-2">
                                <SInput label="Titre" value={st.title} onChange={(v) => setSiteSettings((s) => ({ ...s, steps: s.steps.map((x, j) => (j === i ? { ...x, title: v } : x)) }))} />
                              </div>
                              <div className="sm:col-span-2">
                                <STextarea label="Description" value={st.text} onChange={(v) => setSiteSettings((s) => ({ ...s, steps: s.steps.map((x, j) => (j === i ? { ...x, text: v } : x)) }))} rows={2} />
                              </div>
                            </div>
                            <DeleteBtn onClick={() => setSiteSettings((s) => ({ ...s, steps: s.steps.filter((_, j) => j !== i) }))} />
                          </div>
                        </div>
                      ))}
                      <AddBtn
                        label="Ajouter une étape"
                        onClick={() => setSiteSettings((s) => ({ ...s, steps: [...s.steps, { emoji: '✨', title: 'Nouvelle étape', text: 'Description...', tag: 'durée' }] }))}
                      />
                    </SCard>
                  </>
                )}

                {/* ============ POURQUOI TOF ============ */}
                {settingsSection === 'pourquoi' && (
                  <>
                    <SCard title="Texte d'introduction">
                      <SInput label="Intro" value={siteSettings.whyUsIntro} onChange={(v) => setSiteSettings({ ...siteSettings, whyUsIntro: v })} />
                    </SCard>
                    <SCard title="Les 4 points" subtitle="Emoji, titre, description, stat + libellé.">
                      {siteSettings.whyUsPoints.map((p, i) => (
                        <div key={i} className="rounded-2xl bg-white border border-dark/10 p-4 mb-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 grid sm:grid-cols-2 gap-3">
                              <SInput label="Emoji" value={p.emoji} onChange={(v) => setSiteSettings((s) => ({ ...s, whyUsPoints: s.whyUsPoints.map((x, j) => (j === i ? { ...x, emoji: v } : x)) }))} />
                              <SInput label="Titre" value={p.title} onChange={(v) => setSiteSettings((s) => ({ ...s, whyUsPoints: s.whyUsPoints.map((x, j) => (j === i ? { ...x, title: v } : x)) }))} />
                              <div className="sm:col-span-2">
                                <STextarea label="Description" value={p.desc} onChange={(v) => setSiteSettings((s) => ({ ...s, whyUsPoints: s.whyUsPoints.map((x, j) => (j === i ? { ...x, desc: v } : x)) }))} rows={2} />
                              </div>
                              <SInput label="Stat (ex : 100%)" value={p.stat} onChange={(v) => setSiteSettings((s) => ({ ...s, whyUsPoints: s.whyUsPoints.map((x, j) => (j === i ? { ...x, stat: v } : x)) }))} />
                              <SInput label="Libellé stat" value={p.statLabel} onChange={(v) => setSiteSettings((s) => ({ ...s, whyUsPoints: s.whyUsPoints.map((x, j) => (j === i ? { ...x, statLabel: v } : x)) }))} />
                            </div>
                            <DeleteBtn onClick={() => setSiteSettings((s) => ({ ...s, whyUsPoints: s.whyUsPoints.filter((_, j) => j !== i) }))} />
                          </div>
                        </div>
                      ))}
                      <AddBtn
                        label="Ajouter un point"
                        onClick={() => setSiteSettings((s) => ({ ...s, whyUsPoints: [...s.whyUsPoints, { emoji: '✨', title: 'Nouveau point', desc: 'Description...', stat: 'stat', statLabel: 'libellé' }] }))}
                      />
                    </SCard>
                  </>
                )}

                {/* ============ FOOTER ============ */}
                {settingsSection === 'footer' && (
                  <>
                    <SCard title="Description">
                      <STextarea label="Texte sous le logo" value={siteSettings.footerDescription} onChange={(v) => setSiteSettings({ ...siteSettings, footerDescription: v })} rows={2} />
                    </SCard>
                    <SCard title="Garanties" subtitle="La liste à puces du footer.">
                      {siteSettings.footerGuarantees.map((g, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                          <input
                            value={g}
                            onChange={(e) => setSiteSettings((s) => ({ ...s, footerGuarantees: s.footerGuarantees.map((x, j) => (j === i ? e.target.value : x)) }))}
                            className="flex-1 rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/10"
                          />
                          <DeleteBtn onClick={() => setSiteSettings((s) => ({ ...s, footerGuarantees: s.footerGuarantees.filter((_, j) => j !== i) }))} />
                        </div>
                      ))}
                      <AddBtn label="Ajouter une garantie" onClick={() => setSiteSettings((s) => ({ ...s, footerGuarantees: [...s.footerGuarantees, 'Nouvelle garantie'] }))} />
                    </SCard>
                  </>
                )}

                {/* ============ MARQUES ============ */}
                {settingsSection === 'marques' && (
                  <SCard title="Bandeau des marques" subtitle="Une marque par ligne (bandeau défilant sous le hero).">
                    <textarea
                      value={siteSettings.brandNames.join('\n')}
                      onChange={(e) => setSiteSettings((s) => ({ ...s, brandNames: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }))}
                      rows={10}
                      className="w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/10 font-mono resize-none"
                    />
                    <p className="mt-2 text-[11px] text-dark/35">{siteSettings.brandNames.length} marque(s).</p>
                  </SCard>
                )}

                {/* ============ NOUVEAUTÉS ============ */}
                {settingsSection === 'nouveautes' && (
                  <>
                    <SCard title="Section Nouveautés" subtitle="Un rail horizontal des dernières pièces, affiché juste au-dessus du shop.">
                      <label className="flex items-center gap-2 text-sm font-semibold text-dark/70">
                        <input
                          type="checkbox"
                          checked={siteSettings.newArrivalsEnabled}
                          onChange={(e) => setSiteSettings({ ...siteSettings, newArrivalsEnabled: e.target.checked })}
                          className="h-4 w-4"
                        />
                        Afficher la section Nouveautés
                      </label>
                    </SCard>
                    <SCard title="Contenu">
                      <div className="space-y-3">
                        <SInput label="Titre" value={siteSettings.newArrivalsTitle} onChange={(v) => setSiteSettings({ ...siteSettings, newArrivalsTitle: v })} />
                        <SInput label="Sous-titre" value={siteSettings.newArrivalsSubtitle} onChange={(v) => setSiteSettings({ ...siteSettings, newArrivalsSubtitle: v })} />
                        <SInput label="Nombre de pièces affichées" type="number" value={siteSettings.newArrivalsCount} onChange={(v) => setSiteSettings({ ...siteSettings, newArrivalsCount: Math.max(1, Number(v) || 8) })} />
                        <SInput label="Fenêtre « nouveau » (en jours)" type="number" value={siteSettings.newProductDays} onChange={(v) => setSiteSettings({ ...siteSettings, newProductDays: Math.max(1, Number(v) || 7) })} />
                      </div>
                      <p className="mt-2 text-[11px] text-dark/35">
                        La fenêtre « nouveau » contrôle aussi le badge « Nouveau » sur les cartes du shop : un produit ajouté il y a moins de ce nombre de jours l'affiche automatiquement.
                      </p>
                    </SCard>
                  </>
                )}

                {/* ============ LANCEMENT ============ */}
                {settingsSection === 'lancement' && (
                  <>
                    <SCard title="Bannière de lancement" subtitle="Une bannière pleine largeur sous le hero pour annoncer un drop, avec compte à rebours.">
                      <label className="flex items-center gap-2 text-sm font-semibold text-dark/70">
                        <input
                          type="checkbox"
                          checked={siteSettings.launchBannerEnabled}
                          onChange={(e) => setSiteSettings({ ...siteSettings, launchBannerEnabled: e.target.checked })}
                          className="h-4 w-4"
                        />
                        Afficher la bannière
                      </label>
                    </SCard>
                    <SCard title="Contenu">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <SInput label="Badge (ex : 🔥 NOUVEAU DROP)" value={siteSettings.launchBannerBadge} onChange={(v) => setSiteSettings({ ...siteSettings, launchBannerBadge: v })} />
                        <SInput label="Titre" value={siteSettings.launchBannerTitle} onChange={(v) => setSiteSettings({ ...siteSettings, launchBannerTitle: v })} />
                        <div className="sm:col-span-2">
                          <STextarea label="Description" value={siteSettings.launchBannerDescription} onChange={(v) => setSiteSettings({ ...siteSettings, launchBannerDescription: v })} rows={2} />
                        </div>
                        <SInput label="Prix (€)" type="number" value={siteSettings.launchBannerPrice} onChange={(v) => setSiteSettings({ ...siteSettings, launchBannerPrice: Number(v) || 0 })} />
                        <SInput label="Ancien prix (€, optionnel)" type="number" value={siteSettings.launchBannerOldPrice} onChange={(v) => setSiteSettings({ ...siteSettings, launchBannerOldPrice: Number(v) || 0 })} />
                        <SInput label="Texte du bouton" value={siteSettings.launchBannerCtaLabel} onChange={(v) => setSiteSettings({ ...siteSettings, launchBannerCtaLabel: v })} />
                        <SInput label="Lien du bouton (ex : #shop)" value={siteSettings.launchBannerCtaUrl} onChange={(v) => setSiteSettings({ ...siteSettings, launchBannerCtaUrl: v })} />
                        <div className="sm:col-span-2">
                          <SInput label="Image (URL)" value={siteSettings.launchBannerImage} onChange={(v) => setSiteSettings({ ...siteSettings, launchBannerImage: v })} placeholder="https://..." />
                        </div>
                        <div className="sm:col-span-2">
                          <SInput label="Fin du compte à rebours (date + heure)" value={siteSettings.launchBannerEndsAt} onChange={(v) => setSiteSettings({ ...siteSettings, launchBannerEndsAt: v })} placeholder="2026-08-25T20:00:00" />
                          <p className="mt-1 text-[11px] text-dark/35">
                            Laisse vide pour ne pas afficher de compte à rebours. Format : AAAA-MM-JJTHH:MM:SS (heure locale).
                          </p>
                        </div>
                      </div>
                    </SCard>
                  </>
                )}

                {/* ============ APPARENCE ============ */}
                {settingsSection === 'apparence' && (
                  <SCard title="Couleur d'accent" subtitle="La couleur orange principale du site (boutons, soulignés, badges).">
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={siteSettings.accentColor}
                        onChange={(e) => {
                          const c = e.target.value;
                          setSiteSettings((s) => ({ ...s, accentColor: c }));
                          document.documentElement.style.setProperty('--color-accent', c);
                        }}
                        className="h-12 w-16 rounded-xl border border-dark/10 bg-white cursor-pointer"
                      />
                      <input
                        value={siteSettings.accentColor}
                        onChange={(e) => setSiteSettings((s) => ({ ...s, accentColor: e.target.value }))}
                        className="w-32 rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/10 font-mono"
                      />
                      <div className="flex gap-2">
                        {['#e84d1a', '#111111', '#2563eb', '#16a34a', '#9333ea', '#db2777'].map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              setSiteSettings((s) => ({ ...s, accentColor: c }));
                              document.documentElement.style.setProperty('--color-accent', c);
                            }}
                            style={{ background: c }}
                            className={`h-8 w-8 rounded-full border-2 ${siteSettings.accentColor === c ? 'border-dark' : 'border-transparent'}`}
                            aria-label={c}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Aperçu */}
                    <div className="mt-4 rounded-2xl bg-bg p-4 space-y-2">
                      <button className="bg-accent text-white px-4 py-2 rounded-full text-xs font-bold">Bouton principal</button>
                      <span className="ml-2 inline-block h-6 w-6 rounded-full bg-accent" />
                      <span className="ml-2 text-accent font-bold">Texte accent</span>
                    </div>
                  </SCard>
                )}

                {/* Bouton sauvegarder en bas */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={saveSettings}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white hover:brightness-110 transition-colors"
                  >
                    <Save size={15} /> {settingsSaved ? 'Sauvegardé ✓' : 'Sauvegarder les réglages'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
                  <div className="text-[10px] uppercase tracking-widest text-white/35 font-bold">Total</div>
                  <div className="text-xl sm:text-2xl font-800 mt-1">{convoMap.size}</div>
                  <div className="text-[10px] text-white/30">
                    {convoList.length !== convoMap.size ? `${convoList.length} affichée${convoList.length > 1 ? 's' : ''}` : 'conversations'}
                  </div>
                </div>
                <div className="rounded-2xl bg-accent/15 border border-accent/30 p-3 sm:p-4">
                  <div className="text-[10px] uppercase tracking-widest text-accent font-bold">À répondre</div>
                  <div className="text-xl sm:text-2xl font-800 mt-1 text-accent">{unreadTotal}</div>
                  <div className="text-[10px] text-accent/60">
                    {avgResponseMinutes !== null
                      ? `réponse ~${avgResponseMinutes < 60 ? `${avgResponseMinutes} min` : `${Math.round(avgResponseMinutes / 60)} h`}`
                      : 'en attente'}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
                  <div className="text-[10px] uppercase tracking-widest text-white/35 font-bold">En ligne</div>
                  <div className="text-xl sm:text-2xl font-800 mt-1">{onlineCount}</div>
                  <div className="text-[10px] text-white/30">visiteurs</div>
                </div>
                <div className={`rounded-2xl p-3 sm:p-4 border ${
                  needsHelpTotal > 0 ? 'bg-red-500/15 border-red-500/30' : 'bg-white/5 border-white/10'
                }`}>
                  <div className={`text-[10px] uppercase tracking-widest font-bold ${
                    needsHelpTotal > 0 ? 'text-red-300' : 'text-white/35'
                  }`}>Bot bloqué</div>
                  <div className={`text-xl sm:text-2xl font-800 mt-1 ${needsHelpTotal > 0 ? 'text-red-300' : ''}`}>
                    {needsHelpTotal}
                  </div>
                  <div className={`text-[10px] ${needsHelpTotal > 0 ? 'text-red-300/60' : 'text-white/30'}`}>
                    {needsHelpTotal > 0 ? 'à reprendre' : `${todayMsgCount} msg aujourd'hui`}
                  </div>
                </div>
              </div>

              {/* Recherche + filtres */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                  <input
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Rechercher un client ou un message..."
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-10 pr-9 text-sm text-white placeholder:text-white/25 outline-none focus:border-accent/40"
                  />
                  {chatSearch && (
                    <button
                      onClick={() => setChatSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                      aria-label="Effacer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {([
                    { id: 'all' as const, label: `Tout (${convoMap.size})` },
                    { id: 'unread' as const, label: `À répondre (${unreadTotal})` },
                    { id: 'needsHelp' as const, label: `⚠️ Bot bloqué (${needsHelpTotal})` },
                  ]).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setChatFilter(f.id)}
                      className={`h-11 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                        chatFilter === f.id
                          ? 'bg-accent text-white'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-5">
                <div className="rounded-3xl bg-white text-dark overflow-hidden">
                  <div className="p-4 border-b border-dark/5 flex items-center justify-between">
                    <h3 className="font-bold">Conversations</h3>
                    {unreadTotal > 0 && (
                      <span className="bg-accent text-white text-[10px] font-bold px-2 py-1 rounded-full">
                        {unreadTotal} à répondre
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-dark/5 max-h-[560px] overflow-y-auto">
                    {convoList.length === 0 && (
                      <div className="p-8 text-center text-sm text-dark/30">
                        {chatSearch || chatFilter !== 'all' ? (
                          <>
                            Aucun résultat.<br />
                            <button
                              onClick={() => { setChatSearch(''); setChatFilter('all'); }}
                              className="text-xs font-bold text-accent hover:underline mt-1"
                            >
                              Réinitialiser la recherche
                            </button>
                          </>
                        ) : (
                          <>
                            Aucune conversation pour l'instant.<br />
                            <span className="text-xs">Les visiteurs qui utilisent le chat apparaîtront ici.</span>
                          </>
                        )}
                      </div>
                    )}
                    {convoList.map(([id, convo]) => {
                      const isActive = activeConvo === id;
                      const isClientLast = convo.lastMsg.sender === 'client';
                      return (
                        <button
                          key={id}
                          onClick={() => setActiveConvo(id)}
                          className={`w-full text-left p-3 sm:p-4 hover:bg-bg transition-colors ${isActive ? 'bg-bg' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative flex-shrink-0">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                convo.hasUnread ? 'bg-accent' : 'bg-dark/70'
                              }`}>
                                {convo.name[0]?.toUpperCase() || '?'}
                              </div>
                              {convo.hasUnread && (
                                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-red-500 rounded-full border-2 border-white" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-bold text-sm truncate ${convo.hasUnread ? 'text-dark' : 'text-dark/70'}`}>
                                  {convo.name}
                                </span>
                                <span className="text-[10px] text-dark/30 flex-shrink-0">{timeAgo(convo.lastMsg.created_at)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-xs truncate ${convo.hasUnread && isClientLast ? 'text-dark font-semibold' : 'text-dark/40'}`}>
                                  {convo.lastMsg.sender === 'admin' ? 'Toi : ' : convo.lastMsg.sender === 'bot' ? 'Bot : ' : ''}
                                  {convo.lastMsg.message.startsWith(ESCALATION_TAG)
                                    ? 'Question sans réponse du bot'
                                    : convo.lastMsg.message}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[9px] font-bold text-dark/25 uppercase">
                                  {convo.messages.length} msg
                                </span>
                                {convo.needsHelp && (
                                  <span className="text-[9px] font-black text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded-full uppercase">
                                    ⚠️ Bot bloqué
                                  </span>
                                )}
                                {convo.hasUnread && convo.waitingMinutes >= 5 && (
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                                    convo.waitingMinutes >= 60
                                      ? 'text-red-600 bg-red-500/10'
                                      : 'text-orange-600 bg-orange-500/10'
                                  }`}>
                                    ⏱ {convo.waitingMinutes < 60
                                      ? `${convo.waitingMinutes} min`
                                      : `${Math.floor(convo.waitingMinutes / 60)} h`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-3xl bg-white text-dark flex flex-col overflow-hidden" style={{ minHeight: 560 }}>
                  {!activeConvo || !activeConvoData ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-dark/30 text-sm p-8 text-center gap-3">
                      <div className="h-16 w-16 rounded-3xl bg-bg flex items-center justify-center text-3xl">💬</div>
                      <p>Sélectionne une conversation pour voir les messages</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 border-b border-dark/5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-accent text-white flex items-center justify-center text-sm font-bold">
                            {activeConvoData.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold">{activeConvoData.name}</div>
                            <div className="text-[10px] text-dark/30 uppercase tracking-widest font-bold">
                              {activeConvoData.messages.length} messages · {timeAgo(activeConvoData.lastMsg.created_at)}
                              {activeConvoOrders.length > 0 && (
                                <span className="text-accent"> · {activeConvoOrders.length} commande{activeConvoOrders.length > 1 ? 's' : ''}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={`https://wa.me/${activeConvoPhone}?text=${encodeURIComponent(`Salut ${activeConvoData.name} !`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="h-9 px-3 rounded-xl bg-[#25D366]/10 text-[#25D366] text-xs font-bold hover:bg-[#25D366] hover:text-white transition-colors inline-flex items-center gap-1"
                            title={activeConvoPhone ? `Contacter sur WhatsApp (+${activeConvoPhone})` : 'Contacter sur WhatsApp (numéro inconnu)'}
                          >
                            WhatsApp{activeConvoPhone ? '' : ' ?'}
                          </a>
                          <button
                            onClick={() => {
                              const lines = activeMessages.map((m) => {
                                const who = m.sender === 'client' ? activeConvoData.name : m.sender === 'admin' ? 'Toi' : 'Bot';
                                return `[${formatTime(m.created_at)}] ${who}: ${m.message}`;
                              }).join('\n');
                              const blob = new Blob([`Conversation avec ${activeConvoData.name}\n\n${lines}\n`], { type: 'text/plain;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `chat-${activeConvoData.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
                              a.click();
                              URL.revokeObjectURL(url);
                              showToast('Conversation exportée ✓');
                            }}
                            className="h-9 w-9 rounded-xl bg-dark/5 hover:bg-dark/10 text-dark/50 flex items-center justify-center"
                            title="Exporter la conversation (.txt)"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => {
                              const text = activeMessages.map((m) => {
                                const who = m.sender === 'client' ? activeConvoData.name : m.sender === 'admin' ? 'Toi' : 'Bot';
                                return `[${formatTime(m.created_at)}] ${who}: ${m.message}`;
                              }).join('\n');
                              navigator.clipboard.writeText(text);
                              showToast('Conversation copiée ✓');
                              playCopy();
                            }}
                            className="h-9 w-9 rounded-xl bg-dark/5 hover:bg-dark/10 text-dark/50 flex items-center justify-center"
                            title="Copier la conversation"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Supprimer la conversation avec ${activeConvoData.name} ?`)) {
                                await deleteConversation(activeConvo);
                                setChatMessages((prev) => prev.filter((m) => m.conversation_id !== activeConvo));
                                setActiveConvo(null);
                                showToast('Conversation supprimée ✓');
                              }
                            }}
                            className="h-9 w-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button onClick={() => setActiveConvo(null)} className="lg:hidden h-9 w-9 rounded-xl bg-dark/5 flex items-center justify-center text-dark/50">
                            <ArrowLeft size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Fiche client : commandes rattachées, pour répondre sans changer d'onglet */}
                      {activeConvoOrders.length > 0 && (
                        <div className="px-4 py-2.5 bg-accent/[0.04] border-b border-dark/5">
                          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                            {activeConvoOrders.slice(0, 4).map((o) => (
                              <button
                                key={o.id}
                                onClick={() => { setActiveTab('orders'); showToast(`Commande ${o.id} — onglet Commandes`); }}
                                className="shrink-0 text-left rounded-xl bg-white border border-dark/5 px-3 py-1.5 hover:border-accent/40 transition-colors"
                                title="Ouvrir dans l'onglet Commandes"
                              >
                                <div className="text-[10px] font-black text-dark/70">{o.id}</div>
                                <div className="text-[9px] font-bold text-dark/35 uppercase tracking-tight">
                                  {statusLabels[o.status] || o.status}
                                  {o.tracking ? ' · suivi ✓' : ''}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F9F9F9]">
                        {activeMessages.map((msg) => {
                          const isClient = msg.sender === 'client';
                          const isAdmin = msg.sender === 'admin';
                          const isBot = msg.sender === 'bot';

                          // Marqueur interne du bot : affiché comme une alerte, pas comme un message
                          if (msg.message.startsWith(ESCALATION_TAG)) {
                            return (
                              <div key={msg.id} className="group/msg flex justify-center">
                                <div className="relative max-w-[92%] w-full rounded-xl bg-red-500/[0.07] border border-red-500/20 px-3.5 py-2.5">
                                  <div className="text-[9px] font-black text-red-600 uppercase tracking-tighter mb-1">
                                    ⚠️ Le bot n'a pas su répondre — visible par toi seul
                                  </div>
                                  <p className="text-[13px] text-dark/70 whitespace-pre-wrap">
                                    {msg.message.replace(ESCALATION_TAG, '').replace(/^\s*[—-]\s*/, '').trim()}
                                  </p>
                                  <div className="text-[9px] mt-1.5 font-bold text-dark/30">
                                    {formatTime(msg.created_at)}
                                  </div>
                                  <button
                                    onClick={async () => {
                                      await deleteChatMessage(msg.id);
                                      setChatMessages((prev) => prev.filter((m) => m.id !== msg.id));
                                    }}
                                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] items-center justify-center hidden group-hover/msg:flex"
                                    title="Marquer comme traité"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={msg.id} className={`group/msg flex ${isClient ? 'justify-start' : 'justify-end'}`}>
                              <div className="relative max-w-[85%]">
                                <div
                                  className={`rounded-[20px] px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm ${
                                    isClient
                                      ? 'bg-white text-dark rounded-bl-md border border-dark/[0.03]'
                                      : isAdmin
                                        ? 'bg-accent text-white rounded-br-md'
                                        : 'bg-dark/5 text-dark/60 rounded-bl-md italic'
                                  }`}
                                >
                                  {isBot && (
                                    <div className="text-[9px] font-black text-dark/25 mb-1 uppercase tracking-tighter flex items-center gap-1">
                                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-dark/30" />
                                      Assistant auto
                                    </div>
                                  )}
                                  {isAdmin && (
                                    <div className="text-[9px] font-black text-white/60 mb-1 uppercase tracking-tighter">
                                      Toi
                                    </div>
                                  )}
                                  <p className="whitespace-pre-wrap">{msg.message}</p>
                                  <div className={`text-[9px] mt-1.5 font-bold opacity-40 ${isClient ? 'text-left' : 'text-right'}`}>
                                    {formatTime(msg.created_at)}
                                  </div>
                                </div>
                                {!isBot && (
                                  <button
                                    onClick={async () => {
                                      await deleteChatMessage(msg.id);
                                      setChatMessages((prev) => prev.filter((m) => m.id !== msg.id));
                                    }}
                                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] items-center justify-center hidden group-hover/msg:flex"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Quick replies */}
                      <div className="px-3 pt-2 border-t border-dark/5">
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                          {quickReplies.map((q) => (
                            <button
                              key={q}
                              onClick={() => setChatReply(personalize(q, activeConvoData.name))}
                              className="flex-shrink-0 rounded-full bg-bg hover:bg-dark hover:text-white text-dark/60 text-[11px] font-bold px-3 py-1.5 h-8 transition-colors"
                            >
                              {q.length > 40 ? q.slice(0, 40) + '…' : q}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-dark/5 p-3 flex gap-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
                        <input
                          value={chatReply}
                          onChange={(e) => setChatReply(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void sendAdminReply();
                            }
                          }}
                          placeholder={activeConvoData ? `Répondre à ${activeConvoData.name}...` : 'Répondre...'}
                          className="flex-1 rounded-xl bg-bg px-4 h-11 text-sm outline-none focus:ring-4 focus:ring-accent/5"
                          autoFocus
                        />
                        <button
                          onClick={() => void sendAdminReply()}
                          disabled={!chatReply.trim()}
                          aria-label="Envoyer"
                          className="h-11 w-11 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-colors disabled:opacity-30 shadow-lg shadow-accent/20"
                        >
                          <Send size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-5">
            {noteStats.total > 0 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{progressPercent}% terminé</span>
                  <span className="text-xs text-white/30">{noteStats.done}/{noteStats.total} tâches</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-green-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
                {[
                  { label: `Tout (${noteStats.total})`, filter: 'all' as const },
                  { label: `🔴 Urgent (${noteStats.urgent})`, filter: 'urgent' as const },
                  { label: `🟡 À faire (${noteStats.todo})`, filter: 'todo' as const },
                  { label: `💡 Idées (${noteStats.idea})`, filter: 'idea' as const },
                  { label: `✅ Fait (${noteStats.done})`, filter: 'done' as const },
                ].map((s) => (
                  <button
                    key={s.filter}
                    onClick={() => setNoteFilter(s.filter)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                      noteFilter === s.filter ? 'bg-accent text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setNoteSort(noteSort === 'priority' ? 'date' : 'priority')} className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-white/40 hover:bg-white/10 transition-colors">
                  Tri : {noteSort === 'priority' ? 'Priorité' : 'Date'}
                </button>
                {noteStats.done > 0 && (
                  <button onClick={clearDone} className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-white/40 hover:bg-white/10 transition-colors">
                    Vider fait
                  </button>
                )}
                {noteStats.total > noteStats.done && (
                  <button onClick={markAllDone} className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-white/40 hover:bg-white/10 transition-colors">
                    Tout fait
                  </button>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-3">
                {filteredNotes.length === 0 && (
                  <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center text-white/30">
                    {noteFilter === 'all' ? "Aucune note pour l'instant. Ajoute ta première idée !" : 'Rien dans cette catégorie.'}
                  </div>
                )}
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`rounded-2xl p-4 flex items-start gap-3 transition-all ${
                      note.done ? 'bg-white/5 border border-white/5' : 'bg-white text-dark shadow-lg shadow-black/5'
                    }`}
                  >
                    <button
                      onClick={() => toggleNoteDone(note)}
                      className={`mt-0.5 h-6 w-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        note.done ? 'bg-green-500 border-green-500 text-white' : 'border-dark/20 hover:border-accent'
                      }`}
                    >
                      {note.done && <span className="text-xs">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            className="w-full rounded-xl bg-bg px-3 py-2 text-sm outline-none resize-none"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button onClick={() => updateNoteText(note, editingNoteText)} className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">Sauvegarder</button>
                            <button onClick={() => setEditingNoteId(null)} className="rounded-full bg-dark/5 px-3 py-1 text-xs font-bold text-dark/40">Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <p
                          onClick={() => { if (!note.done) { setEditingNoteId(note.id); setEditingNoteText(note.text); } }}
                          className={`text-sm leading-relaxed cursor-pointer ${note.done ? 'text-white/30 line-through' : 'hover:text-accent/80'}`}
                        >
                          {note.text}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {['urgent', 'todo', 'idea'].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => changeNoteCategory(note, cat)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
                              note.category === cat
                                ? cat === 'urgent' ? 'bg-red-500/15 text-red-400' : cat === 'todo' ? 'bg-amber-400/15 text-amber-400' : 'bg-blue-400/15 text-blue-400'
                                : note.done ? 'bg-white/5 text-white/15' : 'bg-dark/5 text-dark/20 hover:text-dark/40'
                            }`}
                          >
                            {cat === 'urgent' ? '🔴' : cat === 'todo' ? '🟡' : '💡'}
                          </button>
                        ))}
                        {note.created_at && (
                          <span className={`text-[10px] ml-auto ${note.done ? 'text-white/15' : 'text-dark/20'}`}>
                            {new Date(note.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeNote(note.id)}
                      className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
                        note.done ? 'text-white/15 hover:text-red-400' : 'text-dark/20 hover:text-red-500'
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl bg-white/5 border border-white/10 p-5 h-fit space-y-4">
                <h3 className="font-bold text-white text-lg">Ajouter une note</h3>
                <textarea
                  value={newNote.text}
                  onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                  placeholder="Ta note, idée, tâche..."
                  rows={4}
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }}
                />
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'urgent', label: '🔴 Urgent', color: 'bg-red-500/20 text-red-300' },
                    { value: 'todo', label: '🟡 À faire', color: 'bg-amber-400/20 text-amber-300' },
                    { value: 'idea', label: '💡 Idée', color: 'bg-blue-400/20 text-blue-300' },
                  ].map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setNewNote({ ...newNote, category: cat.value })}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                        newNote.category === cat.value ? cat.color + ' ring-2 ring-white/20' : 'bg-white/5 text-white/30'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={addNote}
                  className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hue-rotate-0 hover:brightness-110 transition-colors"
                >
                  Ajouter
                </button>

                <div className="border-t border-white/5 pt-4 mt-4">
                  <h4 className="font-bold text-white/60 text-sm mb-3">Suggestions rapides</h4>
                  <div className="space-y-2">
                    {[
                      'Ajouter mes vrais produits avec liens Mulebuy',
                      'Mettre les photos produits',
                      'Trouver un agent pour le fulfillment',
                      'Tester avec 2-3 commandes réelles',
                      'Configurer le drop de la semaine',
                      'Acheter un nom de domaine',
                      'Calculer mes marges réelles',
                      'Préparer les réponses types WhatsApp',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setNewNote({ ...newNote, text: suggestion })}
                        className="block w-full text-left rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-white/35 hover:text-white/55 transition-colors"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'estimate' && <EstimatorTab
          products={products}
          selectedEstimateProduct={selectedEstimateProduct}
          setSelectedEstimateProduct={setSelectedEstimateProduct}
          getProduct={getProduct}
        />}
      </div>

      {/* Drawer d'édition / création produit */}
      <ProductEditDrawer
        open={drawerOpen}
        isNew={drawerIsNew}
        draft={drawerDraft}
        original={drawerOriginal}
        onChange={setDrawerDraft}
        onClose={closeDrawer}
        onSave={saveDrawer}
        onDuplicate={duplicateProduct}
        onAutoPrice={autoPriceDrawer}
      />

      {/* Dialog de confirmation */}
      {confirmDialog.open && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          tone={confirmDialog.tone}
          onConfirm={() => confirmDialog.onConfirm?.()}
          onCancel={() => setConfirmDialog((c) => ({ ...c, open: false }))}
        />
      )}
    </section>
  );
}
