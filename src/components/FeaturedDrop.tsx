import { useEffect, useState } from 'react';
import { useInView } from '../hooks/useInView';
import AppleEmoji from './AppleEmoji';
import { readSiteSettings } from '../lib/siteSettings';
import { fetchDrop, type DbDrop } from '../lib/db';

export type FeaturedDropConfig = {
  badge: string;
  eyebrow: string;
  brand: string;
  name: string;
  description: string;
  price: number;
  oldPrice: number;
  discount: string;
  sizes: string;
  imageUrl: string;
};

// const STORAGE_DROP = 'tof-featured-drop-v1';

export const defaultDrop: FeaturedDropConfig = {
  badge: 'DROP DE LA SEMAINE',
  eyebrow: 'Exclusivite tof.',
  brand: 'Nike x Off-White',
  name: 'Air Jordan 1 Retro',
  description: "La paire la plus demandee du moment. Quantites limitees, commande via WhatsApp apres reservation.",
  price: 389,
  oldPrice: 520,
  discount: '-25%',
  sizes: '39, 40, 41, 42, 43, 44, 45',
  imageUrl: '',
};

function dbToDrop(d: DbDrop): FeaturedDropConfig {
  return {
    badge: d.badge, eyebrow: d.eyebrow, brand: d.brand, name: d.name,
    description: d.description, price: d.price, oldPrice: d.old_price,
    discount: d.discount, sizes: d.sizes, imageUrl: d.image_url,
  };
}

async function loadDrop(): Promise<FeaturedDropConfig> {
  try {
    const d = await fetchDrop();
    return d ? { ...defaultDrop, ...dbToDrop(d) } : defaultDrop;
  } catch {
    return defaultDrop;
  }
}

function euro(value: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export default function FeaturedDrop() {
  const { ref, isInView } = useInView(0.1);
  const [drop, setDrop] = useState<FeaturedDropConfig>(defaultDrop);
  const [settings, setSettings] = useState(readSiteSettings);

  useEffect(() => {
    loadDrop().then(setDrop);
    const sync = () => { loadDrop().then(setDrop); };
    const syncSettings = () => setSettings(readSiteSettings());
    window.addEventListener('tof-drop-updated', sync);
    window.addEventListener('tof-settings-updated', syncSettings);
    window.addEventListener('storage', sync);
    window.addEventListener('storage', syncSettings);
    return () => {
      window.removeEventListener('tof-drop-updated', sync);
      window.removeEventListener('tof-settings-updated', syncSettings);
      window.removeEventListener('storage', sync);
      window.removeEventListener('storage', syncSettings);
    };
  }, []);

  const sizes = drop.sizes.split(',').map((size) => size.trim()).filter(Boolean);

  return (
    <section className="py-14 sm:py-20 lg:py-28 bg-dark text-white" ref={ref}>
      <div className="mx-auto max-w-6xl px-5">
        <div
          className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
            isInView ? 'anim-fade-up opacity-0' : 'opacity-0'
          }`}
        >
          <div className="relative">
            <div className="aspect-square rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
              {drop.imageUrl ? (
                <img src={drop.imageUrl} alt={`${drop.brand} ${drop.name}`} className="h-full w-full object-cover" />
              ) : (
                <div className="text-center space-y-3">
                  <AppleEmoji emoji="👟" size={56} className="mx-auto" />
                  <p className="text-white/15 text-sm font-medium">ta photo ici</p>
                </div>
              )}
            </div>
            <div className="absolute -inset-4 bg-accent/10 rounded-[2rem] blur-3xl -z-10 pointer-events-none" />

            <div className="absolute top-4 left-4 bg-accent text-white text-[11px] font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
              {drop.badge}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <span className="text-accent text-xs font-bold uppercase tracking-widest">
                {drop.eyebrow}
              </span>
              <h2 className="font-display text-4xl sm:text-5xl font-800 tracking-tight mt-3 leading-[1.05]">
                {drop.brand}
                <br />
                <span className="text-white/40">{drop.name}</span>
              </h2>
            </div>

            <p className="text-white/40 leading-relaxed max-w-md">{drop.description}</p>

            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-800 text-white">{euro(drop.price)}</span>
              {drop.oldPrice > 0 && <span className="text-lg text-white/25 line-through">{euro(drop.oldPrice)}</span>}
              {drop.discount && (
                <span className="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full">
                  {drop.discount}
                </span>
              )}
            </div>

            <div>
              <span className="text-white/30 text-xs font-semibold uppercase tracking-wider block mb-3">
                Tailles dispos
              </span>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    className="h-10 min-w-12 rounded-xl bg-white/5 border border-white/10 px-3 text-sm font-semibold text-white/60 hover:bg-accent hover:border-accent hover:text-white transition-all"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <a href="#shop" className="bg-accent hover:bg-accent-light text-white px-8 py-3.5 rounded-full text-sm font-semibold transition-colors flex-1 sm:flex-none text-center">
                Commander →
              </a>
              <a href={settings.whatsappUrl} className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-3.5 rounded-full text-sm font-semibold transition-colors">
                WhatsApp
              </a>
            </div>

            <div className="flex items-center gap-6 pt-2 text-xs text-white/25">
              <span>✓ Paiement WhatsApp</span>
              <span>✓ QC avant envoi</span>
              <span>✓ Tracking</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}