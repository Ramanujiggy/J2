import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

type Phase = 'visible' | 'exiting' | 'entering';

interface Props {
  children: React.ReactNode;
}

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
      }, 360);

      return () => clearTimeout(enterTimer);
    }, 240);

    return () => clearTimeout(exitTimer);
  }, [location.pathname, children]);

  // Update children when not transitioning
  useEffect(() => {
    if (phase === 'visible') {
      setDisplayChildren(children);
    }
  }, [children, phase]);

  const style: React.CSSProperties =
    phase === 'exiting'
      ? { animation: 'j2-page-out 240ms ease-out both' }
      : phase === 'entering'
        ? { animation: 'j2-page-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both' }
        : {};

  return (
    <div style={{ willChange: phase !== 'visible' ? 'transform, opacity' : 'auto', ...style }}>
      {displayChildren}
    </div>
  );
}
