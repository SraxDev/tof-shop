import { useEffect, useState } from 'react';

/**
 * Retarde la mise à jour d'une valeur pendant `delay` ms après la dernière
 * saisie. Utile pour éviter de filtrer/rechercher à chaque frappe.
 */
export function useDebounce<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
