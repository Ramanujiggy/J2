// PathAheadModals — the three modal surfaces that overlay PathAheadPage.
//
// Stacked here as one unit because they share the page's modal lifecycle
// (the parent's anyModalOpen guard + body scroll lock) and their open
// state lives at the page level. Pure presentation — every callback +
// every piece of modal state is passed in.
//
// The log composer is NOT here on either viewport — both shells host it and
// listen for `journada:open-log-form`, so one modal serves every page. This
// component is down to the detail and intention modals.
//
// Extracted from PathAheadPage.tsx during the 2026-05-09 refactor pass.

import SessionDetailModal from './SessionDetailModal.tsx';
import SetIntentionModal from './SetIntentionModal.tsx';
import type { Intention, SessionSummary } from '../types/api.ts';

interface Props {
  // Refresh hooks
  fetchAll: () => void;
  refreshRailIntention: () => void;
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
  fetchAll,
  refreshRailIntention,
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
