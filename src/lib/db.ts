import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────

export type DbProduct = {
  id: string;
  brand: string;
  name: string;
  category: string;
  gender: string;
  sale_price: number;
  old_price?: number | null;
  source_price_cny: number;
  weight_grams: number;
  packaging: string;
  sizes: string;
  colors: string;
  image_url: string;
  source_url: string;
  status: string;
  created_at?: string;
  /** Description libre affichée sur la fiche produit (facultatif). */
  description?: string | null;
  /** Conseil de taille, ex. « Taille normalement ». */
  size_advice?: string | null;
  /** Contenu du colis, ex. « Paire + boîte + dustbag ». */
  box_content?: string | null;
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
  qc_photos?: string | null;
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
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) {
    // Fallback: try without ordering by created_at in case column doesn't exist (legacy DBs)
    if (/created_at|column/i.test(error.message)) {
      const { data: fallback, error: err2 } = await supabase.from('products').select('*');
      if (err2) { console.error('fetchProducts failed:', err2); return []; }
      return (fallback as DbProduct[]) || [];
    }
    console.error('fetchProducts failed:', error);
    return [];
  }
  return (data as DbProduct[]) || [];
}

/** Champs ajoutés par supabase/08-description-produit.sql. */
const OPTIONAL_PRODUCT_FIELDS = ['description', 'size_advice', 'box_content'] as const;

/** Vrai si PostgREST se plaint d'une colonne absente (SQL 08 pas encore lancé). */
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  return OPTIONAL_PRODUCT_FIELDS.some((f) => error.message?.includes(f));
}

function withoutOptionalFields<T extends object>(row: T): T {
  const copy = { ...row } as Record<string, unknown>;
  OPTIONAL_PRODUCT_FIELDS.forEach((f) => delete copy[f]);
  return copy as T;
}

/**
 * Enregistre un produit.
 *
 * Si la migration 08 n'a pas encore été exécutée, les colonnes description /
 * size_advice / box_content n'existent pas et PostgREST rejette la requête.
 * Plutôt que de faire échouer la sauvegarde (et de faire perdre son travail à
 * l'admin), on réessaie sans ces champs facultatifs.
 */
export async function upsertProduct(product: DbProduct) {
  const { error } = await supabase.from('products').upsert(product);
  if (isMissingColumnError(error)) {
    await supabase.from('products').upsert(withoutOptionalFields(product));
  }
  window.dispatchEvent(new CustomEvent('tof-products-updated'));
}

