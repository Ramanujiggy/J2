// ── Particle helpers ────────────────────────────────────────────────────────

// Intent banner — 10 particles across the full-width banner
export const INTENT_PARTICLES = [
  { left: '8%',  bottom: 3, size: 3, drift: '-4px', duration: 3.8, delay: 0.0 },
  { left: '19%', bottom: 2, size: 2, drift: '6px',  duration: 4.5, delay: 0.7 },
  { left: '31%', bottom: 5, size: 3, drift: '-3px', duration: 3.2, delay: 1.4 },
  { left: '43%', bottom: 2, size: 4, drift: '5px',  duration: 5.1, delay: 0.3 },
  { left: '52%', bottom: 4, size: 2, drift: '-6px', duration: 3.6, delay: 2.1 },
  { left: '61%', bottom: 3, size: 3, drift: '4px',  duration: 4.8, delay: 0.9 },
  { left: '70%', bottom: 2, size: 2, drift: '-5px', duration: 3.4, delay: 1.7 },
  { left: '79%', bottom: 5, size: 3, drift: '7px',  duration: 4.2, delay: 0.5 },
  { left: '88%', bottom: 3, size: 2, drift: '-3px', duration: 5.3, delay: 1.2 },
  { left: '47%', bottom: 2, size: 2, drift: '3px',  duration: 4.0, delay: 2.6 },
] as const;

// Seeded deterministic hash — stable across re-renders, unique per day string
export function seededRandom(seed: string, index: number): number {
  let h = 2166136261;
  const str = seed + String(index);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 1000) / 1000;
}

// Stats strip (emerging training priority) — 6 particles across the full strip width
export const STATS_PARTICLES = [
  { left: '6%',  bottom: 2, size: 2, drift: '-3px', duration: 3.9, delay: 0.0 },
  { left: '20%', bottom: 3, size: 2, drift: '4px',  duration: 4.6, delay: 1.2 },
  { left: '38%', bottom: 2, size: 2, drift: '-4px', duration: 3.5, delay: 0.5 },
  { left: '55%', bottom: 3, size: 2, drift: '3px',  duration: 4.2, delay: 1.8 },
  { left: '72%', bottom: 2, size: 2, drift: '-3px', duration: 3.7, delay: 0.9 },
  { left: '88%', bottom: 2, size: 2, drift: '5px',  duration: 4.4, delay: 0.3 },
] as const;

// Per-day particle set — unique positions & timings seeded on the day date string
export function generateDayParticles(dayStr: string) {
  return Array.from({ length: 4 }, (_, i) => ({
    left:     `${8 + seededRandom(dayStr, i * 6)     * 78}%`,
    bottom:   1 + seededRandom(dayStr, i * 6 + 1) * 4,
    size:     2,
    drift:    `${(seededRandom(dayStr, i * 6 + 2) - 0.5) * 10}px`,
    duration: 3.0 + seededRandom(dayStr, i * 6 + 3) * 2.2,
    delay:    seededRandom(dayStr, i * 6 + 4) * 2.8,
  }));
}
