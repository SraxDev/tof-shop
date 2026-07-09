import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'accent' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    confirmBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prevFocus?.focus?.();
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const confirmTone =
    tone === 'danger' ? 'bg-red-500 hover:bg-red-600' :
    tone === 'accent' ? 'bg-accent hover:bg-accent/90' :
    'bg-dark hover:bg-dark/90';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white text-dark p-6 shadow-2xl shadow-black/40">
        <button
          onClick={onCancel}
          aria-label="Fermer"
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-dark/5 hover:bg-dark/10 inline-flex items-center justify-center text-dark/50"
        >
          <X size={14} />
        </button>
        <h3 id="confirm-dialog-title" className="font-display text-lg font-800">{title}</h3>
        {message && <p className="mt-2 text-sm text-dark/55 leading-relaxed">{message}</p>}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full bg-dark/5 hover:bg-dark/10 px-4 py-2 text-sm font-semibold text-dark/60 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-sm font-bold text-white transition-colors ${confirmTone}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
