import { useEffect, useRef, useState } from 'react';

type Options = {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
};

export function useInView<T extends HTMLElement = HTMLElement>(
  thresholdOrOptions: number | Options = 0.1,
) {
  const opts: Options =
    typeof thresholdOrOptions === 'number'
      ? { threshold: thresholdOrOptions, once: true }
      : { threshold: 0.1, once: true, ...thresholdOrOptions };

  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (opts.once === false) setIsInView(false);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (opts.once !== false) observer.unobserve(el);
        } else if (opts.once === false) {
          setIsInView(false);
        }
      },
      { threshold: opts.threshold, rootMargin: opts.rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.threshold, opts.rootMargin, opts.once]);

  return { ref, isInView };
}
