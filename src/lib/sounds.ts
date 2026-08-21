// Sons générés en temps réel via la Web Audio API (aucun fichier externe).
// Chaque son est une « cloche » : fondamentale + harmonique, attaque rapide
// et décroissance douce — bien plus agréable qu'un simple bip.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
    }
    // Certains navigateurs démarrent le contexte en « suspended » tant qu'il n'y
    // a pas eu de geste utilisateur : on tente de le réveiller.
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Joue une note « cloche » : un oscillateur principal + une harmonique plus
 * douce qui s'éteint vite (donne le côté cristallin), avec une enveloppe
 * attaque rapide → décroissance exponentielle.
 */
function chime(
  ctx: AudioContext,
  freq: number,
  when: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  harmonicRatio = 2,
) {
  // Note principale
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.008); // attaque nette
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration); // décroissance
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.05);

  // Harmonique (plus courte et plus légère) → brillance
  const harm = ctx.createOscillator();
  harm.type = 'sine';
  harm.frequency.value = freq * harmonicRatio;
  const hGain = ctx.createGain();
  hGain.gain.setValueAtTime(0.0001, when);
  hGain.gain.linearRampToValueAtTime(volume * 0.35, when + 0.005);
  hGain.gain.exponentialRampToValueAtTime(0.0001, when + duration * 0.55);
  harm.connect(hGain);
  hGain.connect(ctx.destination);
  harm.start(when);
  harm.stop(when + duration + 0.05);
}

/** Son doux et grave, pour les erreurs / suppressions (type « thud »). */
function thud(
  ctx: AudioContext,
  freq: number,
  when: number,
  duration: number,
  volume: number,
) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, when);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, when + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(volume, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.05);
}

/** ✅ Succès : « ding-dong » lumineux (E5 → A5). */
export function playSuccess() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  chime(ctx, 659.25, t, 0.5, 0.16); // Mi
  chime(ctx, 880.0, t + 0.09, 0.7, 0.14); // La
}

/** 🔔 Nouvelle commande : arpège ascendant satisfaisant (C5 → E5 → G5 → C6). */
export function playNewOrder() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  chime(ctx, 523.25, t, 0.5, 0.15); // Do
  chime(ctx, 659.25, t + 0.1, 0.55, 0.15); // Mi
  chime(ctx, 783.99, t + 0.2, 0.65, 0.15); // Sol
  chime(ctx, 1046.5, t + 0.3, 0.9, 0.12); // Do aigu (résolution)
}

/** ⚠️ Erreur : deux notes graves descendantes, sans agressivité. */
export function playError() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  thud(ctx, 330, t, 0.22, 0.14);
  thud(ctx, 247, t + 0.16, 0.3, 0.13);
}

/** ℹ️ Attention : double note douce, neutre. */
export function playWarning() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  chime(ctx, 587.33, t, 0.35, 0.1, 'triangle');
  chime(ctx, 587.33, t + 0.18, 0.35, 0.1, 'triangle');
}

/** 📋 Copié : petit « tick » discret. */
export function playCopy() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  chime(ctx, 1318.5, t, 0.18, 0.07);
}

/** 🗑️ Supprimé : « thud » doux qui descend. */
export function playDelete() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  thud(ctx, 392, t, 0.22, 0.12);
}
