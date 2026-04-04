import { useState, useEffect } from 'react';
import { count } from '../lib/offlineQueue.ts';

/**
 * Thin banner shown at the top of the page content when the app is offline.
 * Shows pending queue count if there are queued items.
 * Briefly flashes "Back online" when connectivity returns.
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [showReconnect, setShowReconnect] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const goOffline = () => { setOnline(false); setShowReconnect(false); };
    const goOnline = () => {
      setOnline(true);
      setShowReconnect(true);
      setTimeout(() => setShowReconnect(false), 2500);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Poll pending count while offline (cheap IDB read)
  useEffect(() => {
    if (online && !showReconnect) return;
    const refresh = () => { count().then(setPendingCount); };
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [online, showReconnect]);

  if (online && !showReconnect) return null;

  return (
    <div
      style={{
        backgroundColor: showReconnect ? 'rgba(74, 222, 128, 0.12)' : 'rgba(196, 145, 95, 0.12)',
        borderBottom: `1px solid ${showReconnect ? 'rgba(74, 222, 128, 0.3)' : 'rgba(196, 145, 95, 0.3)'}`,
        padding: '6px 16px',
        fontSize: 13,
        color: showReconnect ? 'rgba(74, 222, 128, 0.9)' : 'rgba(196, 145, 95, 0.9)',
        textAlign: 'center',
        transition: 'background-color 0.4s ease, border-color 0.4s ease, color 0.4s ease',
      }}
    >
      {showReconnect
        ? 'Back online'
        : <>
            You're offline — sessions will be saved locally
            {pendingCount > 0 && (
              <span style={{ marginLeft: 8, opacity: 0.7 }}>
                ({pendingCount} pending)
              </span>
            )}
          </>
      }
    </div>
  );
}
