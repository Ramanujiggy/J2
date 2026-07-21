// PageContent — crossfades from LoadingScreen to page content when `ready` becomes true.
// Replaces the `if (loading) return <LoadingScreen />` pattern in each page so the
// loader fades out smoothly instead of cutting away at an arbitrary animation frame.
//
// When `ready` flips to true the crossfade is deferred until PrismLoader's
// next settle point (end of the arrive trace, then every sweep flare at 600ms
// cadence). This avoids cutting the animation mid-sequence. A 3s safety
// timeout ensures the page is never stuck if the callback doesn't fire.

import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingScreen from './LoadingScreen.tsx';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';

type Phase = 'loading' | 'waiting' | 'fading' | 'ready';

const FADE_MS = 280;
const SETTLE_TIMEOUT_MS = 3000;

interface Props {
  ready: boolean;
  children: React.ReactNode;
  loadingMessages?: string[];
}

export default function PageContent({ ready, children, loadingMessages }: Props) {
  const isDesktop = useIsDesktop();
  const [phase, setPhase] = useState<Phase>(ready ? 'ready' : 'loading');
  const safetyTimer = useRef<ReturnType<typeof setTimeout>>();
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();

  // Start the crossfade (called from settle callback or safety timeout)
  const beginFade = useCallback(() => {
    clearTimeout(safetyTimer.current);
    setPhase('fading');
    fadeTimer.current = setTimeout(() => setPhase('ready'), FADE_MS);
  }, []);

  // Called by PrismLoader at the end of ARRIVE and on each sweep flare
  const handleCycleSettle = useCallback(() => {
    setPhase(prev => {
      if (prev === 'waiting') {
        // Data is ready and belt just settled — start crossfade
        clearTimeout(safetyTimer.current);
        fadeTimer.current = setTimeout(() => setPhase('ready'), FADE_MS);
        return 'fading';
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (ready) {
      setPhase(prev => {
        if (prev === 'loading') {
          // Data arrived — wait for the next settle callback
          safetyTimer.current = setTimeout(beginFade, SETTLE_TIMEOUT_MS);
          return 'waiting';
        }
        return prev;
      });
    } else {
      clearTimeout(safetyTimer.current);
      clearTimeout(fadeTimer.current);
      setPhase('loading');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(safetyTimer.current);
      clearTimeout(fadeTimer.current);
    };
  }, []);

  // Desktop short-circuit — never show the full-screen loader on desktop.
  // Modern web apps (Linear, Vercel, Stripe, Notion, GitHub, Anthropic
  // Console) render content immediately and let data stream in via skeleton
  // / empty states. Mobile keeps the brand-coherent Prism-trace loader
  // because cold-start mobile networks justify a "moment of waiting."
  if (isDesktop) return <>{children}</>;

  if (phase === 'ready') return <>{children}</>;

  const fading = phase === 'fading';

  return (
    <div style={{ position: 'relative' }}>
      {/* Content fades in */}
      <div style={{
        opacity: fading ? 1 : 0,
        transition: fading ? `opacity ${FADE_MS}ms ease` : 'none',
        pointerEvents: fading ? 'auto' : 'none',
      }}>
        {children}
      </div>
      {/* Loader fades out on top */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: fading ? 0 : 1,
        transition: fading ? `opacity ${FADE_MS}ms ease` : 'none',
        pointerEvents: fading ? 'none' : 'auto',
        backgroundColor: '#0D1A14',
      }}>
        <LoadingScreen messages={loadingMessages} onCycleSettle={handleCycleSettle} />
      </div>
    </div>
  );
}
