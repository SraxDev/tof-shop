import { useEffect } from 'react';

declare global {
  interface Window {
    twemoji?: {
      parse: (node: HTMLElement, options?: Record<string, unknown>) => void;
    };
  }
}

const APPLE_CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/';

// Some emojis need fe0f in the filename even though twemoji strips it
const FE0F_NEEDED: Record<string, string> = {
  '1f3f7': '1f3f7-fe0f',
};

export function useTwemoji() {
  useEffect(() => {
    // Only run on public shop (admin doesn't need emoji parsing)
    if (window.location.hash === '#admin') return;

    let scheduled = false;
    let parsing = false;

    const scheduleParse = () => {
      if (scheduled || parsing) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (!window.twemoji || !document.body.isConnected) return;
        parsing = true;
        try {
          window.twemoji.parse(document.body, {
            callback: (icon: string) => {
              const filename = FE0F_NEEDED[icon] || icon;
              return APPLE_CDN + filename + '.png';
            },
            ext: '.png',
            className: 'emoji',
          });
        } catch {
          /* ignore detached-node errors from React re-renders */
        }
        parsing = false;
      });
    };

    // Initial parse (twemoji loaded via defer + a little extra wait)
    const t1 = setTimeout(scheduleParse, 200);
    const t2 = setTimeout(scheduleParse, 1000);
    const onLoad = () => scheduleParse();
    window.addEventListener('load', onLoad);

    // Observe DOM mutations, but skip those we ourselves caused (emoji img insertions)
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLElement) {
            // Skip already-parsed emoji images and their containers
            if (node.tagName === 'IMG' && node.classList.contains('emoji')) return;
            // Skip if this is a newly added node whose subtree already has emojis parsed
            if (node.querySelector?.('img.emoji')) return;
          }
          if (node instanceof Text) {
            // Text nodes are fine to parse
            continue;
          }
        }
      }
      scheduleParse();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('load', onLoad);
      observer.disconnect();
    };
  }, []);
}
