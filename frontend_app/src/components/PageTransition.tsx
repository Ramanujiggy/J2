import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

type Phase = 'visible' | 'exiting' | 'entering';

interface Props {
  children: React.ReactNode;
}

// Single non-directional transition: previous page fades out + lifts up
// slightly + pulls in, new page rises into place. No horizontal slides
// (those felt mobile-app-light); this reads more like a leather-bound page
// settling. Keyframes (`j2-page-out`, `j2-page-in`) live in index.css.
export default function PageTransition({ children }: Props) {
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>('visible');
  const [displayChildren, setDisplayChildren] = useState(children);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    setPhase('exiting');

    const exitTimer = setTimeout(() => {
      setDisplayChildren(children);
      setPhase('entering');

      const enterTimer = setTimeout(() => {
        setPhase('visible');
      }, 520);

      return () => clearTimeout(enterTimer);
    }, 200);

    return () => clearTimeout(exitTimer);
  }, [location.pathname, children]);

  // Update children when not transitioning (e.g. data refetch on the same page)
  useEffect(() => {
    if (phase === 'visible') {
      setDisplayChildren(children);
    }
  }, [children, phase]);

  const style: React.CSSProperties =
    phase === 'exiting'
      ? { animation: 'j2-page-out 200ms cubic-bezier(0.4, 0, 1, 1) both' }
      : phase === 'entering'
        ? { animation: 'j2-page-in 520ms cubic-bezier(0.16, 1, 0.3, 1) both' }
        : {};

  return (
    <div style={{ willChange: phase !== 'visible' ? 'transform, opacity' : 'auto', ...style }}>
      {displayChildren}
    </div>
  );
}
