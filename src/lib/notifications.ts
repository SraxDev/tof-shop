// src/lib/notifications.ts
// Notifications navigateur pour l'admin : une nouvelle commande ou un message chat
// apparaît même si l'onglet est en arrière-plan (ou le téléphone verrouillé sur Android).

const STORAGE_KEY = 'tof-admin-notifications';

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function currentPermission(): NotifPermission {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission as NotifPermission;
}

/** L'admin a-t-il activé les notifications dans le panel ? */
export function notificationsEnabled(): boolean {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  return localStorage.getItem(STORAGE_KEY) !== 'off';
}

export function setNotificationsEnabled(on: boolean) {
  localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
}

/** Demande la permission au navigateur. Retourne le nouvel état. */
export async function requestNotifications(): Promise<NotifPermission> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') {
    setNotificationsEnabled(true);
    return 'granted';
  }
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') setNotificationsEnabled(true);
    return result as NotifPermission;
  } catch {
    return 'denied';
  }
}

/**
 * Affiche une notification. Silencieuse si l'onglet est déjà au premier plan
 * (le toast + le son suffisent dans ce cas).
 * Ajoute une vibration sur mobile (Android) pour un retour tactile.
 */
export function notify(title: string, body: string, tag?: string) {
  if (!notificationsEnabled()) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

  // Vibration (Android) : deux impulsions courtes pour les commandes, une pour le reste.
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(tag === 'order' ? [120, 60, 120] : 80);
    }
  } catch {
    /* ignore */
  }

  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag,
      // Une commande ne doit pas disparaître toute seule.
      requireInteraction: tag === 'order',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Certains navigateurs mobiles exigent un ServiceWorker : on ignore silencieusement.
  }
}
