import { useState, useEffect, useRef } from 'react';
import BeltLoader from './BeltLoader.tsx';

interface LoadingScreenProps {
  messages?: string[];
}

export default function LoadingScreen({ messages }: LoadingScreenProps) {
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
      <BeltLoader />
      <p className="text-sm tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
        {text}
      </p>
    </div>
  );
}
