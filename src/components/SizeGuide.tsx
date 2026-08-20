import { Ruler, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clothingSizes, guideKindForCategory, pantsSizes, sneakerSizes, type SizeGuideKind } from '../lib/sizeGuide';

const TABS: Array<{ id: Exclude<SizeGuideKind, 'accessory'>; label: string }> = [
  { id: 'sneakers', label: '👟 Sneakers' },
  { id: 'clothing', label: '👕 Hauts' },
  { id: 'pants', label: '👖 Bas' },
];

export default function SizeGuide({ category, onClose }: { category: string; onClose: () => void }) {
  const initial = guideKindForCategory(category);
  const [tab, setTab] = useState<Exclude<SizeGuideKind, 'accessory'>>(
    initial === 'accessory' ? 'clothing' : initial,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-dark/60 sm:backdrop-blur-sm anim-fade-in" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col anim-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Ruler size={18} className="text-accent" />
            <h3 className="font-display text-xl font-800 text-dark">Guide des tailles</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le guide des tailles"
            className="h-10 w-10 rounded-full bg-dark/5 flex items-center justify-center text-dark/40 hover:text-dark hover:bg-dark/10 transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex gap-1.5 px-5 pt-4 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 h-10 rounded-full text-[11px] font-bold transition-colors ${
                tab === t.id ? 'bg-dark text-white' : 'bg-dark/5 text-dark/50 hover:bg-dark/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
          {tab === 'sneakers' && (
            <>
              <p className="text-xs text-dark/45 mb-3 leading-relaxed">
                Mesure ton pied debout, du talon au bout du gros orteil, en fin de journée. Si tu es entre deux
                tailles, prends la plus grande. Les modèles Jordan / Dunk / Air Force taillent normalement (TTS).
              </p>
              <div className="rounded-2xl border border-dark/5 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-bg">
                    <tr className="text-[10px] uppercase tracking-wider text-dark/40">
                      <th className="py-2.5 px-3 text-left font-bold">EU</th>
                      <th className="py-2.5 px-3 text-left font-bold">US</th>
                      <th className="py-2.5 px-3 text-left font-bold">UK</th>
                      <th className="py-2.5 px-3 text-left font-bold">Pied (cm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sneakerSizes.map((r, i) => (
                      <tr key={r.eu} className={i % 2 ? 'bg-bg/50' : 'bg-white'}>
                        <td className="py-2 px-3 font-bold text-dark">{r.eu}</td>
                        <td className="py-2 px-3 text-dark/60">{r.us}</td>
                        <td className="py-2 px-3 text-dark/60">{r.uk}</td>
                        <td className="py-2 px-3 text-dark/60">{r.cm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'clothing' && (
            <>
              <p className="text-xs text-dark/45 mb-3 leading-relaxed">
                Mesures à plat en cm. Les hoodies et tees streetwear ont une coupe oversize : si tu veux un fit
                ajusté, prends une taille en dessous.
              </p>
              <div className="rounded-2xl border border-dark/5 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-bg">
                    <tr className="text-[10px] uppercase tracking-wider text-dark/40">
                      <th className="py-2.5 px-3 text-left font-bold">Taille</th>
                      <th className="py-2.5 px-3 text-left font-bold">Poitrine</th>
                      <th className="py-2.5 px-3 text-left font-bold">Tour de taille</th>
                      <th className="py-2.5 px-3 text-left font-bold">Longueur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clothingSizes.map((r, i) => (
                      <tr key={r.size} className={i % 2 ? 'bg-bg/50' : 'bg-white'}>
                        <td className="py-2 px-3 font-bold text-dark">{r.size}</td>
                        <td className="py-2 px-3 text-dark/60">{r.chest}</td>
                        <td className="py-2 px-3 text-dark/60">{r.waist}</td>
                        <td className="py-2 px-3 text-dark/60">{r.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'pants' && (
            <>
              <p className="text-xs text-dark/45 mb-3 leading-relaxed">
                Les jeans et joggings sont donnés en taille US (28 à 38). Mesure ton tour de taille au niveau du
                nombril, sans serrer.
              </p>
              <div className="rounded-2xl border border-dark/5 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-bg">
                    <tr className="text-[10px] uppercase tracking-wider text-dark/40">
                      <th className="py-2.5 px-3 text-left font-bold">Taille</th>
                      <th className="py-2.5 px-3 text-left font-bold">Tour de taille</th>
                      <th className="py-2.5 px-3 text-left font-bold">Longueur totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pantsSizes.map((r, i) => (
                      <tr key={r.size} className={i % 2 ? 'bg-bg/50' : 'bg-white'}>
                        <td className="py-2 px-3 font-bold text-dark">{r.size}</td>
                        <td className="py-2 px-3 text-dark/60">{r.waist}</td>
                        <td className="py-2 px-3 text-dark/60">{r.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="mt-4 rounded-2xl bg-[#FFFC00]/12 border border-[#FFFC00]/25 px-4 py-3 text-[11px] font-semibold text-[#8a8000] leading-relaxed">
            👻 Un doute sur ta taille ? Envoie-moi ta pointure ou tes mensurations sur Snap @tofh2b — je te réponds
            en ~5 min.
          </div>
        </div>
      </div>
    </div>
  );
}
