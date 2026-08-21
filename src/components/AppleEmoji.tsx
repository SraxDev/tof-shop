import { useState } from 'react';

const APPLE_CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/';

// Map of emoji character to its unicode codepoint filename
const EMOJI_MAP: Record<string, string> = {
  '👟': '1f45f',
  '👕': '1f455',
  '🧥': '1f9e5',
  '👜': '1f45c',
  '🧢': '1f9e2',
  '👖': '1f456',
  '🔥': '1f525',
  '📦': '1f4e6',
  '🔄': '1f504',
  '💬': '1f4ac',
  '💎': '1f48e',
  '🛒': '1f6d2',
  '🏷️': '1f3f7-fe0f',
  '🤙': '1f919',
  '🔔': '1f514',
  '🚀': '1f680',
  '📸': '1f4f8',
  '🎵': '1f3b5',
};

interface AppleEmojiProps {
  emoji: string;
  size?: number;
  className?: string;
}

export default function AppleEmoji({ emoji, size = 32, className = '' }: AppleEmojiProps) {
  const [failed, setFailed] = useState(false);
  const code = EMOJI_MAP[emoji];

  // Pas de correspondance, ou le CDN a échoué : on affiche l'emoji natif
  // (l'appareil a toujours un rendu, même sans réseau tiers).
  if (!code || failed) {
    return (
      <span className={className} style={{ fontSize: size, lineHeight: 1 }} role="img" aria-label={emoji}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`${APPLE_CDN}${code}.png`}
      alt={emoji}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
