export type CartItem = {
  productId: string;
  brand: string;
  name: string;
  category: string;
  salePrice: number;
  size: string;
  color: string;
  quantity: number;
};

const CART_KEY = 'tof-cart-v1';

export function readCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(CART_KEY);
    return stored ? (JSON.parse(stored) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('tof-cart-updated'));
}

export function addToCart(item: CartItem) {
  const cart = readCart();
  const existing = cart.find(
    (i) => i.productId === item.productId && i.size === item.size && i.color === item.color
  );
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    cart.push(item);
  }
  saveCart(cart);
}

export function removeFromCart(productId: string, size: string, color: string) {
  const cart = readCart().filter(
    (i) => !(i.productId === productId && i.size === size && i.color === color)
  );
  saveCart(cart);
}

export function updateCartQuantity(productId: string, size: string, color: string, quantity: number) {
  const cart = readCart().map((i) =>
    i.productId === productId && i.size === size && i.color === color
      ? { ...i, quantity: Math.max(1, quantity) }
      : i
  );
  saveCart(cart);
}

export function clearCart() {
  saveCart([]);
}

export function syncCartWithProducts(validProductIds: string[]) {
  const validIds = new Set(validProductIds);
  const next = readCart().filter((item) => validIds.has(item.productId));
  saveCart(next);
  return next;
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.salePrice * i.quantity, 0);
}

export function cartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
