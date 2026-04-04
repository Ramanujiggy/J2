// PageContent — crossfades from LoadingScreen to page content when `ready` becomes true.
// Replaces the `if (loading) return <LoadingScreen />` pattern in each page so the
// loader fades out smoothly instead of cutting away at an arbitrary animation frame.

import { useState, useEffect } from 'react';
import LoadingScreen from './LoadingScreen.tsx';

type Phase = 'loading' | 'fading' | 'ready';

interface Props {
  ready: boolean;
  children: React.ReactNode;
}

export default function PageContent({ ready, children }: Props) {
  const [phase, setPhase] = useState<Phase>(ready ? 'ready' : 'loading');

  useEffect(() => {
    if (ready && phase === 'loading') {
      setPhase('fading');
      const t = setTimeout(() => setPhase('ready'), 280);
      return () => clearTimeout(t);
    }
    if (!ready && phase !== 'loading') setPhase('loading');
  }, [ready, phase]);

  if (phase === 'ready') return <>{children}</>;

  const fading = phase === 'fading';

  return (
    <div style={{ position: 'relative' }}>
      {/* Content fades in beneath the loader */}
      <div style={{
        opacity: fading ? 1 : 0,
        transition: fading ? 'opacity 280ms ease' : 'none',
        pointerEvents: fading ? 'none' : 'auto',
      }}>
        {children}
      </div>
      {/* Loader fades out on top */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 280ms ease' : 'none',
        pointerEvents: fading ? 'none' : 'auto',
        backgroundColor: '#0D1A14',
      }}>
        <LoadingScreen />
      </div>
    </div>
  );
}
