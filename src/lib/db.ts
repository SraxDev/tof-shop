import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────

export type DbProduct = {
  id: string;
  brand: string;
  name: string;
  category: string;
  sale_price: number;
  source_price_cny: number;
  weight_grams: number;
  packaging: string;
  sizes: string;
  colors: string;
  source_url: string;
  status: string;
  created_at?: string;
};

export type DbOrderItem = {
  productId: string;
  brand: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
};

export type DbOrder = {
  id: string;
  product_id: string;
  size: string;
  color: string;
  quantity: number;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  country: string;
  snap_or_whatsapp: string;
  status: string;
  payment_status: string;
  tracking: string | null;
  items_json?: string;
  created_at?: string;
};

export type DbSettings = Record<string, unknown>;

export type DbDrop = {
  id?: number;
  badge: string;
  eyebrow: string;
  brand: string;
  name: string;
  description: string;
  price: number;
  old_price: number;
  discount: string;
  sizes: string;
  image_url: string;
};

// ─── Products ────────────────────────────────────────────

export async function fetchProducts(): Promise<DbProduct[]> {
  const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  return (data as DbProduct[]) || [];
}

export async function upsertProduct(product: DbProduct) {
  await supabase.from('products').upsert(product);
  window.dispatchEvent(new CustomEvent('tof-products-updated'));
}

export async function upsertProducts(products: DbProduct[]) {
  await supabase.from('products').upsert(products);
  window.dispatchEvent(new CustomEvent('tof-products-updated'));
}

export async function deleteProduct(id: string) {
  await supabase.from('products').delete().eq('id', id);
  window.dispatchEvent(new CustomEvent('tof-products-updated'));
}

// ─── Orders ──────────────────────────────────────────────

export async function fetchOrders(): Promise<DbOrder[]> {
  const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  return (data as DbOrder[]) || [];
}

export async function insertOrder(order: DbOrder) {
  await supabase.from('orders').insert(order);
  window.dispatchEvent(new CustomEvent('tof-orders-updated'));
}

export async function updateOrder(id: string, fields: Partial<DbOrder>) {
  await supabase.from('orders').update(fields).eq('id', id);
  window.dispatchEvent(new CustomEvent('tof-orders-updated'));
}

// ─── Settings ────────────────────────────────────────────

export async function fetchSettings(): Promise<DbSettings> {
  const { data } = await supabase.from('settings').select('*').eq('key', 'site').single();
  return (data?.value as DbSettings) || {};
}

export async function saveSettings(value: DbSettings) {
  await supabase.from('settings').upsert({ key: 'site', value });
  window.dispatchEvent(new CustomEvent('tof-settings-updated'));
}

// ─── Notes ───────────────────────────────────────────────

export type DbNote = {
  id: string;
  text: string;
  category: string;
  done: boolean;
  priority: number;
  created_at?: string;
};

export async function fetchNotes(): Promise<DbNote[]> {
  const { data } = await supabase.from('notes').select('*').order('priority', { ascending: true }).order('created_at', { ascending: false });
  return (data as DbNote[]) || [];
}

export async function upsertNote(note: DbNote) {
  await supabase.from('notes').upsert(note);
}

export async function deleteNote(id: string) {
  await supabase.from('notes').delete().eq('id', id);
}

// ─── Drop ────────────────────────────────────────────────

export async function fetchDrop(): Promise<DbDrop | null> {
  const { data } = await supabase.from('featured_drop').select('*').eq('id', 1).single();
  return data as DbDrop | null;
}

export async function saveDrop(drop: DbDrop) {
  await supabase.from('featured_drop').upsert({ ...drop, id: 1 });
  window.dispatchEvent(new CustomEvent('tof-drop-updated'));
}

// ─── Realtime ────────────────────────────────────────────

export function subscribeToOrders(callback: () => void) {
  const channel = supabase
    .channel('orders-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
      callback();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export function subscribeToProducts(callback: () => void) {
  const channel = supabase
    .channel('products-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
      callback();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
