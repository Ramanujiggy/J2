// ── Spring Physics System ─────────────────────────────────────────────────
//
// Standardized spring constants for the entire app. Every animation should
// reference one of these presets so the UI feels like it's made of the same
// physical material.
//
// The feel: heavy and deliberate, like a leather-bound training journal.
// Heavier than a social app, lighter than QuickBooks. Elements have mass
// and settle with authority.
//
// Spring equation: F = -kx - cv
//   k (stiffness) — how fast it pulls toward target
//   c (damping)   — how quickly it stops oscillating
//   m (mass)      — how heavy the initial response feels

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export const SPRING = {
  /** Toggles, small taps, chip selections. Quick but not cheap. */
  snappy: { stiffness: 280, damping: 26, mass: 0.8 },

  /** Cards settling, section transitions, list reorders. The app's default. */
  firm:   { stiffness: 170, damping: 22, mass: 1.0 },

  /** Modals, belt ceremonies, major transitions. Deliberate and weighty. */
  heavy:  { stiffness: 110, damping: 18, mass: 1.3 },

  /** Particles, ambient drifts, background elements. Slow and dreamlike. */
  gentle: { stiffness: 70,  damping: 12, mass: 1.0 },
} as const;

// ── Spring solver ─────────────────────────────────────────────────────────

interface SpringState {
  position: number;
  velocity: number;
}

/**
 * Advances a spring simulation by one time step.
 * Returns the new position and velocity.
 */
function stepSpring(
  state: SpringState,
  target: number,
  config: SpringConfig,
  dt: number,
): SpringState {
  const displacement = state.position - target;
  const springForce = -config.stiffness * displacement;
  const dampingForce = -config.damping * state.velocity;
  const acceleration = (springForce + dampingForce) / config.mass;

  const velocity = state.velocity + acceleration * dt;
  const position = state.position + velocity * dt;

  return { position, velocity };
}

/**
 * Returns true when the spring has effectively settled (close enough to
 * target with negligible velocity).
 */
function isSettled(state: SpringState, target: number): boolean {
  return Math.abs(state.position - target) < 0.01 && Math.abs(state.velocity) < 0.01;
}

// ── Animate helper ────────────────────────────────────────────────────────

export interface SpringAnimation {
  /** Cancel the running animation. */
  stop: () => void;
}

/**
 * Animates a value from `from` to `to` using spring physics.
 * Calls `onUpdate` every frame with the current value.
 * Calls `onComplete` when the spring has settled.
 *
 * Usage:
 *   const anim = animateSpring({
 *     from: 0, to: 1,
 *     config: SPRING.heavy,
 *     onUpdate: v => element.style.opacity = String(v),
 *   });
 *   // later: anim.stop();
 */
export function animateSpring({
  from,
  to,
  config,
  onUpdate,
  onComplete,
}: {
  from: number;
  to: number;
  config: SpringConfig;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}): SpringAnimation {
  let raf: number | undefined;
  let state: SpringState = { position: from, velocity: 0 };
  let lastTime = performance.now();

  function tick(now: number) {
    // Cap dt to prevent huge jumps after tab-switch
    const dt = Math.min((now - lastTime) / 1000, 0.064);
    lastTime = now;

    state = stepSpring(state, to, config, dt);
    onUpdate(state.position);

    if (isSettled(state, to)) {
      onUpdate(to); // snap to exact target
      onComplete?.();
      return;
    }

    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);

  return {
    stop() {
      if (raf !== undefined) cancelAnimationFrame(raf);
    },
  };
}

// ── CSS spring approximation ──────────────────────────────────────────────
//
// For CSS transitions that can't use requestAnimationFrame (e.g. hover
// states), this converts a SpringConfig to an approximate cubic-bezier
// and duration. It won't be exact physics, but it'll feel cohesive.

export function springToCss(config: SpringConfig): { duration: string; easing: string } {
  // Approximate: higher stiffness = shorter duration, higher damping = less overshoot
  const omega = Math.sqrt(config.stiffness / config.mass);
  const zeta = config.damping / (2 * Math.sqrt(config.stiffness * config.mass));
  const duration = Math.round((4 / (omega * Math.max(zeta, 0.3))) * 1000);

  // Map damping ratio to cubic-bezier overshoot
  const overshoot = Math.max(0, 1.8 - zeta * 1.2);
  const easing = `cubic-bezier(0.34, ${overshoot.toFixed(2)}, 0.64, 1)`;

  return {
    duration: `${Math.min(Math.max(duration, 150), 800)}ms`,
    easing,
  };
}
