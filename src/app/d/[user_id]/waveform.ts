// A DECORATIVE waveform for a recording the viewer may not play: bars drawn
// from a seed (the media id), so the same note always looks the same but the
// picture carries nothing from the audio itself. The real duration is shown
// beside it. No React, no DOM.

const BAR_COUNT = 28;
const MIN_HEIGHT = 0.12;

// FNV-1a 32-bit — a stable small hash of the id.
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 — a tiny seeded PRNG; good enough for bar heights.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bar heights in (0, 1], shaped like speech: a gentle rise, a long middle,
// a fall at the end.
export function waveformBars(seed: string, count = BAR_COUNT): number[] {
  const rand = mulberry32(hash32(seed));
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const envelope = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.75 + 0.25;
    const h = MIN_HEIGHT + (1 - MIN_HEIGHT) * envelope * (0.35 + 0.65 * rand());
    return Math.round(Math.min(1, h) * 1000) / 1000;
  });
}

// "0:07" for 7 400 ms; "—" when unknown.
export function fmtClipDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
