/**
 * Sound Effects Engine using Web Audio API
 * Generates rich, resonant hotel bell chimes for incoming room service orders.
 * 100% offline-ready with zero external audio assets or network dependencies.
 */

let audioCtx: AudioContext | null = null;
let isSoundMuted = false;
const activeBellOscillators = new Set<OscillatorNode>();

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/**
 * Resumes audio context if suspended by browser autoplay policy.
 * Call this on any user interaction (touch, click, keydown).
 */
export async function unlockAudio(): Promise<boolean> {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      return (ctx.state as string) === 'running';
    } catch {
      return false;
    }
  }
  return (ctx.state as string) === 'running';
}

export function isAudioMuted(): boolean {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('pos_sound_muted');
    if (saved !== null) {
      isSoundMuted = saved === 'true';
    }
  }
  return isSoundMuted;
}

export function setAudioMuted(muted: boolean): void {
  isSoundMuted = muted;
  if (muted) stopAllChimes();
  if (typeof window !== 'undefined') {
    localStorage.setItem('pos_sound_muted', muted ? 'true' : 'false');
  }
}

/** Immediately cancels any currently ringing bell tones. */
export function stopAllChimes(): void {
  for (const oscillator of activeBellOscillators) {
    try { oscillator.stop(); } catch { /* already stopped */ }
  }
  activeBellOscillators.clear();
}

export function getAudioState(): 'running' | 'suspended' | 'muted' | 'unavailable' {
  if (isAudioMuted()) return 'muted';
  const ctx = getOrCreateAudioContext();
  if (!ctx) return 'unavailable';
  return ctx.state as 'running' | 'suspended';
}

/**
 * Plays a resonant, 2-tone hotel bell chime (C5 & G5)
 * Distinct, pleasant, and impossible to miss in a busy kitchen/restaurant.
 */
export async function playRoomServiceChime(): Promise<void> {
  if (isAudioMuted()) return;

  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return; // Autoplay blocked until operator interacts
    }
  }

  const now = ctx.currentTime;

  // Primary tone: C5 (523.25 Hz)
  createBellTone(ctx, 523.25, now, 1.2, 0.45);
  // Overtone: C6 (1046.5 Hz) harmonic for metallic ring
  createBellTone(ctx, 1046.5, now, 0.8, 0.15);

  // Secondary tone: G5 (783.99 Hz) played 160ms later
  createBellTone(ctx, 783.99, now + 0.16, 1.4, 0.5);
  // Overtone: G6 (1567.98 Hz)
  createBellTone(ctx, 1567.98, now + 0.16, 0.9, 0.15);
}

/**
 * Plays a quick 2-note positive confirmation chime when order is accepted.
 */
export async function playOrderAcknowledgedChime(): Promise<void> {
  if (isAudioMuted()) return;

  const ctx = getOrCreateAudioContext();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  createBellTone(ctx, 659.25, now, 0.4, 0.25); // E5
  createBellTone(ctx, 880.00, now + 0.1, 0.6, 0.3); // A5
}

function createBellTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  peakGain: number
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    // Envelope: Sharp instant attack, natural bell exponential decay
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    activeBellOscillators.add(osc);
    osc.addEventListener('ended', () => activeBellOscillators.delete(osc), { once: true });

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  } catch {
    // Ignore audio graph errors
  }
}
