// PathAheadModals — the three modal surfaces that overlay PathAheadPage.
//
// Stacked here as one unit because they share the page's modal lifecycle
// (the parent's anyModalOpen guard + body scroll lock) and their open
// state lives at the page level. Pure presentation — every callback +
// every piece of modal state is passed in.
//
// On mobile the LogSessionForm modal lives in MobileAppShell so the
// bottom-nav `+` FAB can open it from any page; this component only
// renders the desktop log modal (gated by isDesktop). The detail and
// intention modals appear on both viewports.
//
// Extracted from PathAheadPage.tsx during the 2026-05-09 refactor pass.

import CaptureComposer from './composer/CaptureComposer.tsx';
import SessionDetailModal from './SessionDetailModal.tsx';
import SetIntentionModal from './SetIntentionModal.tsx';
import { toast } from '../hooks/use-toast.ts';
import type { Intention, SessionSummary } from '../types/api.ts';

interface Props {
  // Layout context
  isDesktop: boolean;
  // Refresh hooks
  fetchAll: () => void;
  refreshRailIntention: () => void;
  // Log modal (desktop-only)
  logOpen: boolean;
  logDate: string | null;
  setLogOpen: (v: boolean) => void;
  setLogDate: (v: string | null) => void;
  // Session detail modal
  detailSession: SessionSummary | null;
  detailSessions: SessionSummary[];
  detailSessionIndex: number;
  detailDate: Date | null;
  detailIntention: Intention | null;
  setDetailSessions: (v: SessionSummary[]) => void;
  setDetailSessionIndex: (v: number) => void;
  setDetailDate: (v: Date | null) => void;
  setDetailIntention: (v: Intention | null) => void;
  // Intention modal
  setIntentOpen: boolean;
  setSetIntentOpen: (v: boolean) => void;
}

export default function PathAheadModals({
  isDesktop,
  fetchAll,
  refreshRailIntention,
  logOpen,
  logDate,
  setLogOpen,
  setLogDate,
  detailSession,
  detailSessions,
  detailSessionIndex,
  detailDate,
  detailIntention,
  setDetailSessions,
  setDetailSessionIndex,
  setDetailDate,
  setDetailIntention,
  setIntentOpen,
  setSetIntentOpen,
}: Props) {
  return (
    <>
      {/* Desktop-only log modal. On mobile the modal lives in MobileAppShell
          so the bottom-nav `+` FAB launches directly without a route flip;
          openLog() dispatches `journada:open-log-form` on mobile. */}
      {isDesktop && logOpen && (
        <div
          data-no-page-swipe=""
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-5"
          style={{
            backgroundColor: 'rgba(13, 26, 20, 1)',
            backdropFilter: 'blur(16px)',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
          onClick={() => setLogOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg lg:max-w-5xl animate-j2-modal-in"
          >
            <CaptureComposer
              onSuccess={(count) => {
                fetchAll();
                setLogOpen(false);
                setLogDate(null);
                if (count === 500 && !localStorage.getItem('j2-milestone-500')) {
                  localStorage.setItem('j2-milestone-500', '1');
                  toast({ variant: 'success', title: '500 sessions. The mat remembers every one.' });
                }
              }}
              onCancel={() => { setLogOpen(false); setLogDate(null); }}
              defaultDate={logDate ?? undefined}
            />
          </div>
        </div>
      )}

      {detailSession && detailDate && (
        <SessionDetailModal
          key={detailSession.id}
          session={detailSession}
          date={detailDate}
          intention={detailIntention}
          sessionCount={detailSessions.length}
          sessionIndex={detailSessionIndex}
          onNavigate={setDetailSessionIndex}
          onClose={() => { setDetailSessions([]); setDetailSessionIndex(0); setDetailDate(null); setDetailIntention(null); }}
          onSaved={() => { fetchAll(); setDetailSessions([]); setDetailSessionIndex(0); setDetailDate(null); setDetailIntention(null); }}
          onDeleted={() => { fetchAll(); setDetailSessions([]); setDetailSessionIndex(0); setDetailDate(null); setDetailIntention(null); }}
        />
      )}

      {setIntentOpen && (
        <SetIntentionModal
          onSaved={() => { fetchAll(); refreshRailIntention(); }}
          onClose={() => { setSetIntentOpen(false); }}
        />
      )}
    </>
  );
}
