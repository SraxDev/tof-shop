import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { playSuccess, playError, playWarning } from '../lib/sounds';

export type ToastType = 'success' | 'error' | 'warning';

type ToastData = {
  id: number;
  message: string;
  type: ToastType;
  sound?: boolean;
};

let toastId = 0;
const listeners: Set<(t: ToastData) => void> = new Set();

export function showToast(message: string, type: ToastType = 'success', sound = true) {
  const data: ToastData = { id: ++toastId, message, type, sound };
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
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== t.id));
      }, 3000);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl text-sm font-semibold anim-fade-up ${
            t.type === 'success' ? 'bg-green-500 text-white' :
            t.type === 'error' ? 'bg-red-500 text-white' :
            'bg-amber-400 text-dark'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 size={18} />}
          {t.type === 'error' && <X size={18} />}
          {t.type === 'warning' && <AlertTriangle size={18} />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))} className="opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
