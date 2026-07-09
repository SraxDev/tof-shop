import { CheckCircle2, AlertTriangle, Undo2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { playSuccess, playError, playWarning } from '../lib/sounds';

export type ToastType = 'success' | 'error' | 'warning';

type ToastData = {
  id: number;
  message: string;
  type: ToastType;
  sound?: boolean;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
};

let toastId = 0;
const listeners: Set<(t: ToastData) => void> = new Set();

export function showToast(
  message: string,
  type: ToastType = 'success',
  sound = true,
) {
  const data: ToastData = { id: ++toastId, message, type, sound, duration: 3000 };
  listeners.forEach((fn) => fn(data));
}

/**
 * Toast persistant (ex: suppression avec annulation) : reste jusqu'à timeout
 * ou clic sur l'action / croix.
 */
export function showActionToast(
  message: string,
  actionLabel: string,
  onAction: () => void,
  duration = 6000,
) {
  const data: ToastData = {
    id: ++toastId,
    message,
    type: 'warning',
    sound: false,
    duration,
    actionLabel,
    onAction,
  };
  listeners.forEach((fn) => fn(data));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const handler = (t: ToastData) => {
      setToasts((prev) => [...prev, t]);
      if (t.sound !== false) {
        if (t.type === 'success') playSuccess();
        if (t.type === 'error') playError();
        if (t.type === 'warning') playWarning();
      }
      const duration = t.duration ?? 3000;
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== t.id));
        }, duration);
      }
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 sm:top-4 sm:bottom-auto right-4 z-[110] flex flex-col-reverse sm:flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl text-sm font-semibold anim-fade-up ${
            t.type === 'success' ? 'bg-green-500 text-white' :
            t.type === 'error' ? 'bg-red-500 text-white' :
            'bg-neutral-800 text-white border border-white/10'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 size={18} className="flex-shrink-0" />}
          {t.type === 'error' && <X size={18} className="flex-shrink-0" />}
          {t.type === 'warning' && !t.onAction && <AlertTriangle size={18} className="flex-shrink-0" />}
          {t.onAction && <Undo2 size={18} className="flex-shrink-0" />}
          <span className="flex-1 min-w-0">{t.message}</span>
          {t.onAction && t.actionLabel && (
            <button
              onClick={() => {
                t.onAction?.();
                dismiss(t.id);
              }}
              className="text-accent font-800 text-xs uppercase tracking-wider hover:text-white transition-colors flex-shrink-0"
            >
              {t.actionLabel}
            </button>
          )}
          <button
            onClick={() => dismiss(t.id)}
            className="opacity-60 hover:opacity-100 flex-shrink-0"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
