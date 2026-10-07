import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface Props { children: React.ReactNode }

// Spring-based page transition. exit: fast fade-up (150ms); enter: spring
// settle from below (stiffness 380, damping 34 ≈ 260ms, no bounce).
// AnimatePresence mode="wait" completes the exit before the enter starts,
// keeping the shell visible and stable throughout.
export default function PageTransition({ children }: Props) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.14, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        style={{ willChange: 'transform, opacity' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
