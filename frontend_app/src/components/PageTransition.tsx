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
      }, 350);

      return () => clearTimeout(enterTimer);
    }, 200);

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
      ? { animation: 'j2-page-out 200ms ease-in both' }
      : phase === 'entering'
        ? { animation: 'j2-page-in 350ms cubic-bezier(0.0, 0.55, 0.15, 1.0) both' }
        : {};

  return (
    <div style={{ willChange: phase !== 'visible' ? 'transform, opacity' : 'auto', ...style }}>
      {displayChildren}
    </div>
  );
}
