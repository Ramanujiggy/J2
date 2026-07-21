import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT } from '@/lib/theme';

export function Toaster() {
  const { toasts } = useToast();
  const active = toasts[0];

  const [visible, setVisible] = useState(false);
  const [lineWidth, setLineWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active?.open) { setVisible(false); setLineWidth(0); return; }
    if (active.id === prevIdRef.current) return;
    prevIdRef.current = active.id;

    setVisible(true);
    setLineWidth(0);
    requestAnimationFrame(() => setLineWidth(1));

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setLineWidth(0);
      setTimeout(() => { active.onOpenChange?.(false); }, 400);
    }, active.variant === 'destructive' ? 5000 : 3500);

    return () => clearTimeout(timerRef.current);
  }, [active?.id, active?.open]);

  if (!active?.open) return null;

  const isDestructive = active.variant === 'destructive';
  const isMilestone = active.variant === 'success';
  const accentColor = isDestructive ? 'rgba(224,117,96,0.70)' : 'rgba(196,145,95,0.45)';
  const textColor = isDestructive ? 'rgba(224,117,96,0.90)' : PALE_YELLOW;
  const fontSize = isMilestone ? 17 : 14;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        pointerEvents: 'none',
      }}
    >
      <div
        onClick={() => { setVisible(false); setLineWidth(0); active.onOpenChange?.(false); }}
        style={{
          pointerEvents: 'auto',
          cursor: 'pointer',
          textAlign: 'center',
          maxWidth: 340,
          padding: '10px 20px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        {/* Message text — Cormorant italic, no container */}
        <p
          style={{
            fontFamily: FONT_EDITORIAL,
            fontStyle: 'italic',
            fontSize,
            fontWeight: isMilestone ? 500 : 400,
            color: textColor,
            textShadow: isMilestone ? GLOW_SOFT : 'none',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {active.title}
        </p>

        {active.description && (
          <p
            style={{
              fontFamily: FONT_EDITORIAL,
              fontStyle: 'italic',
              fontSize: 12,
              color: 'rgba(255,255,255,0.40)',
              margin: '4px 0 0',
              lineHeight: 1.4,
            }}
          >
            {active.description}
          </p>
        )}

        {/* Copper path line — draws itself left to right */}
        <div
          style={{
            marginTop: 8,
            height: 1,
            backgroundColor: accentColor,
            width: `${lineWidth * 100}%`,
            marginLeft: 'auto',
            marginRight: 'auto',
            transition: 'width 3s cubic-bezier(0.16, 1, 0.3, 1)',
            borderRadius: 1,
          }}
        />
      </div>
    </div>
  );
}
