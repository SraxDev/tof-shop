import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Package, Pencil, Plus, Save, Send, Trash2, Truck } from 'lucide-react';
import { defaultDrop, type FeaturedDropConfig } from './FeaturedDrop';
import { defaultSettings, readSiteSettings, saveSiteSettings, hydrateSiteSettings, type SiteSettings } from '../lib/siteSettings';
import { fetchProducts, upsertProduct, deleteProduct as dbDeleteProduct, fetchOrders, updateOrder, insertOrder as dbInsertOrder, fetchDrop, saveDrop as dbSaveDrop, fetchNotes, upsertNote, deleteNote as dbDeleteNote, subscribeToOrders, subscribeToProducts, onOnlineCountChange, getPresenceState, trackVisitor, fetchConversations, sendChatMessage, subscribeToChatMessages, deleteConversation, deleteChatMessage, fetchPromoCodes, upsertPromoCode, deletePromoCode, type DbProduct, type DbOrder, type DbDrop, type DbNote, type DbChatMessage, type DbPromoCode } from '../lib/db';
import { showToast } from './Toast';
import { playNewOrder, playCopy, playDelete } from '../lib/sounds';

type Product = {
  id: string;
  brand: string;
  name: string;
  category: string;
  gender: 'homme' | 'femme' | 'mixte';
  salePrice: number;
  sourcePriceCny: number;
  weightGrams: number;
  packaging: 'none' | 'without_box' | 'with_box';
  sizes: string;
  colors: string;
  imageUrl: string;
  sourceUrl: string;
  status: 'active' | 'link_dead' | 'paused';
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
};

// Legacy keys kept for reference
// const STORAGE_PRODUCTS = 'tof-admin-products-v1';
// const STORAGE_ORDERS = 'tof-admin-orders-v1';
// const STORAGE_DROP = 'tof-featured-drop-v1';
const CNY_TO_EUR = 0.13;
const SHIPPING_SAFETY_MULTIPLIER = 1.2;

