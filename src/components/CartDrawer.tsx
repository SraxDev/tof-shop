import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readCart, removeFromCart, updateCartQuantity, clearCart, cartTotal, cartCount, type CartItem } from '../lib/cart';
import { readSiteSettings } from '../lib/siteSettings';
import { insertOrder, validatePromoCode, incrementPromoUse, type DbPromoCode } from '../lib/db';

function formatPrice(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

// Shipping values come from settings now

type FormErrors = Partial<Record<'customerName' | 'phone' | 'address' | 'city' | 'zip' | 'snapOrWhatsapp', string>>;

const STEP_LABELS = [
  { id: 'cart', label: 'Panier' },
  { id: 'checkout', label: 'Infos' },
  { id: 'done', label: 'Paiement' },
] as const;

function CheckoutStepper({ step }: { step: 'cart' | 'checkout' | 'done' }) {
  const activeIndex = STEP_LABELS.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-1.5 px-5 py-3 border-b border-dark/5 bg-white">
      {STEP_LABELS.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={s.id} className="flex items-center gap-1.5 flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={`h-6 w-6 rounded-full text-[10px] font-900 flex items-center justify-center transition-colors ${
                  done
                    ? 'bg-green-500 text-white'
                    : active
                      ? 'bg-dark text-white'
                      : 'bg-dark/8 text-dark/30'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`text-[11px] font-bold whitespace-nowrap ${
                  active ? 'text-dark' : done ? 'text-green-600' : 'text-dark/30'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <span className={`flex-1 h-[2px] rounded-full ${done ? 'bg-green-500' : 'bg-dark/8'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function validateForm(form: {
  customerName: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  snapOrWhatsapp: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (form.customerName.trim().length < 2) errors.customerName = 'Indique ton nom complet.';
  const phoneDigits = form.phone.replace(/[^0-9]/g, '');
  if (phoneDigits.length < 9) errors.phone = 'Numéro invalide (ex : 06 12 34 56 78).';
  if (form.address.trim().length < 5) errors.address = 'Adresse trop courte (numéro + rue).';
  if (form.city.trim().length < 2) errors.city = 'Indique ta ville.';
  if (!/^[0-9A-Za-z\s-]{4,10}$/.test(form.zip.trim())) errors.zip = 'Code postal invalide.';
  if (form.snapOrWhatsapp.trim().length < 3) errors.snapOrWhatsapp = 'Snap ou WhatsApp pour te tenir au courant.';
  return errors;
}

function inputCls(hasError: boolean) {
  return `w-full rounded-xl px-4 py-3 text-sm outline-none border transition-colors ${
    hasError
      ? 'bg-red-500/5 border-red-400 focus:border-red-500'
      : 'bg-bg border-transparent focus:border-accent/40'
  }`;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-dark/35 mb-1.5">{label}</label>
      {children}
      {error && (
        <p className="mt-1 text-[11px] font-semibold text-red-500 flex items-center gap-1">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

export default function CartDrawer({
  open,
  onClose,
  initialStep = 'cart',
}: {
  open: boolean;
  onClose: () => void;
  initialStep?: 'cart' | 'checkout';
}) {
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [settings, setSettings] = useState(readSiteSettings);
  const [step, setStep] = useState<'cart' | 'checkout' | 'done'>('cart');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
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
      const items = readCart();
      setCart(items);
      setStep(initialStep === 'checkout' && items.length > 0 ? 'checkout' : 'cart');
      setErrors({});
      setSubmitting(false);
      setShippingMode('standard');
      setSavedCart([]);
      setSavedTotal(0);
      setCreatedOrderId('');
      setAppliedPromo(null);
      setPromoInput('');
      setPromoError('');
    }
  }, [open, initialStep]);

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

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as keyof FormErrors]) return prev;
      const next = { ...prev };
      delete next[key as keyof FormErrors];
      return next;
    });
  };

  const hasErrors = Object.keys(errors).length > 0;

  const goToCheckout = () => {
    if (cart.length === 0) return;
    setErrors({});
    setStep('checkout');
  };

  const placeOrder = async () => {
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const firstKey = Object.keys(found)[0];
      const el = document.querySelector(`[data-field="${firstKey}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLInputElement | null)?.focus?.();
      return;
    }
    if (submitting) return;
    setSubmitting(true);

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
    try { localStorage.setItem('tof-last-order-id', orderId); } catch { /* ignore */ }
    clearCart();
    setAppliedPromo(null);
    setSubmitting(false);
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
      `Je paie par carte via SumUp, je t'envoie la confirmation ici.`
    );
    return `${baseUrl}?text=${msg}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-dark/50 backdrop-blur-sm anim-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white h-[100dvh] overflow-y-auto shadow-2xl flex flex-col safe-bottom anim-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-dark/5">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} />
            <span className="font-display text-xl font-800">Panier</span>
            {count > 0 && <span className="bg-accent text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center">{count}</span>}
          </div>
          <button onClick={onClose} aria-label="Fermer le panier" className="h-11 w-11 rounded-full bg-dark/5 flex items-center justify-center text-dark/40 hover:text-dark hover:bg-dark/10 transition-colors">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Stepper 3 étapes */}
        <CheckoutStepper step={step} />

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
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain p-1" loading="lazy" decoding="async" />
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
                              aria-label="Diminuer la quantité"
                              className="h-11 w-11 rounded-xl bg-white border border-dark/10 flex items-center justify-center text-dark/40 hover:text-dark active:scale-90 transition-all"
                            >
                              <Minus size={15} strokeWidth={2.5} />
                            </button>
                            <span className="text-sm font-800 w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.productId, item.size, item.color, item.quantity + 1)}
                              aria-label="Augmenter la quantité"
                              className="h-11 w-11 rounded-xl bg-white border border-dark/10 flex items-center justify-center text-dark/40 hover:text-dark active:scale-90 transition-all"
                            >
                              <Plus size={15} strokeWidth={2.5} />
                            </button>
                          </div>
                          <span className="font-900 text-[13px]">{formatPrice(item.salePrice * item.quantity)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId, item.size, item.color)}
                        aria-label="Retirer du panier"
                        className="self-start h-11 w-11 rounded-xl flex items-center justify-center text-dark/20 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
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
                        <button onClick={applyPromo} className="h-11 rounded-xl bg-dark text-white px-4 text-xs font-bold hover:bg-accent transition-colors active:scale-95">
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

                  {shippingMode === 'standard' && (settings.freeShippingThreshold || 0) > 0 && (
                    <div>
                      {isFreeShipping ? (
                        <p className="text-[11px] font-bold text-green-600 mb-1.5">🎉 Livraison standard offerte !</p>
                      ) : (
                        <p className="text-[11px] text-dark/40 mb-1.5">
                          Plus que <b className="text-accent">{formatPrice((settings.freeShippingThreshold || 100) - total)}</b> pour la livraison offerte
                        </p>
                      )}
                      <div className="h-2 rounded-full bg-dark/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isFreeShipping ? 'bg-green-500' : 'bg-accent'}`}
                          style={{ width: `${Math.min(100, (total / (settings.freeShippingThreshold || 100)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-800 pt-2 border-t border-dark/5">
                    <span>Total</span>
                    <span>{formatPrice(grandTotal)}</span>
                  </div>
                  <button
                    onClick={goToCheckout}
                    className="w-full h-12 rounded-full bg-dark px-7 text-sm font-bold text-white hover:bg-accent transition-colors active:scale-[0.98]"
                  >
                    Passer la commande →
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
                <p className="text-sm text-dark/40 mt-1">Le paiement se fait par carte via SumUp juste après la confirmation de ta commande (lien de paiement sécurisé 3D Secure). Ta pièce est commandée et vérifiée sur photo QC à l'entrepôt avant expédition.</p>
              </div>
              <div className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-2.5 text-xs font-semibold text-accent flex items-start gap-2">
                <span>🔍</span>
                <span>Toutes les pièces sont vérifiées sur photo QC à l'entrepôt avant expédition. Si quelque chose ne va pas, on change ou rembourse.</span>
              </div>
              <Field label="Nom complet" error={errors.customerName}>
                <input
                  data-field="customerName"
                  name="name"
                  autoComplete="name"
                  className={inputCls(!!errors.customerName)}
                  placeholder="Prénom et nom"
                  value={form.customerName}
                  onChange={(e) => updateField('customerName', e.target.value)}
                />
              </Field>

              <Field label="Téléphone" error={errors.phone}>
                <input
                  data-field="phone"
                  name="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className={inputCls(!!errors.phone)}
                  placeholder="06 12 34 56 78"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
              </Field>

              <Field label="Snap ou WhatsApp" error={errors.snapOrWhatsapp}>
                <input
                  data-field="snapOrWhatsapp"
                  name="username"
                  autoComplete="username"
                  className={inputCls(!!errors.snapOrWhatsapp)}
                  placeholder="@pseudo ou numéro WhatsApp"
                  value={form.snapOrWhatsapp}
                  onChange={(e) => updateField('snapOrWhatsapp', e.target.value)}
                />
              </Field>

              <Field label="Adresse de livraison" error={errors.address}>
                <input
                  data-field="address"
                  name="street-address"
                  autoComplete="street-address"
                  className={inputCls(!!errors.address)}
                  placeholder="12 rue des Lilas, appartement 3"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Ville" error={errors.city}>
                  <input
                    data-field="city"
                    name="city"
                    autoComplete="address-level2"
                    className={inputCls(!!errors.city)}
                    placeholder="Limoges"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                  />
                </Field>
                <Field label="Code postal" error={errors.zip}>
                  <input
                    data-field="zip"
                    name="postal-code"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    className={inputCls(!!errors.zip)}
                    placeholder="87000"
                    value={form.zip}
                    onChange={(e) => updateField('zip', e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Pays">
                <input
                  data-field="country"
                  name="country"
                  autoComplete="country-name"
                  className={inputCls(false)}
                  placeholder="France"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </Field>

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
              {hasErrors && (
                <p className="text-xs font-semibold text-red-500 text-center">
                  Corrige les champs en rouge pour continuer.
                </p>
              )}
              <button
                onClick={placeOrder}
                disabled={submitting}
                className="w-full h-12 rounded-full bg-dark px-7 text-sm font-bold text-white hover:bg-accent disabled:bg-dark/20 transition-colors active:scale-[0.98]"
              >
                {submitting ? 'Enregistrement…' : `Confirmer la commande · ${formatPrice(grandTotal)}`}
              </button>
              <button onClick={() => setStep('cart')} className="w-full text-center text-sm text-dark/40 font-semibold py-3 min-h-[44px]">
                Retour au panier
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-3xl bg-green-500/10 text-green-600 flex items-center justify-center text-3xl font-800 mb-5">✓</div>
                <h3 className="font-display text-3xl font-800 tracking-tight text-dark">Commande enregistrée</h3>
                <p className="mt-3 text-dark/55 max-w-sm mx-auto text-sm leading-relaxed">
                  C'est noté ! Je commande ta pièce dans les 2h qui suivent. Tu reçois les photos QC sous 2-5j après paiement, et le colis part juste après.
                </p>
                <div className="mt-4 text-dark/45 max-w-sm mx-auto text-xs leading-relaxed rounded-xl bg-bg p-3">
                  <b>Prochaine étape :</b> paie ta commande par carte via notre lien SumUp sécurisé (CB, Apple Pay, Google Pay), puis envoie-moi la confirmation sur WhatsApp.
                </div>
                <div className="mt-4 mx-auto max-w-sm rounded-xl bg-dark/[0.03] border border-dark/5 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-dark/40 uppercase tracking-wider">À payer · {createdOrderId}</span>
                  <span className="font-900 text-lg text-dark">{formatPrice(savedTotal)}</span>
                </div>
              <div className="mt-6 space-y-3">
                {/* Tant que le lien SumUp n'est pas configuré (valeur "#"), on
                    n'affiche pas un bouton qui ne mène nulle part : le client
                    cliquerait dans le vide sans comprendre. On l'oriente vers
                    WhatsApp, qui fonctionne toujours. */}
                {settings.sumupUrl && settings.sumupUrl !== '#' ? (
                  <a
                    href={settings.sumupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-12 rounded-full bg-accent px-7 text-sm font-bold text-white hover:brightness-110 transition-all text-center flex items-center justify-center gap-2"
                  >
                    💳 Payer {formatPrice(savedTotal)} par carte (SumUp)
                  </a>
                ) : (
                  <div className="rounded-2xl bg-accent/[0.06] border border-accent/20 px-4 py-3 text-center">
                    <p className="text-[13px] font-bold text-dark/75">
                      Ta commande est bien enregistrée ✅
                    </p>
                    <p className="text-[12px] text-dark/50 mt-1 leading-relaxed">
                      Contacte-moi sur WhatsApp juste en dessous : je t'envoie ton lien de
                      paiement sécurisé et je lance ta commande.
                    </p>
                  </div>
                )}
                <a
                  href={whatsappCheckoutLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-12 rounded-full bg-[#25D366] px-7 text-sm font-bold text-white hover:brightness-110 transition-all text-center flex items-center justify-center gap-2"
                >
                  💬 Me contacter sur WhatsApp
                </a>
                <a
                  href={settings.snapchatUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-12 rounded-full bg-[#FFFC00]/15 border border-[#FFFC00]/30 text-[#a39800] px-7 text-sm font-bold hover:bg-[#FFFC00]/25 transition-all text-center flex items-center justify-center gap-2"
                >
                  👻 M'ajouter sur Snap
                </a>
                <a
                  href={`#suivi?order=${createdOrderId}`}
                  onClick={onClose}
                  className="block h-12 rounded-full bg-dark px-7 text-sm font-bold text-white hover:bg-accent transition-colors text-center flex items-center justify-center gap-2"
                >
                  📦 Suivre ma commande
                </a>
                <button
                  onClick={onClose}
                  className="block w-full h-12 rounded-full bg-dark/5 px-7 text-sm font-bold text-dark/60 hover:bg-dark/10 transition-colors"
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
