import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readCart, removeFromCart, updateCartQuantity, clearCart, cartTotal, cartCount, type CartItem } from '../lib/cart';
import { readSiteSettings } from '../lib/siteSettings';
import { insertOrder } from '../lib/db';

function formatPrice(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

const SHIPPING_FREE_THRESHOLD = 100;
const SHIPPING_FEE = 7.9;

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [settings, setSettings] = useState(readSiteSettings);
  const [step, setStep] = useState<'cart' | 'checkout' | 'done'>('cart');
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    address: '',
    city: '',
    zip: '',
    country: 'France',
    snapOrWhatsapp: '',
  });

  useEffect(() => {
    const syncCart = () => setCart(readCart());
    const syncSettings = () => setSettings(readSiteSettings());
    window.addEventListener('tof-cart-updated', syncCart);
    window.addEventListener('tof-settings-updated', syncSettings);
    window.addEventListener('storage', syncCart);
    window.addEventListener('storage', syncSettings);
    return () => {
      window.removeEventListener('tof-cart-updated', syncCart);
      window.removeEventListener('tof-settings-updated', syncSettings);
      window.removeEventListener('storage', syncCart);
      window.removeEventListener('storage', syncSettings);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setCart(readCart());
      setStep('cart');
    }
  }, [open]);

  const total = cartTotal(cart);
  const count = cartCount(cart);
  const shipping = total >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE;
  const grandTotal = total + shipping;

  const placeOrder = async () => {
    if (!form.customerName || !form.phone || !form.address) return;

    const orderId = `TOF-${Math.floor(1000 + Math.random() * 9000)}`;

    for (const item of cart) {
      await insertOrder({
        id: `${orderId}-${item.productId}-${item.size}-${item.color}`,
        product_id: item.productId,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        customer_name: form.customerName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        zip: form.zip,
        country: form.country,
        snap_or_whatsapp: form.snapOrWhatsapp,
        status: 'to_order',
        payment_status: 'pending',
        tracking: null,
      });
    }

    setCreatedOrderId(orderId);
    clearCart();
    setStep('done');
  };

  const whatsappCheckoutLink = () => {
    const whatsappBase = settings.whatsappUrl.includes('wa.me') ? settings.whatsappUrl : 'https://wa.me/';
    const baseUrl = whatsappBase.split('?')[0];
    const itemsList = cart.map((i) => `- ${i.brand} ${i.name} (${i.size}/${i.color}) x${i.quantity} = ${formatPrice(i.salePrice * i.quantity)}`).join('\n');
    const msg = encodeURIComponent(
      `Salut, je viens de passer la commande ${createdOrderId} sur tof.\n\n` +
      `${itemsList}\n\n` +
      `Total : ${formatPrice(grandTotal)}${shipping > 0 ? ` (dont ${formatPrice(shipping)} livraison)` : ' (livraison offerte)'}\n\n` +
      `Je suis pret a payer, envoie-moi le lien PayPal.`
    );
    return `${baseUrl}?text=${msg}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-dark/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col safe-bottom">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-dark/5">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} />
            <span className="font-display text-xl font-800">Panier</span>
            {count > 0 && <span className="bg-accent text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center">{count}</span>}
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-dark/5 flex items-center justify-center text-dark/40 hover:text-dark">
            <X size={18} />
          </button>
        </div>

        {step === 'cart' && (
          <div className="flex-1 flex flex-col">
            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-10">
                <div className="text-center">
                  <ShoppingBag size={40} className="mx-auto text-dark/15 mb-4" />
                  <p className="font-bold text-dark/40">Ton panier est vide</p>
                  <button onClick={onClose} className="mt-4 rounded-full bg-dark px-6 py-2.5 text-sm font-bold text-white hover:bg-accent transition-colors">
                    Voir le shop
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 p-5 space-y-4">
                  {cart.map((item) => (
                    <div key={`${item.productId}-${item.size}-${item.color}`} className="flex gap-4 rounded-2xl bg-bg p-4">
                      <div className="h-16 w-16 rounded-xl bg-subtle flex items-center justify-center text-2xl flex-shrink-0">
                        {item.category?.toLowerCase().includes('sneaker') ? '👟' : item.category?.toLowerCase().includes('sac') ? '👜' : '👕'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-accent uppercase tracking-wider">{item.brand}</div>
                        <div className="font-bold text-sm text-dark truncate">{item.name}</div>
                        <div className="text-xs text-dark/40 mt-0.5">{item.size} / {item.color}</div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartQuantity(item.productId, item.size, item.color, item.quantity - 1)}
                              className="h-7 w-7 rounded-lg bg-white border border-dark/10 flex items-center justify-center text-dark/40 hover:text-dark"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.productId, item.size, item.color, item.quantity + 1)}
                              className="h-7 w-7 rounded-lg bg-white border border-dark/10 flex items-center justify-center text-dark/40 hover:text-dark"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <span className="font-800 text-sm">{formatPrice(item.salePrice * item.quantity)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId, item.size, item.color)}
                        className="self-start text-dark/20 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="sticky bottom-0 bg-white border-t border-dark/5 p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark/45">Sous-total</span>
                    <span className="font-bold">{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark/45">Livraison</span>
                    <span className={`font-bold ${shipping === 0 ? 'text-green-600' : ''}`}>
                      {shipping === 0 ? 'Offerte' : formatPrice(shipping)}
                    </span>
                  </div>
                  {shipping > 0 && (
                    <p className="text-[11px] text-dark/30">Encore {formatPrice(SHIPPING_FREE_THRESHOLD - total)} pour la livraison offerte</p>
                  )}
                  <div className="flex justify-between text-lg font-800 pt-2 border-t border-dark/5">
                    <span>Total</span>
                    <span>{formatPrice(grandTotal)}</span>
                  </div>
                  <button
                    onClick={() => setStep('checkout')}
                    className="w-full rounded-full bg-dark px-7 py-3.5 text-sm font-bold text-white hover:bg-accent transition-colors"
                  >
                    Passer la commande
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'checkout' && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-5 space-y-4">
              <div>
                <h3 className="font-display text-xl font-800">Tes infos</h3>
                <p className="text-sm text-dark/40 mt-1">On te contactera sur WhatsApp pour finaliser le paiement.</p>
              </div>
              <input className="w-full rounded-xl bg-bg px-4 py-3 text-sm outline-none" placeholder="Nom complet" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              <input className="w-full rounded-xl bg-bg px-4 py-3 text-sm outline-none" placeholder="Telephone (avec indicatif)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="w-full rounded-xl bg-bg px-4 py-3 text-sm outline-none" placeholder="Snap ou WhatsApp" value={form.snapOrWhatsapp} onChange={(e) => setForm({ ...form, snapOrWhatsapp: e.target.value })} />
              <input className="w-full rounded-xl bg-bg px-4 py-3 text-sm outline-none" placeholder="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-xl bg-bg px-4 py-3 text-sm outline-none" placeholder="Ville" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <input className="rounded-xl bg-bg px-4 py-3 text-sm outline-none" placeholder="Code postal" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
              </div>

              <div className="rounded-2xl bg-bg p-4 space-y-2 text-sm">
                <div className="font-bold text-dark/60">Recapitulatif</div>
                {cart.map((item) => (
                  <div key={`${item.productId}-${item.size}-${item.color}`} className="flex justify-between">
                    <span className="text-dark/45 truncate mr-2">{item.brand} {item.name} x{item.quantity}</span>
                    <span className="font-bold flex-shrink-0">{formatPrice(item.salePrice * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-dark/5 pt-2 flex justify-between font-800">
                  <span>Total</span>
                  <span>{formatPrice(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-dark/5 p-5 space-y-3">
              <button
                onClick={placeOrder}
                className="w-full rounded-full bg-dark px-7 py-3.5 text-sm font-bold text-white hover:bg-accent transition-colors"
              >
                Confirmer la commande
              </button>
              <button onClick={() => setStep('cart')} className="w-full text-center text-sm text-dark/40 font-semibold py-2">
                Retour au panier
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-3xl bg-green-500/10 text-green-600 flex items-center justify-center text-3xl font-800 mb-5">✓</div>
              <h3 className="font-display text-3xl font-800 tracking-tight text-dark">Commande reservee</h3>
              <p className="mt-3 text-dark/45 max-w-sm mx-auto text-sm leading-relaxed">
                Ta commande <span className="font-bold text-dark">{createdOrderId}</span> est enregistree.
                Finalise le paiement sur WhatsApp.
              </p>
              <div className="mt-6 space-y-3">
                <a
                  href={whatsappCheckoutLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-full bg-[#25D366] px-7 py-3.5 text-sm font-bold text-white hover:brightness-110 transition-all text-center"
                >
                  Finaliser sur WhatsApp
                </a>
                <button
                  onClick={onClose}
                  className="block w-full rounded-full bg-dark/5 px-7 py-3.5 text-sm font-bold text-dark/60 hover:bg-dark/10 transition-colors"
                >
                  Continuer le shop
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