const categoryPresets = [
  { label: 'T-shirt', weight: 320, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black, White' },
  { label: 'Polo', weight: 380, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black, White' },
  { label: 'Chemise', weight: 350, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black, White' },
  { label: 'Hoodie / pull', weight: 900, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black, White' },
  { label: 'Veste légère', weight: 1100, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black' },
  { label: 'Doudoune', weight: 1600, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black' },
  { label: 'Jean / pantalon', weight: 750, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black, Blue' },
  { label: 'Short', weight: 400, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black, White' },
  { label: 'Jogging', weight: 650, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black, Grey' },
  { label: 'Maillot de bain', weight: 200, packaging: 'none' as const, defaultSizes: 'S, M, L, XL', defaultColors: 'Black, Blue' },
  { label: 'Ensemble', weight: 1200, packaging: 'none' as const, defaultSizes: 'S, M, L, XL, XXL', defaultColors: 'Black, White' },
  { label: 'Robe', weight: 500, packaging: 'none' as const, defaultSizes: 'XS, S, M, L, XL', defaultColors: 'Black, White' },
  { label: 'Jupe', weight: 350, packaging: 'none' as const, defaultSizes: 'XS, S, M, L, XL', defaultColors: 'Black' },
  { label: 'Sous-vêtement', weight: 150, packaging: 'none' as const, defaultSizes: 'S, M, L, XL', defaultColors: 'Black, White' },
  { label: 'Casquette', weight: 250, packaging: 'none' as const, defaultSizes: '', defaultColors: 'Black, White' },
  { label: 'Bonnet', weight: 200, packaging: 'none' as const, defaultSizes: '', defaultColors: 'Black' },
  { label: 'Ceinture', weight: 300, packaging: 'none' as const, defaultSizes: '', defaultColors: 'Black, Brown' },
  { label: 'Lunettes', weight: 150, packaging: 'none' as const, defaultSizes: '', defaultColors: 'Black' },
  { label: 'Bijoux', weight: 100, packaging: 'none' as const, defaultSizes: '', defaultColors: '' },
  { label: 'Sacoche', weight: 500, packaging: 'none' as const, defaultSizes: '', defaultColors: 'Black, Brown' },
  { label: 'Sac à main', weight: 950, packaging: 'none' as const, defaultSizes: '', defaultColors: 'Black, Brown' },
  { label: 'Sac à dos', weight: 800, packaging: 'none' as const, defaultSizes: '', defaultColors: 'Black' },
  { label: 'Sneakers', weight: 1100, packaging: 'without_box' as const, defaultSizes: '39, 40, 41, 42, 43, 44, 45', defaultColors: 'Black, White' },
  { label: 'Sneakers + boîte', weight: 1600, packaging: 'with_box' as const, defaultSizes: '39, 40, 41, 42, 43, 44, 45', defaultColors: 'Black, White' },
  { label: 'Claquettes', weight: 500, packaging: 'none' as const, defaultSizes: '39, 40, 41, 42, 43, 44, 45', defaultColors: 'Black' },
  { label: 'Chaussures', weight: 1000, packaging: 'none' as const, defaultSizes: '39, 40, 41, 42, 43, 44, 45', defaultColors: 'Black' },
  { label: 'Montre', weight: 200, packaging: 'with_box' as const, defaultSizes: '', defaultColors: '' },
  { label: 'Portefeuille', weight: 250, packaging: 'none' as const, defaultSizes: '', defaultColors: 'Black, Brown' },
  { label: 'Écharpe', weight: 300, packaging: 'none' as const, defaultSizes: '', defaultColors: 'Black, Grey' },
  { label: 'Parfum', weight: 400, packaging: 'with_box' as const, defaultSizes: '', defaultColors: '' },
];

// packagingLabels removed — no longer used in quick form

const initialProducts: Product[] = [
  {
    id: 'p1',
    brand: 'Nike x Off-White',
    name: 'Air Force 1 Low',
    category: 'Sneakers',
    gender: 'mixte',
    salePrice: 320,
    sourcePriceCny: 260,
    weightGrams: 1200,
    packaging: 'without_box',
    sizes: '39, 40, 41, 42, 43, 44, 45',
    colors: 'Black, White',
    imageUrl: '',
    sourceUrl: 'https://detail.1688.com/offer/EXEMPLE-AF1.html',
    status: 'active',
  },
  {
    id: 'p2',
    brand: 'Gucci',
    name: 'T-shirt Logo Brode',
    category: 'T-shirt',
    gender: 'mixte',
    salePrice: 490,
    sourcePriceCny: 120,
    weightGrams: 450,
    packaging: 'none',
    sizes: 'S, M, L, XL',
    colors: 'Black, White, Beige',
    imageUrl: '',
    sourceUrl: 'https://detail.1688.com/offer/EXEMPLE-GUCCI-TEE.html',
    status: 'active',
  },
  {
    id: 'p3',
    brand: 'Louis Vuitton',
    name: 'Hoodie Monogram',
    category: 'Hoodie / pull',
    gender: 'mixte',
    salePrice: 1250,
    sourcePriceCny: 280,
    weightGrams: 900,
    packaging: 'none',
    sizes: 'S, M, L, XL, XXL',
    colors: 'Black, Brown',
    imageUrl: '',
    sourceUrl: 'https://detail.1688.com/offer/EXEMPLE-LV-HOODIE.html',
    status: 'active',
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
    sale_price: p.salePrice, source_price_cny: p.sourcePriceCny,
    weight_grams: p.weightGrams, packaging: p.packaging,
    sizes: p.sizes, colors: p.colors, image_url: p.imageUrl || '',
    source_url: p.sourceUrl, status: p.status,
  };
}

function dbToProduct(d: DbProduct): Product {
  return {
    id: d.id, brand: d.brand, name: d.name, category: d.category, gender: (d.gender || 'mixte') as Product['gender'],
    salePrice: d.sale_price, sourcePriceCny: d.source_price_cny,
    weightGrams: d.weight_grams, packaging: d.packaging as Product['packaging'],
    sizes: d.sizes, colors: d.colors, imageUrl: d.image_url || '',
    sourceUrl: d.source_url, status: d.status as Product['status'],
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
  const kg = Math.max(weightGrams / 1000, 0.3);
  const rates = {
    economy: { base: 6.5, perKg: 10, label: 'Economy line' },
    tax_free: { base: 9.5, perKg: 13, label: 'Tax Free / Tariffless' },
    express: { base: 13, perKg: 18, label: 'Express' },
  };
  const rate = rates[line];
  return {
    label: rate.label,
    low: rate.base + kg * rate.perKg,
    high: rate.base + kg * rate.perKg * 1.25,
  };
}

function normalizedProduct(product: Product): Product {
  const categoryExists = categoryPresets.some((preset) => preset.label === product.category);
  const fallbackCategory = product.category.toLowerCase().includes('sneaker')
    ? 'Sneakers'
    : product.name.toLowerCase().includes('hoodie') || product.name.toLowerCase().includes('pull')
      ? 'Hoodie / pull'
      : 'T-shirt';
  return {
    ...product,
    category: categoryExists ? product.category : fallbackCategory,
    packaging: product.packaging || 'none',
    sizes: product.sizes || '39, 40, 41, 42, 43, 44, 45',
    colors: product.colors || 'Black, White',
    imageUrl: product.imageUrl || '',
    gender: product.gender || 'mixte',
  };
}

function estimatePaymentFees(amount: number) {
  // Approximation PayPal/fees: percentage + fixed fee, adjustable later if needed.
  return amount * 0.045 + 0.35;
}

function roundPrice(value: number) {
  if (value <= 0) return 0;
  return Math.max(19, Math.ceil(value / 10) * 10 - 1);
}

function suggestedSalePrice(sourcePriceCny: number, weightGrams: number, packaging: Product['packaging'], targetMargin = 45) {
  const tempProduct: Product = {
    id: 'temp',
    brand: '',
    name: '',
    category: '',
    salePrice: 0,
    sourcePriceCny,
    weightGrams,
    packaging,
    sizes: '',
    colors: '',
    imageUrl: '',
    gender: 'mixte',
    sourceUrl: '',
    status: 'active',
  };
  const sourceCost = sourcePriceCny * CNY_TO_EUR;
  const shipping = estimateMulebuyShipping(effectiveWeight(tempProduct)).high * SHIPPING_SAFETY_MULTIPLIER;
  const raw = (sourceCost + shipping + 0.35 + targetMargin) / (1 - 0.045);
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
  const sourceCost = product.sourcePriceCny * CNY_TO_EUR * quantity;
  const revenue = product.salePrice * quantity;
  const fees = estimatePaymentFees(revenue);
  return {
    effectiveWeight: effective,
    shipping,
    shippingWithSafety,
    sourceCost,
    fees,
    net: revenue - sourceCost - shippingWithSafety - fees,
  };
}

function marginTone(margin: number) {
  if (margin >= 45) return 'bg-green-500/10 text-green-600';
  if (margin >= 20) return 'bg-orange-500/10 text-orange-600';
  return 'bg-red-500/10 text-red-600';
}

function marginLabel(margin: number) {
  if (margin >= 45) return 'OK';
  if (margin >= 20) return 'Moyen';
  return 'Danger';
}

function rootOrderId(id: string) {
  const match = id.match(/^TOF-\d+/);
  return match ? match[0] : id;
}

export default function AdminPanel() {
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
  const [chatMessages, setChatMessages] = useState<DbChatMessage[]>([]);
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [chatReply, setChatReply] = useState('');
  const [promoCodes, setPromoCodes] = useState<DbPromoCode[]>([]);
  const [newPromo, setNewPromo] = useState({ code: '', discount: 15, maxUses: 0, expiresIn: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftProduct, setDraftProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedEstimateProduct, setSelectedEstimateProduct] = useState(products[0]?.id || '');
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
  const defaultPreset = categoryPresets.find((preset) => preset.label === 'Sneakers') || categoryPresets[0];
  const [quickProduct, setQuickProduct] = useState<Omit<Product, 'id' | 'status'>>({
    brand: '',
    name: '',
    category: defaultPreset.label,
    salePrice: suggestedSalePrice(150, defaultPreset.weight, defaultPreset.packaging),
    sourcePriceCny: 150,
    weightGrams: defaultPreset.weight,
    packaging: defaultPreset.packaging,
    sizes: '39, 40, 41, 42, 43, 44, 45',
    colors: 'Black, White',
    imageUrl: '',
    gender: 'mixte',
    sourceUrl: '',
  });
  const [dropDraft, setDropDraft] = useState<FeaturedDropConfig>(defaultDrop);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({ ...defaultSettings });
  const [settingsSaved, setSettingsSaved] = useState(false);

  const totals = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        acc.stockValue += product.sourcePriceCny * CNY_TO_EUR;
        acc.avgMargin += estimateNetMargin(product).net;
        return acc;
      },
      { stockValue: 0, avgMargin: 0 }
    );
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

  useEffect(() => {
    const refresh = () => { loadAll(); };
    window.addEventListener('tof-orders-updated', refresh);
    window.addEventListener('tof-products-updated', refresh);

    const unsubOrders = subscribeToOrders(
      () => {
        fetchOrders().then((data) => setOrders(data.map(dbToOrder)));
        showToast('Nouvelle commande reçue !');
        playNewOrder();
      },
      () => {
        fetchOrders().then((data) => setOrders(data.map(dbToOrder)));
      }
    );
    const unsubProducts = subscribeToProducts(() => {
      fetchProducts().then((data) => setProducts(data.map(dbToProduct).map(normalizedProduct)));
    });

    const unsubChat = subscribeToChatMessages(() => {
      fetchConversations().then(setChatMessages);
      showToast('Nouveau message chat !');
    });

    return () => {
      window.removeEventListener('tof-orders-updated', refresh);
      window.removeEventListener('tof-products-updated', refresh);
      unsubOrders();
      unsubProducts();
      unsubChat();
    };
  }, [loadAll]);

  // ── Save helpers ──
  const saveProducts = async (next: Product[]) => {
    setProducts(next);
    for (const p of next) await upsertProduct(productToDb(p));
    showToast('Produit sauvegardé ✓');
  };

  const removeProduct = async (id: string) => {
    await dbDeleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    window.dispatchEvent(new CustomEvent('tof-products-updated'));
    showToast('Produit supprimé ✓');
    playDelete();
  };

  const saveOrderField = async (id: string, field: string, value: string) => {
    const dbField: Record<string, string> = { status: 'status', paymentStatus: 'payment_status', tracking: 'tracking' };
    await updateOrder(id, { [dbField[field] || field]: value });
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, [field]: value } : o));
  };

  const saveDrop = async () => {
    await dbSaveDrop(dropToDb(dropDraft));
    window.dispatchEvent(new CustomEvent('tof-drop-updated'));
    showToast('Drop de la semaine sauvegardé ✓');
  };

  const uploadDropImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDropDraft({ ...dropDraft, imageUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
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

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setDraftProduct({ ...product });
  };

  const saveEdit = () => {
    if (!draftProduct) return;
    saveProducts(products.map((product) => (product.id === draftProduct.id ? draftProduct : product)));
    setEditingId(null);
    setDraftProduct(null);
  };

  const addProduct = () => {
    const product: Product = {
      id: `p${Date.now()}`,
      brand: 'Nouvelle marque',
      name: 'Nouveau produit',
      category: 'Sneakers',
      gender: 'mixte',
      salePrice: 99,
      sourcePriceCny: 100,
      weightGrams: 800,
      packaging: 'without_box',
      sizes: '39, 40, 41, 42, 43, 44, 45',
      colors: 'Black, White',
      imageUrl: '',
      sourceUrl: 'https://detail.1688.com/offer/...',
      status: 'active',
    };
    saveProducts([product, ...products]);
    startEdit(product);
  };

  const addQuickProduct = () => {
    if (!quickProduct.brand || !quickProduct.name || !quickProduct.sourceUrl) return;
    const product: Product = {
      ...quickProduct,
      id: `p${Date.now()}`,
      status: 'active',
    };
    saveProducts([product, ...products]);
    setSelectedEstimateProduct(product.id);
    setNewOrder({ ...newOrder, productId: product.id });
    setQuickProduct({
      ...quickProduct,
      brand: '',
      name: '',
      sourceUrl: '',
      salePrice: suggestedSalePrice(quickProduct.sourcePriceCny, quickProduct.weightGrams, quickProduct.packaging),
    });
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
    const dbOrd = orderToDb(order);
    await dbInsertOrder(dbOrd);
    setOrders([order, ...orders]);
    setNewOrder({ ...newOrder, customerName: '', phone: '', address: '', city: '', zip: '', snapOrWhatsapp: '' });
    showToast('Commande créée ✓');
  };

  const fallbackProduct: Product = { id: '', brand: '-', name: '-', category: 'T-shirt', gender: 'mixte', salePrice: 0, sourcePriceCny: 0, weightGrams: 300, packaging: 'none', sizes: '', colors: '', imageUrl: '', sourceUrl: '', status: 'active' };
  const getProduct = (id: string) => products.find((product) => product.id === id) || products[0] || fallbackProduct;

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

    const lastOrderTime = orders.length > 0 && orders[0].id ? (() => {
      const match = orders.find((o) => o.status === 'to_order' || o.status === 'new');
      return match ? 'en attente' : 'toutes traitées';
    })() : 'aucune';

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const todayOrders = orders.filter((o) => {
      try {
        const dbOrder = orders.find((x) => x.id === o.id);
        if (!dbOrder) return false;
        return true;
      } catch { return false; }
    });

    const ordersToday = todayOrders.length;
    const revenueToday = todayOrders.reduce((s, o) => {
      if (o.items && o.items.length > 0) return s + o.items.reduce((si, i) => si + i.price * i.quantity, 0);
      const p = getProduct(o.productId);
      return s + p.salePrice * o.quantity;
    }, 0);

    const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
    const paidRevenue = paidOrders.reduce((s, o) => {
      if (o.items && o.items.length > 0) return s + o.items.reduce((si, i) => si + i.price * i.quantity, 0);
      const p = getProduct(o.productId);
      return s + p.salePrice * o.quantity;
    }, 0);

    const lastOrderAgo = (() => {
      if (orders.length === 0) return 'aucune commande';
      // Use created_at from raw order if available
      return 'voir Supabase';
    })();

    void today; void ordersToday; void revenueToday; void lastOrderAgo;

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
      lastOrderTime,
      riskyProducts,
      activeProducts: products.filter((product) => product.status === 'active').length,
      toProcess: statusCounts.new + statusCounts.to_order,
      inProgress: statusCounts.ordered + statusCounts.qc_received + statusCounts.shipped,
      done: statusCounts.done,
      ordersToday,
      revenueToday,
      paidRevenue,
      paidOrders: paidOrders.length,
      totalOrders: orders.length,
      conversionRate: orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0,
    };
  }, [orders, products]);

  const orderText = (order: Order) => {
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
  };

  const copyOrder = async (order: Order) => {
    await navigator.clipboard.writeText(orderText(order));
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 1800);
    showToast('Bloc Mulebuy copié ✓');
    playCopy();
  };

  const clientMessage = (order: Order, type: 'payment' | 'paid' | 'tracking' | 'delay') => {
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
      return `Salut ${order.customerName}, ta commande ${rootOrderId(order.id)} est bien réservée.\n\n${itemsText}\n\nTotal : ${totalAmount}\n\nPaiement PayPal : ${siteSettings.paypalUrl}\n\nEnvoie une capture ici quand c'est fait et je lance la commande.`;
    }
    if (type === 'paid') {
      return `Paiement reçu pour ta commande ${rootOrderId(order.id)}, merci.\nJe lance la commande et je te tiens au courant pour le QC / suivi.`;
    }
    if (type === 'tracking') {
      return `Ta commande ${rootOrderId(order.id)} est expédiée.\nTracking : ${order.tracking || '[COLLE LE TRACKING ICI]'}\n\nDélai estimé : 7-20 jours selon la ligne.`;
    }
    return `Petit update pour ta commande ${rootOrderId(order.id)} : il y a un léger délai côté traitement/livraison. Je suis dessus et je t'envoie les nouvelles infos dès que je les ai.`;
  };

  const copyClientMessage = async (order: Order, type: 'payment' | 'paid' | 'tracking' | 'delay') => {
    await navigator.clipboard.writeText(clientMessage(order, type));
    setCopiedId(`${order.id}-${type}`);
    setTimeout(() => setCopiedId(null), 1800);
    showToast('Message copié ✓');
    playCopy();
  };

  const whatsappLink = (order: Order, type: 'payment' | 'paid' | 'tracking' | 'delay') => {
    let phone = order.phone.replace(/[^0-9+]/g, '');
    // Convert French 0X to 33X
    if (phone.startsWith('0') && phone.length === 10) {
      phone = '33' + phone.slice(1);
    }
    phone = phone.replace(/^\+/, '');
    const text = encodeURIComponent(clientMessage(order, type));
    return `https://wa.me/${phone}?text=${text}`;
  };

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

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'orders', label: 'Commandes' },
            { id: 'products', label: 'Produits & liens' },
            { id: 'drop', label: 'Drop semaine' },
            { id: 'promos', label: 'Promos' },
            { id: 'settings', label: 'Réglages' },
            { id: 'chat', label: 'Chat' },
            { id: 'notes', label: 'Notes & idées' },
            { id: 'estimate', label: 'Estimation livraison' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`rounded-full px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id ? 'bg-accent text-white' : 'bg-white/5 text-white/45 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 text-white p-5">
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
              {/* Activité live */}
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
              {orders.map((order) => {
                const product = getProduct(order.productId);
                const margin = estimateNetMargin(product, order.quantity);
                return (
                  <div key={order.id} className="rounded-3xl bg-white text-dark p-5 shadow-xl shadow-black/10">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">{rootOrderId(order.id)}</span>
                          <span className="rounded-full bg-dark/5 px-3 py-1 text-xs font-semibold text-dark/45">
                            {statusLabels[order.status]}
                          </span>
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
                          onChange={(event) =>
                            saveOrderField(order.id, 'paymentStatus', event.target.value)
                          }
                          className="rounded-xl bg-bg px-3 py-2 text-xs font-semibold outline-none"
                        >
                          {Object.entries(paymentLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        <select
                          value={order.status}
                          onChange={(event) =>
                            saveOrderField(order.id, 'status', event.target.value)
                          }
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
                      <span className={`rounded-full px-3 py-1 font-bold ${marginTone(margin.net)}`}>
                        Marge {marginLabel(margin.net)} : {euro(margin.net)}
                      </span>
                      <span className="rounded-full bg-dark/5 px-3 py-1 text-dark/40">
                        Livraison securisee (+20%) : {euro(margin.shippingWithSafety)}
                      </span>
                      <span className="rounded-full bg-dark/5 px-3 py-1 text-dark/40">
                        Frais paiement : {euro(margin.fees)}
                      </span>
                      </div>

                    <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-2">
                      <input
                        value={order.tracking || ''}
                        onChange={(event) =>
                          saveOrderField(order.id, 'tracking', event.target.value)
                        }
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

                    <div className="flex flex-wrap gap-2 mt-5">
                      <button
                        onClick={() => copyOrder(order)}
                        className="inline-flex items-center gap-2 rounded-full bg-dark px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-accent transition-colors"
                      >
                        <Copy size={14} /> {copiedId === order.id ? 'Copie !' : 'Mulebuy'}
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
                      <a href={whatsappLink(order, 'paid')} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366]/10 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[#1cae54] hover:bg-[#25D366]/20 transition-colors">
                        WA paye
                      </a>
                      <a href={whatsappLink(order, 'delay')} target="_blank" rel="noreferrer" className="rounded-full bg-dark/5 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-dark/60 hover:bg-dark/10 transition-colors">
                        WA retard
                      </a>
                      <button onClick={() => copyClientMessage(order, 'payment')} className="rounded-full bg-dark/5 px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-dark/60 hover:bg-dark/10 transition-colors">
                        {copiedId === `${order.id}-payment` ? 'Copie !' : 'Copier'}
                      </button>
                    </div>
                  </div>
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
                <button onClick={addOrder} className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-light transition-colors">
                    Créer la commande
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="rounded-3xl bg-white text-dark overflow-hidden">
            <div className="flex items-center justify-between gap-4 p-5 border-b border-dark/5">
              <div>
                <h3 className="font-bold">Produits source</h3>
                <p className="text-sm text-dark/40">Ajout rapide : lien + prix source + categorie. Le reste est calcule pour toi.</p>
              </div>
              <button onClick={addProduct} className="inline-flex items-center gap-2 rounded-full bg-dark px-5 py-3 text-sm font-semibold text-white hover:bg-accent transition-colors">
                <Plus size={15} /> Produit
              </button>
            </div>

            <div className="p-4 sm:p-5 border-b border-dark/5 bg-bg/60">
              <h4 className="font-bold mb-1">Ajout rapide</h4>
              <p className="text-xs text-dark/40 mb-4">Remplis le minimum, le reste se calcule tout seul.</p>

              {/* Étape 1 : Essentiel */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <input value={quickProduct.brand} onChange={(e) => setQuickProduct({ ...quickProduct, brand: e.target.value })} placeholder="Marque *" className="rounded-xl bg-white px-4 py-3 text-sm outline-none border border-dark/5" />
                <input value={quickProduct.name} onChange={(e) => setQuickProduct({ ...quickProduct, name: e.target.value })} placeholder="Nom produit *" className="rounded-xl bg-white px-4 py-3 text-sm outline-none border border-dark/5 sm:col-span-2" />
              </div>

              {/* Étape 2 : Genre + Catégorie + Prix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-2">
                <select value={quickProduct.gender} onChange={(e) => setQuickProduct({ ...quickProduct, gender: e.target.value as Product['gender'] })} className="rounded-xl bg-white px-3 py-3 text-sm outline-none border border-dark/5">
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                  <option value="mixte">Mixte</option>
                </select>
                <select value={quickProduct.category} onChange={(e) => updateQuickPreset(e.target.value)} className="rounded-xl bg-white px-3 py-3 text-sm outline-none border border-dark/5">
                  {categoryPresets.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
                <input type="number" value={quickProduct.sourcePriceCny} onChange={(e) => {
                  const v = Number(e.target.value);
                  setQuickProduct({ ...quickProduct, sourcePriceCny: v, salePrice: suggestedSalePrice(v, quickProduct.weightGrams, quickProduct.packaging) });
                }} placeholder="Prix ¥ *" className="rounded-xl bg-white px-4 py-3 text-sm outline-none border border-dark/5" />
                <div className="flex gap-1.5">
                  <input type="number" value={quickProduct.salePrice} onChange={(e) => setQuickProduct({ ...quickProduct, salePrice: Number(e.target.value) })} placeholder="Prix €" className="rounded-xl bg-white px-4 py-3 text-sm outline-none border border-dark/5 flex-1 min-w-0" />
                  <button onClick={autoPriceQuickProduct} className="rounded-xl bg-accent text-white px-3 py-3 text-xs font-bold hover:bg-accent-light transition-colors flex-shrink-0">
                    Auto
                  </button>
                </div>
              </div>

              {/* Étape 3 : Tailles + Couleurs (pré-remplis par catégorie) */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2">
                <input value={quickProduct.sizes} onChange={(e) => setQuickProduct({ ...quickProduct, sizes: e.target.value })} placeholder="Tailles (auto selon catégorie)" className="rounded-xl bg-white px-4 py-3 text-sm outline-none border border-dark/5" />
                <input value={quickProduct.colors} onChange={(e) => setQuickProduct({ ...quickProduct, colors: e.target.value })} placeholder="Couleurs" className="rounded-xl bg-white px-4 py-3 text-sm outline-none border border-dark/5" />
              </div>

              {/* Étape 4 : Image + Lien */}
              <div className="grid grid-cols-[1fr_auto] gap-2 mt-2">
                <input value={quickProduct.sourceUrl} onChange={(e) => setQuickProduct({ ...quickProduct, sourceUrl: e.target.value })} placeholder="Lien 1688 / Taobao / Weidian *" className="rounded-xl bg-white px-4 py-3 text-sm outline-none border border-dark/5" />
                <label className="cursor-pointer rounded-xl bg-dark/10 px-4 py-3 text-sm font-bold text-dark/50 hover:bg-dark/20 transition-colors flex items-center gap-2">
                  📷
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setQuickProduct({ ...quickProduct, imageUrl: String(reader.result) });
                    reader.readAsDataURL(file);
                  }} />
                </label>
              </div>

              {quickProduct.imageUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img src={quickProduct.imageUrl} alt="" className="h-12 w-12 rounded-xl object-cover border border-dark/5" />
                  <button onClick={() => setQuickProduct({ ...quickProduct, imageUrl: '' })} className="text-xs text-red-500 font-bold">Retirer</button>
                </div>
              )}

              {/* Preview marge + bouton */}
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {(() => {
                  const preview: Product = { ...quickProduct, id: 'preview', status: 'active' };
                  const margin = estimateNetMargin(preview);
                  return (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full bg-white px-2.5 py-1 text-dark/40">{margin.effectiveWeight}g</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-dark/40">Livr. {euro(margin.shippingWithSafety)}</span>
                      <span className={`rounded-full px-2.5 py-1 font-bold ${marginTone(margin.net)}`}>Marge {euro(margin.net)}</span>
                    </div>
                  );
                })()}
                <button onClick={addQuickProduct} className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-accent-light transition-colors w-full sm:w-auto">
                  Ajouter au shop
                </button>
              </div>
            </div>

            <div className="divide-y divide-dark/5">
              {products.map((product) => {
                const isEditing = editingId === product.id && draftProduct;
                const current = isEditing ? draftProduct : product;
                const margin = estimateNetMargin(current);
                return (
                  <div key={product.id} className="p-5">
                    <div className="grid lg:grid-cols-[1fr_1.5fr_auto] gap-4 items-start">
                      <div className="space-y-2">
                        <input disabled={!isEditing} value={current.brand} onChange={(e) => setDraftProduct({ ...current, brand: e.target.value })} className="w-full rounded-xl bg-bg px-4 py-3 text-sm font-bold outline-none disabled:bg-transparent disabled:px-0" />
                        <input disabled={!isEditing} value={current.name} onChange={(e) => setDraftProduct({ ...current, name: e.target.value })} className="w-full rounded-xl bg-bg px-4 py-3 text-sm outline-none disabled:bg-transparent disabled:px-0 disabled:py-0 text-dark/60" />
                      </div>
                      <div className="space-y-3">
                        <input disabled={!isEditing} value={current.sourceUrl} onChange={(e) => setDraftProduct({ ...current, sourceUrl: e.target.value })} className="w-full rounded-xl bg-bg px-4 py-3 text-xs outline-none disabled:bg-bg text-dark/60" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                          <label className="text-xs text-dark/35">Genre<select disabled={!isEditing} value={current.gender || 'mixte'} onChange={(e) => setDraftProduct({ ...current, gender: e.target.value as Product['gender'] })} className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none"><option value="homme">Homme</option><option value="femme">Femme</option><option value="mixte">Mixte</option></select></label>
                          <label className="text-xs text-dark/35">Catégorie<select disabled={!isEditing} value={current.category} onChange={(e) => {
                            const preset = categoryPresets.find((item) => item.label === e.target.value);
                            setDraftProduct({
                              ...current,
                              category: e.target.value,
                              weightGrams: preset?.weight || current.weightGrams,
                              packaging: preset?.packaging || current.packaging,
                              sizes: preset?.defaultSizes ?? current.sizes,
                              colors: preset?.defaultColors ?? current.colors,
                            });
                          }} className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none">{categoryPresets.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}</select></label>
                          <label className="text-xs text-dark/35">Packaging<select disabled={!isEditing} value={current.packaging || 'none'} onChange={(e) => setDraftProduct({ ...current, packaging: e.target.value as Product['packaging'] })} className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none"><option value="none">Standard</option><option value="without_box">Sans boite</option><option value="with_box">Avec boite</option></select></label>
                          <label className="text-xs text-dark/35">Vente €<input disabled={!isEditing} type="number" value={current.salePrice} onChange={(e) => setDraftProduct({ ...current, salePrice: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none" /></label>
                          <label className="text-xs text-dark/35">Source CNY<input disabled={!isEditing} type="number" value={current.sourcePriceCny} onChange={(e) => setDraftProduct({ ...current, sourcePriceCny: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none" /></label>
                          <label className="text-xs text-dark/35">Poids g<input disabled={!isEditing} type="number" value={current.weightGrams} onChange={(e) => setDraftProduct({ ...current, weightGrams: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none" /></label>
                          <label className="text-xs text-dark/35">Statut<select disabled={!isEditing} value={current.status} onChange={(e) => setDraftProduct({ ...current, status: e.target.value as Product['status'] })} className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none"><option value="active">Actif</option><option value="link_dead">Lien saute</option><option value="paused">Pause</option></select></label>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <label className="text-xs text-dark/35">Tailles disponibles
                            <input disabled={!isEditing} value={current.sizes || ''} onChange={(e) => setDraftProduct({ ...current, sizes: e.target.value })} placeholder="39, 40, 41, 42, 43, 44, 45" className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none" />
                          </label>
                          <label className="text-xs text-dark/35">Couleurs disponibles
                            <input disabled={!isEditing} value={current.colors || ''} onChange={(e) => setDraftProduct({ ...current, colors: e.target.value })} placeholder="Black, White, Red" className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none" />
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-dark/35">Images (Séparez les URLs par un pipe | pour les coloris)
                              <textarea 
                                disabled={!isEditing} 
                                value={current.imageUrl || ''} 
                                onChange={(e) => setDraftProduct({ ...current, imageUrl: e.target.value })} 
                                placeholder="URL1 | URL2 | URL3..." 
                                className="mt-1 w-full rounded-xl bg-bg px-3 py-2 text-sm text-dark outline-none min-h-[80px]" 
                              />
                            </label>
                          </div>
                          {isEditing && (
                            <div className="flex flex-col gap-2">
                              <label className="cursor-pointer rounded-xl bg-dark px-4 py-2 text-xs font-bold text-white hover:bg-accent transition-colors text-center">
                                Upload
                                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length === 0) return;
                                  
                                  const readers = files.map(file => {
                                    return new Promise<string>((resolve) => {
                                      const reader = new FileReader();
                                      reader.onload = () => resolve(String(reader.result));
                                      reader.readAsDataURL(file);
                                    });
                                  });

                                  Promise.all(readers).then(results => {
                                    const currentImages = current.imageUrl ? current.imageUrl.split('|').map(s => s.trim()).filter(Boolean) : [];
                                    const nextImages = [...currentImages, ...results].join('|');
                                    setDraftProduct({ ...current, imageUrl: nextImages });
                                  });
                                }} />
                              </label>
                              <button 
                                type="button"
                                onClick={() => setDraftProduct({ ...current, imageUrl: '' })}
                                className="rounded-xl bg-red-500/10 px-4 py-2 text-[10px] font-bold text-red-500 hover:bg-red-500/20 transition-colors"
                              >
                                Vider
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {current.imageUrl && (
                          <div className="mt-3">
                            <p className="text-[10px] font-bold text-dark/30 uppercase mb-2">Correspondance photos / coloris</p>
                            <div className="flex flex-wrap gap-3">
                              {current.imageUrl.split('|').map((url, idx) => {
                                const trimmedUrl = url.trim();
                                if (!trimmedUrl) return null;
                                const colorNames = current.colors ? current.colors.split(',').map(s => s.trim()) : [];
                                const colorName = colorNames[idx] || `Photo ${idx + 1}`;
                                
                                return (
                                  <div key={idx} className="relative group/img flex flex-col items-center gap-1">
                                    <div className="relative">
                                      <img src={trimmedUrl} alt="" className="h-16 w-16 rounded-xl object-contain bg-subtle border border-dark/10" />
                                      {isEditing && (
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            const urls = current.imageUrl.split('|').map(s => s.trim()).filter(Boolean);
                                            urls.splice(idx, 1);
                                            setDraftProduct({ ...current, imageUrl: urls.join('|') });
                                          }}
                                          className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 shadow-sm"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                    <span className="text-[9px] font-bold text-dark/40 uppercase truncate max-w-[64px]">{colorName}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-dark/5 px-3 py-1 text-dark/45">Poids retenu {margin.effectiveWeight}g</span>
                          <span className="rounded-full bg-dark/5 px-3 py-1 text-dark/45">Livraison {euro(margin.shipping.low)} - {euro(margin.shipping.high)}</span>
                          <span className="rounded-full bg-dark/5 px-3 py-1 text-dark/45">Securite +20% {euro(margin.shippingWithSafety)}</span>
                          <span className={`rounded-full px-3 py-1 font-bold ${marginTone(margin.net)}`}>Marge nette {marginLabel(margin.net)} : {euro(margin.net)}</span>
                        </div>
                      </div>
                      <div className="flex lg:flex-col gap-2">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"><Save size={14} /> Save</button>
                            <button
                              onClick={() => setDraftProduct({
                                ...current,
                                salePrice: suggestedSalePrice(current.sourcePriceCny, current.weightGrams, current.packaging),
                              })}
                              className="inline-flex items-center gap-2 rounded-full bg-dark/5 px-4 py-2 text-sm font-semibold text-dark/60"
                            >
                              Prix auto
                            </button>
                          </>
                        ) : (
                          <button onClick={() => startEdit(product)} className="inline-flex items-center gap-2 rounded-full bg-dark px-4 py-2 text-sm font-semibold text-white"><Pencil size={14} /> Edit</button>
                        )}
                        <a href={current.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-dark/5 px-4 py-2 text-sm font-semibold text-dark/60"><ExternalLink size={14} /> Ouvrir</a>
                        <button onClick={() => { if (confirm('Supprimer ce produit ?')) removeProduct(product.id); }} className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/20 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-light transition-colors"
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
                  <label className="text-xs text-dark/35">Photo du drop</label>
                  <div className="mt-2 grid sm:grid-cols-[1fr_auto] gap-3">
                    <input
                      value={dropDraft.imageUrl}
                      onChange={(e) => setDropDraft({ ...dropDraft, imageUrl: e.target.value })}
                      placeholder="URL image, /images/drop.jpg, ou upload ci-dessous"
                      className="w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5"
                    />
                    <label className="cursor-pointer rounded-xl bg-dark px-5 py-3 text-center text-sm font-bold text-white hover:bg-accent transition-colors">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => uploadDropImage(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setDropDraft({ ...dropDraft, imageUrl: '' })}
                      className="rounded-full bg-white px-3 py-1 font-semibold text-dark/45 hover:text-accent transition-colors"
                    >
                      Retirer la photo
                    </button>
                    <span className="text-dark/35 py-1">L'image est sauvegardee dans ton navigateur apres clic sur Sauvegarder.</span>
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
                    <img src={dropDraft.imageUrl} alt="Preview drop" className="h-full w-full object-cover" />
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
            {/* Liste des codes */}
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

            {/* Créer un code */}
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
              }} className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-light transition-colors">
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
          <div className="grid lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 rounded-3xl bg-white text-dark p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-bold text-xl">Reglages vitrine, paiement & reseaux</h3>
                  <p className="text-sm text-dark/40 mt-1">
                    Mets tes liens une fois ici. Ils se mettent ensuite partout sur le site.
                  </p>
                </div>
                <button
                  onClick={saveSettings}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-light transition-colors"
                >
                  <Save size={15} /> {settingsSaved ? 'Sauvegarde' : 'Sauvegarder'}
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-bg p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-bold text-sm">Barre d'annonce</h4>
                      <p className="text-xs text-dark/35">Message tout en haut du site.</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-dark/45">
                      <input
                        type="checkbox"
                        checked={siteSettings.announcementEnabled}
                        onChange={(e) => setSiteSettings({ ...siteSettings, announcementEnabled: e.target.checked })}
                      />
                      Activee
                    </label>
                  </div>
                  <input
                    value={siteSettings.announcementText}
                    onChange={(e) => setSiteSettings({ ...siteSettings, announcementText: e.target.value })}
                    className="w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5"
                  />
                </div>

                <div className="rounded-2xl bg-bg p-4">
                  <h4 className="font-bold text-sm mb-3">Hero principal</h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="text-xs text-dark/35">Badge
                      <input value={siteSettings.heroBadge} onChange={(e) => setSiteSettings({ ...siteSettings, heroBadge: e.target.value })} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5" />
                    </label>
                    <label className="text-xs text-dark/35">Badge flottant
                      <input value={siteSettings.heroTopBadge} onChange={(e) => setSiteSettings({ ...siteSettings, heroTopBadge: e.target.value })} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5" />
                    </label>
                    <label className="text-xs text-dark/35">Titre debut
                      <input value={siteSettings.heroTitleStart} onChange={(e) => setSiteSettings({ ...siteSettings, heroTitleStart: e.target.value })} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5" />
                    </label>
                    <label className="text-xs text-dark/35">Titre souligne
                      <input value={siteSettings.heroTitleHighlight} onChange={(e) => setSiteSettings({ ...siteSettings, heroTitleHighlight: e.target.value })} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5" />
                    </label>
                    <label className="text-xs text-dark/35 sm:col-span-2">Description
                      <textarea value={siteSettings.heroDescription} onChange={(e) => setSiteSettings({ ...siteSettings, heroDescription: e.target.value })} rows={2} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5 resize-none" />
                    </label>
                    <label className="text-xs text-dark/35 sm:col-span-2">Note sous description
                      <input value={siteSettings.heroSubnote} onChange={(e) => setSiteSettings({ ...siteSettings, heroSubnote: e.target.value })} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5" />
                    </label>
                    <label className="text-xs text-dark/35">Stat flottante
                      <input value={siteSettings.heroStatValue} onChange={(e) => setSiteSettings({ ...siteSettings, heroStatValue: e.target.value })} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5" />
                    </label>
                    <label className="text-xs text-dark/35">Label stat
                      <input value={siteSettings.heroStatLabel} onChange={(e) => setSiteSettings({ ...siteSettings, heroStatLabel: e.target.value })} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5" />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl bg-bg p-4">
                  <h4 className="font-bold text-sm mb-3">Bloc Snap / WhatsApp</h4>
                  <div className="space-y-3">
                    <label className="block text-xs text-dark/35">Titre CTA
                      <input value={siteSettings.ctaTitle} onChange={(e) => setSiteSettings({ ...siteSettings, ctaTitle: e.target.value })} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5" />
                    </label>
                    <label className="block text-xs text-dark/35">Description CTA
                      <textarea value={siteSettings.ctaDescription} onChange={(e) => setSiteSettings({ ...siteSettings, ctaDescription: e.target.value })} rows={2} className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-dark outline-none border border-dark/5 resize-none" />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl bg-bg p-4 space-y-4">
                  <h4 className="font-bold text-sm">Livraison</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-dark/70">Livraison offerte sur tout</div>
                      <div className="text-xs text-dark/35">Active ça pour l'offre d'ouverture. Désactive quand l'offre est finie.</div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={siteSettings.freeShipping}
                        onChange={(e) => setSiteSettings({ ...siteSettings, freeShipping: e.target.checked })}
                        className="h-5 w-5"
                      />
                    </label>
                  </div>
                  {!siteSettings.freeShipping && (
                    <div className="grid grid-cols-3 gap-3">
                      <label className="text-xs text-dark/35">Gratuit dès €
                        <input type="number" value={siteSettings.freeShippingThreshold} onChange={(e) => setSiteSettings({ ...siteSettings, freeShippingThreshold: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-sm text-dark outline-none border border-dark/5" />
                      </label>
                      <label className="text-xs text-dark/35">Standard €
                        <input type="number" value={siteSettings.standardShippingFee} onChange={(e) => setSiteSettings({ ...siteSettings, standardShippingFee: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-sm text-dark outline-none border border-dark/5" />
                      </label>
                      <label className="text-xs text-dark/35">Express €
                        <input type="number" value={siteSettings.expressShippingFee} onChange={(e) => setSiteSettings({ ...siteSettings, expressShippingFee: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-white px-3 py-2.5 text-sm text-dark outline-none border border-dark/5" />
                      </label>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-bg p-4 space-y-4">
                  <h4 className="font-bold text-sm">Liens & paiement</h4>
                <label className="block text-xs text-dark/35">Lien WhatsApp
                  <input
                    value={siteSettings.whatsappUrl}
                    onChange={(e) => setSiteSettings({ ...siteSettings, whatsappUrl: e.target.value })}
                    placeholder="https://wa.me/33..."
                    className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none"
                  />
                </label>
                <label className="block text-xs text-dark/35">Lien Snapchat
                  <input
                    value={siteSettings.snapchatUrl}
                    onChange={(e) => setSiteSettings({ ...siteSettings, snapchatUrl: e.target.value })}
                    placeholder="https://www.snapchat.com/add/tonpseudo"
                    className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none"
                  />
                </label>
                <label className="block text-xs text-dark/35">Lien PayPal
                  <input
                    value={siteSettings.paypalUrl}
                    onChange={(e) => setSiteSettings({ ...siteSettings, paypalUrl: e.target.value })}
                    placeholder="https://paypal.me/tonpseudo"
                    className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none"
                  />
                </label>
                <label className="block text-xs text-dark/35">Texte paiement
                  <textarea
                    value={siteSettings.paymentText}
                    onChange={(e) => setSiteSettings({ ...siteSettings, paymentText: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-xl bg-bg px-4 py-3 text-sm text-dark outline-none resize-none"
                  />
                </label>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-3xl bg-white/5 border border-white/10 p-6 text-white">
              <h3 className="font-bold text-xl mb-4">Utilisation</h3>
              <div className="space-y-3 text-sm text-white/45 leading-relaxed">
                <p>WhatsApp alimente les boutons contact, CTA et la barre mobile.</p>
                <p>Snap alimente les boutons Snapchat du site.</p>
                <p>PayPal est garde ici pour tes messages de paiement et ton organisation.</p>
              </div>
              <div className="mt-5 space-y-2 text-xs">
                <a href={siteSettings.whatsappUrl} className="block rounded-xl bg-[#25D366]/10 px-4 py-3 font-bold text-[#25D366]">Tester WhatsApp →</a>
                <a href={siteSettings.snapchatUrl} className="block rounded-xl bg-[#FFFC00]/10 px-4 py-3 font-bold text-[#FFFC00]">Tester Snap →</a>
                <a href={siteSettings.paypalUrl} className="block rounded-xl bg-white/5 px-4 py-3 font-bold text-white/55">Tester PayPal →</a>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (() => {
          const convos = new Map<string, { name: string; messages: DbChatMessage[]; lastMsg: DbChatMessage }>();
          chatMessages.forEach((m) => {
            const existing = convos.get(m.conversation_id);
            if (existing) {
              existing.messages.push(m);
              existing.lastMsg = m;
            } else {
              convos.set(m.conversation_id, { name: m.client_name || 'Anonyme', messages: [m], lastMsg: m });
            }
          });
          const convoList = Array.from(convos.entries()).sort((a, b) => (b[1].lastMsg.created_at || '').localeCompare(a[1].lastMsg.created_at || ''));
          const activeMessages = activeConvo ? convos.get(activeConvo)?.messages || [] : [];

          const sendAdminReply = async () => {
            if (!chatReply.trim() || !activeConvo) return;
            const convo = convos.get(activeConvo);
            const msg: DbChatMessage = {
              id: `m-admin-${Date.now()}`,
              conversation_id: activeConvo,
              sender: 'admin',
              message: chatReply.trim(),
              client_name: convo?.name || '',
            };
            await sendChatMessage(msg);
            setChatMessages((prev) => [...prev, msg]);
            setChatReply('');
            showToast('Réponse envoyée ✓');
          };

          return (
            <div className="grid lg:grid-cols-3 gap-5" style={{ minHeight: 500 }}>
              {/* Liste conversations */}
              <div className="rounded-3xl bg-white text-dark overflow-hidden">
                <div className="p-4 border-b border-dark/5">
                  <h3 className="font-bold">Conversations ({convoList.length})</h3>
                </div>
                <div className="divide-y divide-dark/5 max-h-[500px] overflow-y-auto">
                  {convoList.length === 0 && (
                    <div className="p-6 text-center text-sm text-dark/30">Aucune conversation pour l'instant.</div>
                  )}
                  {convoList.map(([id, convo]) => {
                    const unread = convo.messages.filter((m) => m.sender === 'client').length;
                    return (
                      <button
                        key={id}
                        onClick={() => setActiveConvo(id)}
                        className={`w-full text-left p-4 hover:bg-bg transition-colors ${activeConvo === id ? 'bg-bg' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {convo.name[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm truncate">{convo.name}</div>
                              <div className="text-xs text-dark/40 truncate">{convo.lastMsg.message}</div>
                            </div>
                          </div>
                          {unread > 0 && (
                            <span className="h-5 min-w-5 bg-accent rounded-full text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0 px-1">{unread}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Messages conversation */}
              <div className="lg:col-span-2 rounded-3xl bg-white text-dark flex flex-col overflow-hidden" style={{ minHeight: 500 }}>
                {!activeConvo ? (
                  <div className="flex-1 flex items-center justify-center text-dark/30 text-sm">
                    Sélectionne une conversation
                  </div>
                ) : (
                  <>
                    <div className="p-4 border-b border-dark/5 flex items-center justify-between gap-2">
                      <div className="font-bold">{convos.get(activeConvo)?.name}</div>
                      <div className="flex items-center gap-2">
                        <button onClick={async () => {
                          if (confirm('Supprimer cette conversation ?')) {
                            await deleteConversation(activeConvo);
                            setChatMessages((prev) => prev.filter((m) => m.conversation_id !== activeConvo));
                            setActiveConvo(null);
                            showToast('Conversation supprimée ✓');
                          }
                        }} className="text-xs text-red-400 hover:text-red-500 font-bold">Supprimer</button>
                        <button onClick={() => setActiveConvo(null)} className="text-xs text-dark/30 hover:text-dark lg:hidden">Retour</button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {activeMessages.map((msg) => (
                        <div key={msg.id} className={`group/msg flex ${msg.sender === 'client' ? 'justify-start' : 'justify-end'}`}>
                          <div className="relative">
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              msg.sender === 'client' ? 'bg-bg text-dark rounded-bl-sm' :
                              msg.sender === 'admin' ? 'bg-accent text-white rounded-br-sm' :
                              'bg-dark/5 text-dark/60 rounded-bl-sm'
                            }`}>
                              {msg.sender === 'bot' && <div className="text-[10px] font-bold text-dark/30 mb-1">Bot</div>}
                              {msg.sender === 'admin' && <div className="text-[10px] font-bold text-white/60 mb-1">Toi</div>}
                              <p className="whitespace-pre-wrap">{msg.message}</p>
                              {msg.created_at && (
                                <div className={`text-[10px] mt-1 ${msg.sender === 'client' ? 'text-dark/20' : msg.sender === 'admin' ? 'text-white/40' : 'text-dark/20'}`}>
                                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={async () => {
                                await deleteChatMessage(msg.id);
                                setChatMessages((prev) => prev.filter((m) => m.id !== msg.id));
                              }}
                              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] items-center justify-center hidden group-hover/msg:flex"
                            >✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-dark/5 p-3 flex gap-2">
                      <input
                        value={chatReply}
                        onChange={(e) => setChatReply(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendAdminReply()}
                        placeholder="Répondre..."
                        className="flex-1 rounded-xl bg-bg px-4 py-3 text-sm outline-none"
                      />
                      <button onClick={sendAdminReply} disabled={!chatReply.trim()} className="h-11 w-11 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent-light transition-colors disabled:opacity-30">
                        <Send size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {activeTab === 'notes' && (
          <div className="space-y-5">
            {/* Barre de progression */}
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

            {/* Stats + actions */}
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
              {/* Liste des notes */}
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

              {/* Formulaire ajout */}
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
                  className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-light transition-colors"
                >
                  Ajouter
                </button>

                <div className="border-t border-white/5 pt-4 mt-4">
                  <h4 className="font-bold text-white/60 text-sm mb-3">Suggestions rapides</h4>
                  <div className="space-y-2">
                    {[
                      'Ajouter mes vrais produits avec liens 1688',
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

        {activeTab === 'estimate' && (
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="rounded-3xl bg-white text-dark p-6">
              <h3 className="font-bold text-xl flex items-center gap-2"><Truck size={20} /> Estimation Mulebuy</h3>
              <p className="text-sm text-dark/40 mt-2">Ce n'est pas un tarif officiel, mais une estimation pour te donner une marge avant de commander.</p>
              {products.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-bg p-6 text-center text-sm text-dark/40">Ajoute un produit d'abord pour estimer la livraison.</div>
              ) : (
              <>
              <select
                value={selectedEstimateProduct}
                onChange={(event) => setSelectedEstimateProduct(event.target.value)}
                className="mt-5 w-full rounded-2xl bg-bg px-5 py-4 text-sm font-semibold outline-none"
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.brand} - {product.name}</option>
                ))}
              </select>
              {(() => {
                const product = getProduct(selectedEstimateProduct);
                const margin = estimateNetMargin(product);
                return (
                  <>
                    <div className="grid sm:grid-cols-3 gap-3 mt-5">
                      {(['economy', 'tax_free', 'express'] as const).map((line) => {
                        const estimate = estimateMulebuyShipping(effectiveWeight(product), line);
                        return (
                          <div key={line} className="rounded-2xl bg-bg p-4">
                            <div className="text-xs text-dark/35">{estimate.label}</div>
                            <div className="font-800 text-lg mt-2">{euro(estimate.low)}</div>
                            <div className="text-xs text-dark/35">a {euro(estimate.high)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 rounded-2xl bg-bg p-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-dark/45">Poids retenu {margin.effectiveWeight}g</span>
                        <span className="rounded-full bg-white px-3 py-1 text-dark/45">Frais paiement {euro(margin.fees)}</span>
                        <span className={`rounded-full px-3 py-1 font-bold ${marginTone(margin.net)}`}>Marge apres livraison {euro(margin.net)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
              </>
              )}
            </div>
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6">
              <h3 className="font-bold text-xl flex items-center gap-2"><Package size={20} /> Comment l'utiliser</h3>
              <div className="space-y-4 mt-5 text-sm text-white/45 leading-relaxed">
                <p>1. Tu mets le vrai prix source en CNY et le poids estime du produit.</p>
                <p>2. Le panel estime la livraison Mulebuy avec une fourchette basse/haute.</p>
                <p>3. Quand une commande arrive, tu copies le bloc Mulebuy et tu commandes en verifiant les infos.</p>
                <p>4. Si un lien saute, tu passes le produit en "Lien saute" ou tu colles un nouveau lien source.</p>
              </div>
              <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4">
                <h4 className="font-bold text-sm mb-3">Poids par defaut</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-white/45">
                  {categoryPresets.map((preset) => (
                    <div key={preset.label} className="flex justify-between gap-3 border-b border-white/5 pb-1">
                      <span>{preset.label}</span>
                      <span className="text-white/70">{preset.weight}g</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}