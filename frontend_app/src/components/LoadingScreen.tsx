import { useState, useEffect, useRef } from 'react';
import PrismLoader from './PrismLoader.tsx';

interface LoadingScreenProps {
  messages?: string[];
  /** Called at the end of each belt-tying cycle (settle point). */
  onCycleSettle?: () => void;
}

export default function LoadingScreen({ messages, onCycleSettle }: LoadingScreenProps) {
  const pool = messages && messages.length > 0 ? messages : ['Loading'];
  const picked = useRef(pool[Math.floor(Math.random() * pool.length)]);

  // Re-pick only when the messages array identity changes (i.e. different page)
  const [text, setText] = useState(picked.current);
  useEffect(() => {
    const msg = pool[Math.floor(Math.random() * pool.length)];
    picked.current = msg;
    setText(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <style>{`
        @keyframes j2LdrTextIn {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <PrismLoader onCycleSettle={onCycleSettle} />
      <p
        className="text-sm tracking-widest uppercase"
        style={{
          color: 'rgba(255,255,255,0.2)',
          opacity: 0,
          animation: 'j2LdrTextIn 400ms ease-out 200ms forwards',
        }}
      >
        {text}
      </p>
    </div>
  );
}
