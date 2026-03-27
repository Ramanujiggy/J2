interface GrappleLoaderProps {
  size?: number;
  className?: string;
}

const KEYFRAMES = `
  @keyframes j2GuardPassSway {
    0%, 100% { transform: rotate(-2deg) translateX(-1px); }
    50%       { transform: rotate(2deg)  translateX(1px);  }
  }
  @keyframes j2GrappleGlow {
    0%, 100% { opacity: 0.55; transform: scale(1);    }
    50%       { opacity: 1;    transform: scale(1.18); }
  }
  @keyframes j2GrapplePulse {
    0%, 100% { transform: scale(1);    }
    50%       { transform: scale(1.04); }
  }
`;

/*
  Guard pass composition (viewBox -50 -50 100 100):

  TOP PLAYER  — crouching/kneeling, leaning forward to pass
    head   ≈ (4, -34)
    torso  angles forward/down
    arms   reach toward bottom player's hips
    legs   spread, one knee planted

  BOTTOM PLAYER — on their back, legs raised in guard
    head   ≈ (-28, 26)
    body   roughly horizontal
    legs   raised up and bent at knee (classic guard position)
    one arm reaching up to frame/push
*/

export default function GrappleLoader({ size = 96, className }: GrappleLoaderProps) {
  const glowSize = size * 1.04;
  const gold = 'rgba(240,223,160,0.92)';

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{
          position: 'relative',
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Copper mat glow behind the figures */}
        <div
          style={{
            position: 'absolute',
            width: glowSize,
            height: glowSize,
            borderRadius: '50%',
            background: `radial-gradient(
              ellipse at center,
              rgba(184,122,85,0.45) 0%,
              rgba(184,122,85,0.15) 45%,
              transparent 72%
            )`,
            animation: 'j2GrappleGlow 3.2s ease-in-out infinite',
          }}
        />

        {/* Figure pair — gentle sway to suggest active struggle */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            animation: 'j2GuardPassSway 2.8s ease-in-out infinite',
            transformOrigin: 'center center',
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox="-50 -50 100 100"
            fill="none"
            stroke={gold}
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              display: 'block',
              animation: 'j2GrapplePulse 2.6s ease-in-out infinite',
              filter: 'drop-shadow(0 0 4px rgba(184,122,85,0.5))',
            }}
          >
            {/* ── TOP PLAYER: guard passer, crouching over ── */}
            {/* Head */}
            <circle cx="4" cy="-34" r="6" fill={gold} stroke="none" />
            {/* Torso — leaning forward */}
            <path d="M 4,-28 C 2,-18 0,-8 -2,2" />
            {/* Left arm reaching down to grip bottom player's hip/leg */}
            <path d="M 2,-20 C -2,-10 -4,0 0,12" />
            {/* Right arm out for base */}
            <path d="M 2,-20 C 10,-14 18,-6 20,2" />
            {/* Left leg — knee planted on mat */}
            <path d="M -2,2 C -8,12 -14,22 -18,30" />
            <path d="M -18,30 C -20,36 -20,42 -16,45" />
            {/* Right leg — foot planted, driving through */}
            <path d="M -2,2 C 8,10 18,18 24,26" />
            <path d="M 24,26 C 28,34 28,41 24,44" />

            {/* ── BOTTOM PLAYER: guard, on back with legs raised ── */}
            {/* Head */}
            <circle cx="-28" cy="26" r="6" fill={gold} stroke="none" />
            {/* Torso — horizontal along ground */}
            <path d="M -22,24 C -10,22 0,24 8,26" />
            {/* Hip at roughly (8, 26) — both legs raise up into guard */}
            {/* Left leg: thigh goes up-left, shin bends back */}
            <path d="M 8,26 C 10,14 12,2 8,-12" />
            <path d="M 8,-12 C 6,-20 2,-26 -4,-24" />
            {/* Right leg: thigh goes up-right, shin bends back */}
            <path d="M 8,26 C 20,16 28,4 28,-8" />
            <path d="M 28,-8 C 30,-18 30,-26 24,-30" />
            {/* Arm reaching up to frame passer's shoulders */}
            <path d="M -18,20 C -10,10 -4,2 2,-8" />
          </svg>
        </div>
      </div>
    </>
  );
}
