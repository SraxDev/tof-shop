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
    const parse = () => {
      if (window.twemoji) {
        window.twemoji.parse(document.body, {
          callback: (icon: string) => {
            const filename = FE0F_NEEDED[icon] || icon;
            return APPLE_CDN + filename + '.png';
          },
          ext: '.png',
        });
      }
    };

    // Initial parse after a short delay to ensure DOM is rendered
    const timeout = setTimeout(parse, 100);

    // Re-parse on DOM changes (for dynamic content like state changes)
    const observer = new MutationObserver(() => {
      requestAnimationFrame(parse);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);
}
