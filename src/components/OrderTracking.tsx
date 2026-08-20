import { Check, Copy, Loader2, Package, Search, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchOrderById, type DbOrder } from '../lib/db';
import { readSiteSettings } from '../lib/siteSettings';
import { showToast } from './Toast';

type StepId = 'received' | 'paid' | 'qc' | 'shipped' | 'delivered';

const STEPS: Array<{ id: StepId; title: string; desc: string; emoji: string }> = [
  { id: 'received', title: 'Commande reçue', desc: "Ta commande est enregistrée, je la traite dans les 2h.", emoji: '📝' },
  { id: 'paid', title: 'Paiement confirmé', desc: 'Paiement carte (SumUp) reçu — je lance la commande.', emoji: '💳' },
  { id: 'qc', title: 'Photos QC validées', desc: 'Coutures, logo, semelle, étiquette : tout est contrôlé.', emoji: '🔍' },
  { id: 'shipped', title: 'Colis expédié', desc: 'Ton numéro de suivi est disponible ci-dessous.', emoji: '📦' },
  { id: 'delivered', title: 'Livré', desc: 'Colis remis. Un souci ? Écris-moi, on gère.', emoji: '🎉' },
];

function currentStepIndex(order: DbOrder): number {
  const status = (order.status || '').toLowerCase();
  const payment = (order.payment_status || '').toLowerCase();
  if (status === 'done' || status === 'delivered') return 4;
  if (status === 'shipped') return 3;
  if (status === 'qc_received') return 2;
  if (payment === 'paid' || status === 'ordered') return 1;
  return 0;
}

