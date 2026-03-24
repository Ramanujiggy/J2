interface GrappleLoaderProps {
  size?: number;
  className?: string;
}

const KEYFRAMES = `
  @keyframes j2GrappleRotate {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
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

export default function GrappleLoader({ size = 96, className }: GrappleLoaderProps) {
  const glowSize = size * 1.04;

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
        {/* Mat glow — pulses behind the figures */}
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

        {/* Rotating figure pair */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            animation: 'j2GrappleRotate 9s linear infinite',
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox="-50 -50 100 100"
            fill="rgba(240,223,160,0.92)"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              display: 'block',
              animation: 'j2GrapplePulse 2.6s ease-in-out infinite',
              filter: 'drop-shadow(0 0 4px rgba(184,122,85,0.5))',
            }}
          >
            {/* ── Thrower — upright figure ── */}
            <circle cx="12"  cy="-36" r="7"/>
            <ellipse cx="9"  cy="-22" rx="10" ry="9"/>
            <ellipse cx="-8" cy="-14" rx="5"  ry="11" transform="rotate(35 -8 -14)"/>
            <ellipse cx="8"  cy="-4"  rx="9"  ry="8"/>
            <ellipse cx="2"  cy="16"  rx="6"  ry="15" transform="rotate(-14 2 16)"/>
            <ellipse cx="20" cy="17"  rx="5"  ry="13" transform="rotate(16 20 17)"/>

            {/* ── Thrown figure — diagonal, going over thrower's hip ── */}
            <circle cx="-33" cy="22"  r="6"/>
            <ellipse cx="-24" cy="14"  rx="4"  ry="7"  transform="rotate(-35 -24 14)"/>
            <ellipse cx="-3"  cy="2"   rx="26" ry="8"   transform="rotate(-30 -3 2)"/>
            <ellipse cx="26"  cy="-14" rx="9"  ry="6"   transform="rotate(-25 26 -14)"/>
            <ellipse cx="39"  cy="-26" rx="12" ry="5"   transform="rotate(-20 39 -26)"/>
            <ellipse cx="46"  cy="-36" rx="7"  ry="4"   transform="rotate(-15 46 -36)"/>
          </svg>
        </div>
      </div>
    </>
  );
}
