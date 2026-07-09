// src/components/ui/ChipPickers.tsx
// Chip-based pickers for sizes/colors. Toggle chips to build a comma-separated list.
// Works with both light (bg) and dark themes.

import { cn } from '../../utils/cn';
import { X, Plus } from 'lucide-react';
import { useState } from 'react';

type Theme = 'dark' | 'light';

const SIZE_PRESETS: Record<string, string[]> = {
  // Clothing
  clothing: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  // Sneakers
  sneakers: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  // Slides / Claquettes
  slides: ['39', '40', '41', '42', '43', '44', '45'],
  // Kids/Other
  kids: ['28', '30', '32', '34', '36'],
};

const COLOR_QUICK = ['Black', 'White', 'Grey', 'Beige', 'Brown', 'Navy', 'Red', 'Green', 'Blue', 'Pink', 'Cream', 'Khaki'];

function parseList(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}
function joinList(arr: string[]): string {
  return arr.join(', ');
}

/**
 * Guess the right preset of sizes based on the selected admin category name.
 */
export function getSizePresetForCategory(category: string): string[] {
  const c = (category || '').toLowerCase();
  if (!c) return SIZE_PRESETS.clothing;
  if (c.includes('sneaker') || c.includes('chaussure')) return SIZE_PRESETS.sneakers;
  if (c.includes('claquette') || c.includes('tong')) return SIZE_PRESETS.slides;
  // No sizes for pure accessories
  if (/(casquette|bonnet|ceinture|lunettes|bijou|sac|portefeuille|montre|écharpe|echarpe|parfum)/i.test(c)) return [];
  return SIZE_PRESETS.clothing;
}

type ChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  theme: Theme;
};

function Chip({ label, active, onClick, theme }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 min-w-[40px] px-3 rounded-xl border-2 text-xs font-bold transition-all active:scale-95 select-none',
        theme === 'dark'
          ? active
            ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
            : 'bg-white/5 text-white/70 border-white/10 hover:border-white/30 hover:text-white'
          : active
            ? 'bg-dark text-white border-dark shadow-md shadow-dark/20'
            : 'bg-white text-dark/70 border-dark/10 hover:border-dark/30 hover:text-dark',
      )}
    >
      {label}
    </button>
  );
}

export function SizePicker({
  value,
  onChange,
  category,
  theme = 'dark',
}: {
  value: string;
  onChange: (v: string) => void;
  category?: string;
  theme?: Theme;
}) {
  const selected = useMemoSorted(parseList(value));
  const preset = getSizePresetForCategory(category || '');
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const toggle = (s: string) => {
    const set = new Set(selected);
    set.has(s) ? set.delete(s) : set.add(s);
    onChange(joinList(Array.from(set)));
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!selected.includes(v)) onChange(joinList([...selected, v]));
    setCustom('');
    setCustomOpen(false);
  };

  if (preset.length === 0) {
    return (
      <div className={cn('rounded-xl border px-3 py-2.5 text-xs flex items-center gap-2',
        theme === 'dark' ? 'border-white/10 bg-white/5 text-white/40' : 'border-dark/10 bg-bg text-dark/40',
      )}>
        <span>Pas de tailles pour cette catégorie.</span>
        <button
          type="button"
          onClick={() => onChange('Unique')}
          className={cn('ml-auto underline-offset-2 hover:underline text-[11px] font-bold',
            theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-dark/50 hover:text-dark',
          )}
        >
          Mettre "Unique"
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {preset.map((s) => (
          <Chip key={s} label={s} active={selected.includes(s)} onClick={() => toggle(s)} theme={theme} />
        ))}
        {selected
          .filter((s) => !preset.includes(s))
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={cn(
                'h-9 min-w-[40px] px-3 rounded-xl border-2 text-xs font-bold transition-all active:scale-95 inline-flex items-center gap-1',
                theme === 'dark'
                  ? 'bg-accent text-white border-accent pr-2'
                  : 'bg-dark text-white border-dark pr-2',
              )}
            >
              {s}
              <X size={10} />
            </button>
          ))}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className={cn(
            'h-9 w-9 rounded-xl border-2 border-dashed text-xs font-bold transition-all inline-flex items-center justify-center',
            theme === 'dark'
              ? 'border-white/15 text-white/40 hover:text-white hover:border-white/30'
              : 'border-dark/15 text-dark/40 hover:text-dark hover:border-dark/30',
          )}
          aria-label="Ajouter une taille"
        >
          <Plus size={14} />
        </button>
      </div>
      {customOpen && (
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
            placeholder="Taille personnalisée (ex: TU, 47)"
            className={cn(
              'flex-1 rounded-xl border px-3 py-2 text-xs outline-none',
              theme === 'dark'
                ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-accent/40'
                : 'bg-white border-dark/10 text-dark placeholder:text-dark/30 focus:border-accent/40',
            )}
            autoFocus
          />
          <button
            type="button"
            onClick={addCustom}
            className="h-9 px-3 rounded-xl bg-accent text-white text-xs font-bold active:scale-95 transition-transform"
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

// Keep order of selected array stable (preserve insertion order)
function useMemoSorted<T>(arr: T[]) {
  return arr;
}

export function ColorPicker({
  value,
  onChange,
  theme = 'dark',
}: {
  value: string;
  onChange: (v: string) => void;
  theme?: Theme;
}) {
  const selected = parseList(value);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const toggle = (c: string) => {
    const set = new Set(selected);
    set.has(c) ? set.delete(c) : set.add(c);
    onChange(joinList(Array.from(set)));
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!selected.includes(v)) onChange(joinList([...selected, v]));
    setCustom('');
    setCustomOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {COLOR_QUICK.map((c) => (
          <Chip key={c} label={c} active={selected.includes(c)} onClick={() => toggle(c)} theme={theme} />
        ))}
        {selected
          .filter((c) => !COLOR_QUICK.map((q) => q.toLowerCase()).includes(c.toLowerCase()))
          .map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className={cn(
                'h-9 px-3 rounded-xl border-2 text-xs font-bold transition-all active:scale-95 inline-flex items-center gap-1',
                theme === 'dark'
                  ? 'bg-accent text-white border-accent pr-2'
                  : 'bg-dark text-white border-dark pr-2',
              )}
            >
              {c}
              <X size={10} />
            </button>
          ))}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className={cn(
            'h-9 w-9 rounded-xl border-2 border-dashed text-xs font-bold transition-all inline-flex items-center justify-center',
            theme === 'dark'
              ? 'border-white/15 text-white/40 hover:text-white hover:border-white/30'
              : 'border-dark/15 text-dark/40 hover:text-dark hover:border-dark/30',
          )}
          aria-label="Ajouter une couleur"
        >
          <Plus size={14} />
        </button>
      </div>
      {customOpen && (
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
            placeholder="Couleur personnalisée (ex: Orange, Camel)"
            className={cn(
              'flex-1 rounded-xl border px-3 py-2 text-xs outline-none',
              theme === 'dark'
                ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-accent/40'
                : 'bg-white border-dark/10 text-dark placeholder:text-dark/30 focus:border-accent/40',
            )}
            autoFocus
          />
          <button
            type="button"
            onClick={addCustom}
            className="h-9 px-3 rounded-xl bg-accent text-white text-xs font-bold active:scale-95 transition-transform"
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
