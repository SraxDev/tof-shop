const ctx = () => new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

function beep(frequency: number, duration: number, volume = 0.15, type: OscillatorType = 'sine') {
  try {
    const audioCtx = ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // Audio not supported
  }
}

export function playSuccess() {
  beep(880, 0.12, 0.12);
  setTimeout(() => beep(1100, 0.15, 0.1), 100);
}

export function playNewOrder() {
  beep(660, 0.15, 0.15);
  setTimeout(() => beep(880, 0.15, 0.13), 120);
  setTimeout(() => beep(1100, 0.2, 0.12), 240);
}

export function playError() {
  beep(300, 0.2, 0.15, 'square');
  setTimeout(() => beep(250, 0.25, 0.12, 'square'), 150);
}

export function playWarning() {
  beep(500, 0.15, 0.1, 'triangle');
  setTimeout(() => beep(500, 0.15, 0.1, 'triangle'), 200);
}

export function playCopy() {
  beep(1200, 0.08, 0.08);
}

export function playDelete() {
  beep(400, 0.12, 0.1, 'sawtooth');
}
