import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import {
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';
import { compressImages } from '../utils/compressImage';
import { showToast } from './Toast';
import { cn } from '../utils/cn';

/**
 * Parse une chaîne "url1 | url2 | url3" (séparateur pipe) et
 * retourne un tableau d'URLs nettoyées (pas de vide, trim).
 */
export function parseImageList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Sérialise un tableau d'URLs en une string séparée par "|". */
export function serializeImageList(urls: string[]): string {
  return urls.join('|');
}

/** Signature du handler d'upload : fichier compressé → URL publique. */
export type ImageUploadHandler = (file: File) => Promise<string>;

type UploaderStatus = 'idle' | 'compressing' | 'uploading' | 'ready';

type ImageUploaderProps = {
  /** URLs déjà présentes (pipe-separated) — contrôlé. */
  value: string;
  /** Appelé avec la nouvelle valeur pipe-separated. */
  onChange: (next: string) => void;
  /** Désactive tous les contrôles. */
  disabled?: boolean;
  /**
   * Handler d'upload. Fourni, les fichiers sélectionnés / drop / collés
   * sont compressés puis envoyés via ce handler (ex: upload Supabase
   * Storage). Non fourni, on stocke les data URLs base64 (comportement
   * historique / fallback dev).
   */
  uploadHandler?: ImageUploadHandler;
  /** Côté max en px pour la compression (défaut 800). */
  maxSize?: number;
  /** Qualité JPEG 0..1 (défaut 0.75). */
  quality?: number;
  /** Autorise plusieurs images (défaut true). */
  multiple?: boolean;
  /** Étiquette du champ. */
  label?: string;
  /** Texte d'aide. */
  hint?: string;
  /** Hauteur maximale de la zone de drop. */
  dropHeightClass?: string;
};

/**
 * Composant d'upload d'images produit, pensé pour l'admin :
 * - Glisser-déposer
 * - Coller depuis le presse-papier (Ctrl+V / Cmd+V) quand la zone a le focus
 * - Upload fichier multiple
 * - Compression automatique avec feedback visuel (compression… / upload…)
 * - Coller une URL directe
 * - Miniatures cliquables avec suppression individuelle
 * - Réordonnancement des images par drag (pour correspondre à l'ordre des coloris)
 * - Lightbox au clic
 *
 * Peut fonctionner en mode "data URL" (historique) ou via un
 * `uploadHandler` asynchrone (Supabase Storage recommandé).
 */
export default function ImageUploader({
  value,
  onChange,
  disabled = false,
  uploadHandler,
  maxSize = 800,
  quality = 0.75,
  multiple = true,
  label = 'Images produit',
  hint,
  dropHeightClass = 'min-h-[120px]',
}: ImageUploaderProps) {
  const inputId = useId();
  const urlInputId = useId();
  const dropRef = useRef<HTMLDivElement>(null);

  const urls = useRef(parseImageList(value));
  const serializedValue = useRef(value);
  if (serializedValue.current !== value) {
    serializedValue.current = value;
    urls.current = parseImageList(value);
  }

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [status, setStatus] = useState<UploaderStatus>('idle');
  const [urlField, setUrlField] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const commit = useCallback(
    (next: string[]) => {
      const unique: string[] = [];
      const seen = new Set<string>();
      for (const u of next) {
        if (!u || seen.has(u)) continue;
        seen.add(u);
        unique.push(u);
      }
      urls.current = unique;
      const serialized = serializeImageList(unique);
      serializedValue.current = serialized;
      onChange(serialized);
    },
    [onChange],
  );

  const processFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (disabled || !files || files.length === 0) return;
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (list.length === 0) {
        showToast('Seules les images sont acceptées');
        return;
      }
      const picked = multiple ? list : [list[0]];

      let finalUrls: string[] = [];

      if (uploadHandler) {
        // L'handler gère sa compression lui-même (ex: storage.uploadProductImage).
        setStatus('uploading');
        try {
          for (let i = 0; i < picked.length; i += 1) {
            const url = await uploadHandler(picked[i]);
            finalUrls.push(url);
          }
        } catch {
          showToast("Erreur lors de l'upload des images");
          setStatus('idle');
          const input = document.getElementById(inputId) as HTMLInputElement | null;
          if (input) input.value = '';
          return;
        }
      } else {
        // Mode historique : compression client puis data URL.
        setStatus('compressing');
        try {
          finalUrls = await compressImages(picked, maxSize, quality);
        } catch {
          showToast('Erreur lors du traitement des images');
          setStatus('idle');
          return;
        }
      }

      const next = multiple ? [...urls.current, ...finalUrls] : [finalUrls[0]];
      commit(next);
      setStatus('ready');

      const input = document.getElementById(inputId) as HTMLInputElement | null;
      if (input) input.value = '';
    },
    [commit, disabled, inputId, maxSize, multiple, quality, uploadHandler],
  );

  const addUrl = useCallback(() => {
    const trimmed = urlField.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('data:')) {
      showToast('URL invalide (doit commencer par http(s)://)');
      return;
    }
    const next = multiple ? [...urls.current, trimmed] : [trimmed];
    commit(next);
    setUrlField('');
  }, [commit, multiple, urlField]);

  const removeAt = useCallback(
    (index: number) => {
      const next = urls.current.slice();
      next.splice(index, 1);
      commit(next);
    },
    [commit],
  );

  const clearAll = useCallback(() => commit([]), [commit]);

  // ── Drag & drop zone ─────────────────────────────────────
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      if (disabled) return;

      // Si des URLs texte sont drop (ex: depuis un navigateur) :
      const text = e.dataTransfer.getData('text/plain');
      if (text && /^https?:\/\//i.test(text.trim())) {
        const parts = text
          .split(/[\s|]+/)
          .map((s) => s.trim())
          .filter((s) => /^https?:\/\//i.test(s));
        if (parts.length > 0) {
          const next = multiple ? [...urls.current, ...parts] : [parts[0]];
          commit(next);
          return;
        }
      }

      void processFiles(e.dataTransfer.files);
    },
    [commit, disabled, multiple, processFiles],
  );

  // ── Coller depuis le presse-papier ───────────────────────
  useEffect(() => {
    const onPaste = (e: Event) => {
      if (disabled) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      ) {
        // On ne capture pas le paste quand un champ a le focus : on
        // garde le comportement natif (coller une URL dans un champ).
        return;
      }
      const event = e as unknown as globalThis.ClipboardEvent;
      const items = event.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        event.preventDefault();
        void processFiles(files);
      }
    };

    const dropEl = dropRef.current;
    if (dropEl) dropEl.addEventListener('paste', onPaste);
    return () => {
      if (dropEl) dropEl.removeEventListener('paste', onPaste);
    };
  }, [disabled, processFiles]);

  // ── Réordonnancement des miniatures ──────────────────────
  const onThumbDragStart = (index: number) => (e: DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const onThumbDragOver = (index: number) => (e: DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const current = urls.current.slice();
    const [moved] = current.splice(draggedIndex, 1);
    current.splice(index, 0, moved);
    urls.current = current;
    setDraggedIndex(index);
    const serialized = serializeImageList(current);
    serializedValue.current = serialized;
    onChange(serialized);
  };

  const onThumbDragEnd = () => setDraggedIndex(null);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void processFiles(e.target.files);
  };

  const currentUrls = parseImageList(value);
  const busy = status === 'compressing' || status === 'uploading';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-dark/35 font-semibold">
          {label}
          {multiple && currentUrls.length > 0 && (
            <span className="ml-2 text-dark/25 font-normal">
              ({currentUrls.length})
            </span>
          )}
        </label>
        {currentUrls.length > 0 && !disabled && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            Tout vider
          </button>
        )}
      </div>

      {/* Zone de drop */}
      <div
        ref={dropRef}
        tabIndex={0}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl border-2 border-dashed outline-none transition-all',
          'flex flex-col items-center justify-center gap-2 px-4 py-6 text-center cursor-pointer select-none',
          dropHeightClass,
          isDraggingOver
            ? 'border-accent bg-accent/5'
            : 'border-dark/10 bg-bg/50 hover:border-dark/20 hover:bg-bg',
          disabled && 'opacity-50 cursor-not-allowed',
          busy && 'pointer-events-none',
        )}
        onClick={() => {
          if (disabled || busy) return;
          document.getElementById(inputId)?.click();
        }}
        role="button"
        aria-label="Ajouter des images"
      >
        {busy ? (
          <>
            <Loader2 className="h-7 w-7 text-accent animate-spin" />
            <div className="text-sm font-semibold text-dark/60">
              {status === 'compressing' ? 'Compression des images…' : 'Upload en cours…'}
            </div>
            <div className="text-[11px] text-dark/35">
              {status === 'compressing'
                ? 'Redimensionnement et optimisation.'
                : 'Envoi vers le stockage, ne ferme pas.'}
            </div>
          </>
        ) : (
          <>
            <UploadCloud className="h-7 w-7 text-dark/30" />
            <div className="text-sm font-semibold text-dark/70">
              <span className="text-accent">Clique pour uploader</span> ou glisse-dépose
            </div>
            <div className="text-[11px] text-dark/35 leading-relaxed max-w-xs">
              {multiple ? 'Plusieurs fichiers acceptés.' : 'Un seul fichier.'}{' '}
              Tu peux aussi{' '}
              <kbd className="rounded bg-dark/10 px-1 py-0.5 text-[10px] font-bold">
                Ctrl&nbsp;V
              </kbd>{' '}
              une image copiée.
            </div>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple={multiple}
          disabled={disabled || busy}
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* Coller une URL */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <label htmlFor={urlInputId} className="sr-only">
            Ajouter par URL
          </label>
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dark/25" />
            <input
              id={urlInputId}
              type="url"
              value={urlField}
              onChange={(e) => setUrlField(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addUrl();
                }
              }}
              placeholder="Ou colle une URL d'image (https://…)"
              className="w-full rounded-xl bg-bg px-4 py-2 pl-8 text-xs text-dark outline-none border border-dark/5 focus:border-accent/40"
            />
          </div>
          <button
            type="button"
            onClick={addUrl}
            disabled={!urlField.trim() || busy}
            className="rounded-xl bg-dark/5 px-3 py-2 text-[11px] font-bold text-dark/60 hover:bg-dark/10 disabled:opacity-40 transition-colors"
          >
            Ajouter URL
          </button>
        </div>
      )}

      {hint && <p className="text-[10px] text-dark/30">{hint}</p>}

      {/* Miniatures */}
      {currentUrls.length > 0 && (
        <div className="pt-1">
          <div className="flex flex-wrap gap-2">
            {currentUrls.map((url, index) => (
              <div
                key={`${url.slice(0, 40)}-${index}`}
                draggable={!disabled}
                onDragStart={onThumbDragStart(index)}
                onDragOver={onThumbDragOver(index)}
                onDragEnd={onThumbDragEnd}
                className={cn(
                  'group/thumb relative h-20 w-20 rounded-xl overflow-hidden bg-subtle border border-dark/10',
                  'transition-transform',
                  draggedIndex === index && 'opacity-40 scale-95',
                )}
                title={`Photo ${index + 1} — glisse pour réordonner`}
              >
                <img
                  src={url}
                  alt={`Photo ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover cursor-zoom-in"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewUrl(url);
                  }}
                  draggable={false}
                />
                <div className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {index + 1}
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAt(index);
                    }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow opacity-0 group-hover/thumb:opacity-100 focus:opacity-100 transition-opacity"
                    aria-label={`Supprimer la photo ${index + 1}`}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
            {multiple && !disabled && !busy && (
              <button
                type="button"
                onClick={() => document.getElementById(inputId)?.click()}
                className="h-20 w-20 rounded-xl border-2 border-dashed border-dark/10 bg-bg/40 flex flex-col items-center justify-center text-dark/30 hover:text-accent hover:border-accent/40 transition-colors"
                aria-label="Ajouter une autre image"
              >
                <ImagePlus size={18} />
                <span className="text-[9px] font-bold mt-1">Ajouter</span>
              </button>
            )}
          </div>
          {multiple && (
            <p className="mt-2 text-[10px] text-dark/30">
              Glisse les vignettes pour les réordonner — l'ordre correspond aux coloris ci-dessus.
            </p>
          )}
        </div>
      )}

      {/* Lightbox preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setPreviewUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewUrl(null);
            }}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
          <img
            src={previewUrl}
            alt="Aperçu"
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