export async function upsertProducts(products: DbProduct[]) {
  const { error } = await supabase.from('products').upsert(products);
  if (isMissingColumnError(error)) {
    await supabase.from('products').upsert(products.map(withoutOptionalFields));
  }
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

/**
 * Suivi public d'une commande via la fonction RPC `track_order`.
 * Ne renvoie QUE le statut : aucune donnée personnelle n'est exposée.
 * (voir supabase/01-securite-rls.sql)
 */
export type TrackedOrder = {
  id: string;
  status: string;
  payment_status: string;
  tracking: string | null;
  created_at?: string;
  items_json?: string;
  city_hint?: string | null;
  qc_photos?: string | null;
};

export async function fetchOrderById(orderId: string): Promise<TrackedOrder | null> {
  const clean = orderId.trim().toUpperCase();
  if (!clean) return null;
  const withPrefix = clean.startsWith('TOF-')
    ? clean
    : `TOF-${clean.replace(/^TOF/i, '').replace(/^-/, '')}`;

  const { data, error } = await supabase.rpc('track_order', { order_id: withPrefix });
  if (error) {
    console.error('track_order failed:', error.message);
    return null;
  }
  const rows = (data as TrackedOrder[]) || [];
  return rows[0] || null;
}

/**
 * Dernières commandes anonymisées pour la preuve sociale (prénom + ville).
 * Passe par la RPC `recent_orders_public` : ni téléphone ni adresse.
 */
export type PublicRecentOrder = {
  first_name: string;
  city: string | null;
  items_json?: string;
  created_at?: string;
};

export async function fetchRecentOrders(limit = 20): Promise<PublicRecentOrder[]> {
  const { data, error } = await supabase.rpc('recent_orders_public', { max_rows: limit });
  if (error) {
    // La fonction n'existe pas tant que supabase/01-securite-rls.sql n'a pas été exécuté.
    if (import.meta.env.DEV) console.warn('recent_orders_public indisponible — exécute supabase/01-securite-rls.sql');
    return [];
  }
  return (data as PublicRecentOrder[]) || [];
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

// ─── Promo codes ─────────────────────────────────────────

export type DbPromoCode = {
  id: string;
  code: string;
  discount_percent: number;
  active: boolean;
  uses: number;
  max_uses: number;
  expires_at: string | null;
  created_at?: string;
};

export async function fetchPromoCodes(): Promise<DbPromoCode[]> {
  const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
  return (data as DbPromoCode[]) || [];
}

export async function upsertPromoCode(code: DbPromoCode) {
  await supabase.from('promo_codes').upsert(code);
}

export async function deletePromoCode(id: string) {
  await supabase.from('promo_codes').delete().eq('id', id);
}

export async function validatePromoCode(code: string): Promise<DbPromoCode | null> {
  // Passe par la RPC : la table promo_codes n'est plus lisible publiquement,
  // impossible de lister tous les codes de réduction.
  const { data, error } = await supabase.rpc('validate_promo', { code_input: code });
  if (error) {
    console.error('validate_promo failed:', error.message);
    return null;
  }
  const rows = (data as Array<{ id: string; code: string; discount_percent: number }>) || [];
  const found = rows[0];
  if (!found) return null;
  return {
    id: found.id,
    code: found.code,
    discount_percent: found.discount_percent,
    active: true,
    uses: 0,
    max_uses: 0,
    expires_at: null,
  } as DbPromoCode;
}

export async function incrementPromoUse(id: string) {
  const { error } = await supabase.rpc('consume_promo', { promo_id: id });
  if (error) console.error('consume_promo failed:', error.message);
}

// ─── Chat ────────────────────────────────────────────────

export type DbChatMessage = {
  id: string;
  conversation_id: string;
  sender: 'client' | 'admin' | 'bot';
  message: string;
  client_name: string;
  created_at?: string;
};

export async function fetchConversations(): Promise<DbChatMessage[]> {
  const { data } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true });
  return (data as DbChatMessage[]) || [];
}

export async function fetchConversationMessages(conversationId: string): Promise<DbChatMessage[]> {
  // RPC : le visiteur ne peut lire que la conversation dont il connaît l'id.
  const { data, error } = await supabase.rpc('get_conversation', { conv_id: conversationId });
  if (error) {
    console.error('get_conversation failed:', error.message);
    return [];
  }
  return (data as DbChatMessage[]) || [];
}

export async function sendChatMessage(msg: DbChatMessage) {
  await supabase.from('chat_messages').insert(msg);
}

export async function deleteConversation(conversationId: string) {
  await supabase.from('chat_messages').delete().eq('conversation_id', conversationId);
}

export async function deleteChatMessage(id: string) {
  await supabase.from('chat_messages').delete().eq('id', id);
}

export function subscribeToChatMessages(callback: () => void) {
  const channel = supabase
    .channel('chat-realtime')
    // '*' couvre INSERT, UPDATE **et DELETE**. Sans DELETE, une conversation
    // supprimée depuis l'admin restait affichée chez le visiteur.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
      callback();
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
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

// ─── Presence (visiteurs en ligne) ───────────────────────

let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
let onlineCountCallback: ((count: number) => void) | null = null;

export function trackVisitor(page: string) {
  if (presenceChannel) return;
  const userId = localStorage.getItem('tof-visitor-id') || `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('tof-visitor-id', userId);

  presenceChannel = supabase.channel('online-visitors', {
    config: { presence: { key: userId } },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel?.presenceState() || {};
      const count = Object.keys(state).length;
      if (onlineCountCallback) onlineCountCallback(count);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel?.track({ page, joined_at: new Date().toISOString() });
      }
    });
}

export function onOnlineCountChange(callback: (count: number) => void) {
  onlineCountCallback = callback;
}

export function getPresenceState(): Record<string, { page?: string; joined_at?: string }[]> {
  if (!presenceChannel) return {};
  return presenceChannel.presenceState() as Record<string, { page?: string; joined_at?: string }[]>;
}

// ─── Realtime ────────────────────────────────────────────

export function subscribeToOrders(onInsert: () => void, onUpdate: () => void) {
  const channel = supabase
    .channel('orders-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
      onInsert();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
      onUpdate();
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