function parseItems(order: DbOrder) {
  try {
    const raw = order.items_json ? JSON.parse(order.items_json) : [];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function formatDate(value?: string) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function OrderTracking() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<DbOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState(readSiteSettings);

  useEffect(() => {
    const sync = () => setSettings(readSiteSettings());
    window.addEventListener('tof-settings-updated', sync);
    return () => window.removeEventListener('tof-settings-updated', sync);
  }, []);

  // Pré-remplissage depuis l'URL (#suivi?order=TOF-1234) ou depuis la dernière commande locale
  useEffect(() => {
    try {
      const fromHash = new URLSearchParams(window.location.hash.split('?')[1] || '').get('order');
      const last = localStorage.getItem('tof-last-order-id');
      const initial = fromHash || last;
      if (initial) setQuery(initial);
    } catch {
      /* ignore */
    }
  }, []);

  const search = async (value?: string) => {
    const target = (value ?? query).trim();
    if (!target) return;
    setLoading(true);
    setNotFound(false);
    setOrder(null);
    try {
      const found = await fetchOrderById(target);
      if (found) {
        setOrder(found);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = useMemo(() => (order ? currentStepIndex(order) : -1), [order]);
  const items = useMemo(() => (order ? parseItems(order) : []), [order]);

  const copyTracking = async () => {
    if (!order?.tracking) return;
    try {
      await navigator.clipboard.writeText(order.tracking);
      setCopied(true);
      showToast('Numéro de suivi copié');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Impossible de copier');
    }
  };

  return (
    <section id="suivi" className="py-14 sm:py-20 bg-bg border-t border-dark/5">
      <div className="mx-auto max-w-3xl px-5">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-dark/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-dark/45">
            <Truck size={13} /> Suivi de commande
          </span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-800 tracking-tight text-dark">
            où en est ma <span className="text-accent">commande</span> ?
          </h2>
          <p className="mt-2 text-dark/45 text-sm sm:text-base">
            Entre ton numéro de commande (format <b className="text-dark/70">TOF-1234</b>) reçu après ton achat.
          </p>
        </div>

        <div className="rounded-3xl bg-white border border-dark/5 shadow-sm shadow-dark/5 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/25 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value.toUpperCase());
                  setNotFound(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="TOF-1234"
                aria-label="Numéro de commande"
                autoComplete="off"
                className="w-full h-12 rounded-2xl bg-bg border border-dark/5 pl-11 pr-4 text-sm font-semibold tracking-wider outline-none focus:border-accent/30 focus:ring-4 focus:ring-accent/5 transition-all"
              />
            </div>
            <button
              onClick={() => search()}
              disabled={loading || !query.trim()}
              className="h-12 rounded-2xl bg-dark px-7 text-sm font-bold text-white hover:bg-accent disabled:bg-dark/10 disabled:text-dark/25 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Suivre
            </button>
          </div>

          {notFound && (
            <div className="mt-4 rounded-2xl bg-red-500/5 border border-red-500/15 px-4 py-3 text-sm text-red-600 anim-fade-in">
              Aucune commande trouvée avec ce numéro. Vérifie le format (TOF-1234) ou écris-moi sur{' '}
              <a href={settings.whatsappUrl} target="_blank" rel="noreferrer" className="font-bold underline">
                WhatsApp
              </a>
              .
            </div>
          )}

          {order && (
            <div className="mt-6 anim-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-dark/5">
                <div>
                  <p className="font-display text-2xl font-800 text-dark">{order.id}</p>
                  {order.created_at && (
                    <p className="text-xs text-dark/35 mt-0.5">Commandée le {formatDate(order.created_at)}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    (order.payment_status || '').toLowerCase() === 'paid'
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-accent/10 text-accent'
                  }`}
                >
                  {(order.payment_status || '').toLowerCase() === 'paid' ? '✓ Payée' : '⏳ En attente de paiement'}
                </span>
              </div>

              {/* Timeline */}
              <ol className="mt-6 relative">
                {STEPS.map((step, i) => {
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  const upcoming = i > stepIndex;
                  return (
                    <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < STEPS.length - 1 && (
                        <span
                          className={`absolute left-[19px] top-10 bottom-0 w-[2px] rounded-full ${
                            done ? 'bg-green-500' : 'bg-dark/8'
                          }`}
                          aria-hidden
                        />
                      )}
                      <div
                        className={`relative z-10 h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                          done
                            ? 'bg-green-500 border-green-500 text-white'
                            : active
                              ? 'bg-accent border-accent text-white anim-pulse-ring'
                              : 'bg-white border-dark/10 text-dark/25'
                        }`}
                      >
                        {done ? <Check size={16} strokeWidth={3} /> : <span>{step.emoji}</span>}
                      </div>
                      <div className={`pt-1 ${upcoming ? 'opacity-45' : ''}`}>
                        <p className="text-sm font-800 text-dark">{step.title}</p>
                        <p className="text-xs text-dark/45 mt-0.5 leading-relaxed">{step.desc}</p>
                        {active && (
                          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent uppercase tracking-wider">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> En cours
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* Tracking number */}
              {order.tracking ? (
                <div className="mt-2 rounded-2xl bg-dark text-white p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-bold">Numéro de suivi</p>
                    <p className="font-mono text-sm font-bold truncate">{order.tracking}</p>
                  </div>
                  <button
                    onClick={copyTracking}
                    className="h-10 flex-shrink-0 rounded-full bg-white/10 hover:bg-white/20 px-4 text-xs font-bold flex items-center gap-2 transition-colors active:scale-95"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copié' : 'Copier'}
                  </button>
                </div>
              ) : (
                <div className="mt-2 rounded-2xl bg-bg border border-dark/5 p-4 flex items-center gap-3 text-xs text-dark/45">
                  <Package size={16} className="text-dark/25 flex-shrink-0" />
                  Le numéro de suivi apparaîtra ici dès l'expédition du colis.
                </div>
              )}

              {/* Items */}
              {items.length > 0 && (
                <div className="mt-4 rounded-2xl bg-bg p-4 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-dark/35 mb-2">Contenu</p>
                  {items.map((item: { brand?: string; name?: string; size?: string; color?: string; quantity?: number }, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-dark/55 truncate mr-2">
                        {item.brand} {item.name} · {item.size}/{item.color}
                      </span>
                      <span className="font-bold text-dark/70 flex-shrink-0">x{item.quantity || 1}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(order.payment_status || '').toLowerCase() !== 'paid' && settings.sumupUrl && settings.sumupUrl !== '#' && (
                  <a
                    href={settings.sumupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-12 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                  >
                    💳 Payer par carte (SumUp)
                  </a>
                )}
                <a
                  href={settings.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-12 rounded-full bg-[#25D366] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                >
                  💬 Une question sur ma commande
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
