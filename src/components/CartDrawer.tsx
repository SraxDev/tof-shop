import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readCart, removeFromCart, updateCartQuantity, clearCart, cartTotal, cartCount, type CartItem } from '../lib/cart';
import { readSiteSettings } from '../lib/siteSettings';
import { insertOrder, validatePromoCode, incrementPromoUse, type DbPromoCode } from '../lib/db';

function formatPrice(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

// Shipping values come from settings now

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [settings, setSettings] = useState(readSiteSettings);
  const [step, setStep] = useState<'cart' | 'checkout' | 'done'>('cart');
  const [shippingMode, setShippingMode] = useState<'standard' | 'express'>('standard');
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<DbPromoCode | null>(null);
  const [promoError, setPromoError] = useState('');
  const [savedCart, setSavedCart] = useState<CartItem[]>([]);
  const [savedTotal, setSavedTotal] = useState(0);
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
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

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
      setShippingMode('standard');
      setSavedCart([]);
      setSavedTotal(0);
      setCreatedOrderId('');
      setAppliedPromo(null);
      setPromoInput('');
      setPromoError('');
    }
  }, [open]);

  const subtotal = cartTotal(cart);
  const count = cartCount(cart);
  const discount = appliedPromo ? Math.round(subtotal * appliedPromo.discount_percent / 100) : 0;
  const total = subtotal - discount;
  const isFreeShipping = settings.freeShipping || total >= (settings.freeShippingThreshold || 100);
  const baseShipping = isFreeShipping ? 0 : (settings.standardShippingFee || 7.9);
  const expressExtra = shippingMode === 'express' ? (settings.expressShippingFee || 14.9) : 0;
  const shipping = baseShipping + expressExtra;
  const grandTotal = total + shipping;

  const applyPromo = async () => {
    setPromoError('');
    if (!promoInput.trim()) return;
    const promo = await validatePromoCode(promoInput.trim());
    if (!promo) {
      setPromoError('Code invalide ou expiré');
      return;
    }
    setAppliedPromo(promo);
    setPromoInput('');
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');
  };

  const placeOrder = async () => {
    if (!form.customerName || !form.phone || !form.address) return;

    const orderId = `TOF-${Math.floor(1000 + Math.random() * 9000)}`;

    const itemsJson = JSON.stringify(cart.map((item) => ({
      productId: item.productId,
      brand: item.brand,
      name: item.name,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      price: item.salePrice,
    })));

    const firstItem = cart[0];

    await insertOrder({
      id: orderId,
      product_id: firstItem.productId,
      size: cart.map((i) => `${i.size}`).join(', '),
      color: cart.map((i) => `${i.color}`).join(', '),
      quantity: cart.reduce((sum, i) => sum + i.quantity, 0),
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
      items_json: itemsJson,
    });

    if (appliedPromo) {
      await incrementPromoUse(appliedPromo.id);
    }

    setSavedCart([...cart]);
    setSavedTotal(grandTotal);
    setCreatedOrderId(orderId);
    clearCart();
    setAppliedPromo(null);
    setStep('done');
  };

  const whatsappCheckoutLink = () => {
    const whatsappBase = settings.whatsappUrl.includes('wa.me') ? settings.whatsappUrl : 'https://wa.me/';
    const baseUrl = whatsappBase.split('?')[0];
    const items = savedCart.length > 0 ? savedCart : cart;
    const finalTotal = savedTotal > 0 ? savedTotal : grandTotal;
    const itemsList = items.map((i) => `- ${i.brand} ${i.name} (${i.size}/${i.color}) x${i.quantity} = ${formatPrice(i.salePrice * i.quantity)}`).join('\n');
    const shippingLabel = shippingMode === 'express' ? 'Express ⚡ (5-10j)' : 'Standard 📦 (10-20j)';
    const msg = encodeURIComponent(
      `Salut, je viens de passer la commande ${createdOrderId} sur tof.\n\n` +
      `${itemsList}\n\n` +
      `Livraison : ${shippingLabel}\n` +
      `Total : ${formatPrice(finalTotal)}\n\n` +
      `Je suis prêt à payer, envoie-moi le lien PayPal.`
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
                      <div className="h-16 w-16 rounded-xl bg-subtle flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-2xl">
                            {item.category?.toLowerCase().includes('sneaker') ? '👟' : item.category?.toLowerCase().includes('sac') ? '👜' : '👕'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-accent uppercase tracking-wider">{item.brand}</div>
                        <div className="font-bold text-[13px] text-dark truncate leading-tight">{item.name}</div>
                        <div className="text-[11px] text-dark/40 mt-0.5">{item.size} / {item.color}</div>
                        <div className="flex items-center justify-between mt-2.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateCartQuantity(item.productId, item.size, item.color, item.quantity - 1)}
                              className="h-8 w-8 rounded-xl bg-white border border-dark/10 flex items-center justify-center text-dark/40 hover:text-dark active:scale-90 transition-all"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-sm font-800 w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.productId, item.size, item.color, item.quantity + 1)}
                              className="h-8 w-8 rounded-xl bg-white border border-dark/10 flex items-center justify-center text-dark/40 hover:text-dark active:scale-90 transition-all"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <span className="font-900 text-[13px]">{formatPrice(item.salePrice * item.quantity)}</span>
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
                    <span className="font-bold">{formatPrice(subtotal)}</span>
                  </div>

                  {/* Code promo */}
                  {appliedPromo ? (
                    <div className="flex items-center justify-between rounded-xl bg-green-500/10 border border-green-500/20 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-xs font-bold">🎉 {appliedPromo.code}</span>
                        <span className="text-green-600 text-xs">-{appliedPromo.discount_percent}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-sm font-800">-{formatPrice(discount)}</span>
                        <button onClick={removePromo} className="text-green-600/40 hover:text-red-500 text-xs">✕</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <input
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                          onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                          placeholder="Code promo"
                          className="flex-1 rounded-xl bg-bg px-3 py-2.5 text-xs outline-none uppercase tracking-wider"
                        />
                        <button onClick={applyPromo} className="rounded-xl bg-dark text-white px-4 py-2.5 text-xs font-bold hover:bg-accent transition-colors">
                          Appliquer
                        </button>
                      </div>
                      {promoError && <p className="text-xs text-red-500 font-semibold mt-1">{promoError}</p>}
                    </div>
                  )}

                  {/* Choix livraison */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-dark/30">Livraison</span>
                    <button
                      onClick={() => setShippingMode('standard')}
                      className={`w-full flex items-center justify-between rounded-xl p-3 border-2 transition-all text-left ${
                        shippingMode === 'standard' ? 'border-dark bg-dark/5' : 'border-dark/10'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold">📦 Standard</div>
                        <div className="text-[11px] text-dark/40">10-20 jours</div>
                      </div>
                      <span className="text-sm font-800 text-green-600">
                        {isFreeShipping ? 'Offert 🎉' : formatPrice(baseShipping)}
                      </span>
                    </button>
                    <button
                      onClick={() => setShippingMode('express')}
                      className={`w-full flex items-center justify-between rounded-xl p-3 border-2 transition-all text-left ${
                        shippingMode === 'express' ? 'border-accent bg-accent/5' : 'border-dark/10'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold">⚡ Express</div>
                        <div className="text-[11px] text-dark/40">5-10 jours</div>
                      </div>
                      <span className="text-sm font-800 text-accent">
                        +{formatPrice(settings.expressShippingFee || 14.9)}
                      </span>
                    </button>
                  </div>

                  {!isFreeShipping && shippingMode === 'standard' && (settings.freeShippingThreshold || 0) > 0 && total < (settings.freeShippingThreshold || 100) && (
                    <p className="text-[11px] text-dark/30">Encore {formatPrice((settings.freeShippingThreshold || 100) - total)} pour la livraison standard offerte</p>
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
                <div className="font-bold text-dark/60">Récapitulatif</div>
                {cart.map((item) => (
                  <div key={`${item.productId}-${item.size}-${item.color}`} className="flex justify-between">
                    <span className="text-dark/45 truncate mr-2">{item.brand} {item.name} x{item.quantity}</span>
                    <span className="font-bold flex-shrink-0">{formatPrice(item.salePrice * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-dark/40">
                  <span>Livraison {shippingMode === 'express' ? '⚡ Express' : '📦 Standard'}</span>
                  <span className="font-bold">{shipping === 0 ? 'Gratuit' : formatPrice(shipping)}</span>
                </div>
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
                <h3 className="font-display text-3xl font-800 tracking-tight text-dark">Commande réservée</h3>
                <p className="mt-3 text-dark/45 max-w-sm mx-auto text-sm leading-relaxed">
                  Ta commande <span className="font-bold text-dark">{createdOrderId}</span> est enregistrée.
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
