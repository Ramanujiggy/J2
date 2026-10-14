// Capture Composer — the Margin Notes capture flow.
//   sheet (voice-first prompt) → record (mic) → page (MarginNotesEntry) → save
// A saved row is always complete: kernel fields (date/duration/gi/type) come
// from the class schedule or defaults, and the entry-first page lets the user
// talk, glance, and save without touching the margin-notes band.
//
// This is now the ONLY session-capture surface (the legacy LogSessionForm was
// retired). Contract: onSuccess/onCancel/defaultDate. All create/edit surfaces
// build the request body through the shared buildSessionPayload serializer so no
// two forms drift apart again.

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { deriveKernel, type Kernel } from '../../lib/composerKernel.ts';
import { useSpeechTranscript } from '../../hooks/useSpeechTranscript.ts';
import { useActiveIntention } from '../../context/ActiveIntentionContext.tsx';
import { useSessions } from '../../context/SessionsContext.tsx';
import { useIsDesktop } from '../../hooks/useIsDesktop.ts';
import { useStamps } from '../../hooks/useStamps.ts';
import { buildSessionPayload, type SessionDraft } from '../../lib/sessionPayload.ts';
import { CARD_BG, STATUS_ERROR, TEXT_TERTIARY } from '../../lib/theme.ts';
import type { SessionSummary } from '../../types/api.ts';
import ComposerSheet from './ComposerSheet.tsx';
import ComposerRecorder from './ComposerRecorder.tsx';
import MarginNotesEntry from './MarginNotesEntry.tsx';
import SealRevealSheet from '../seal/SealRevealSheet.tsx';
import { STAMP_DIES } from '../../lib/stampDies.ts';
import type { ClassSchedulesResponse } from '../../types/api.ts';

type Stage = 'sheet' | 'record' | 'page';

interface Props {
  onSuccess?: (sessionCount?: number) => void;
  onCancel?: () => void;
  defaultDate?: string;
}

interface LogResponse { message?: string; session_count?: number }

export default function CaptureComposer({ onSuccess, onCancel, defaultDate }: Props) {
  const isDesktop = useIsDesktop();
  const [stage, setStage] = useState<Stage>('sheet');
  const [kernel, setKernel] = useState<Kernel>(() => deriveKernel([], new Date()));
  const [entryText, setEntryText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const speech = useSpeechTranscript();
  const { activeIntention } = useActiveIntention();
  const { sessions } = useSessions();
  const pastPartners = useMemo(
    () => [...new Set(sessions.flatMap(s => s.partners ?? []))],
    [sessions],
  );
  const { refetch: refetchStamps } = useStamps();
  const [stampReveal, setStampReveal] = useState<{ dieKey: string; struckAt: string; count: number } | null>(null);
  // Boa struck mid-entry on a not-yet-saved session — persisted after Save with
  // the new session id.
  const pendingBoaRef = useRef(false);

  const skin = (typeof localStorage !== 'undefined' && localStorage.getItem('j2-prism-skin') === 'facet') ? 'facet' : 'etched';

  // Kernel from schedules — one fetch on mount, silent degrade to defaults.
  useEffect(() => {
    let alive = true;
    api.get<ClassSchedulesResponse>('/api/class-schedules')
      .then(res => { if (alive) setKernel(deriveKernel(res.schedules ?? [], new Date())); })
      .catch(() => { /* defaults already in place */ });
    return () => { alive = false; };
  }, []);

  // defaultDate (Calendar-style launches) overrides the kernel date.
  const effectiveKernel: Kernel = useMemo(
    () => (defaultDate ? { ...kernel, date: defaultDate } : kernel),
    [kernel, defaultDate],
  );

  // Keep entry text in lockstep with live transcription.
  useEffect(() => { if (speech.recording) setEntryText(speech.transcript); }, [speech.transcript, speech.recording]);

  const saveDraft = async (draft: SessionDraft) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    const payload = buildSessionPayload(draft);
    try {
      const data = await api.post<LogResponse>('/api/sessions', payload);
      const dataAny = data as unknown as { _offline?: boolean; session_count?: number };
      if (dataAny._offline) {
        const { addPending } = await import('../../lib/pendingSessions.ts');
        // SessionSummary is the display shape for the optimistic offline queue;
        // the serializer types gi_nogi loosely, so cast for the local record.
        addPending({ id: `pending-${Date.now()}`, ...payload } as unknown as SessionSummary);
        const { toast } = await import('../../hooks/use-toast.ts');
        toast({ title: 'Entry saved offline — will sync when connected.' });
        onSuccess?.(undefined);
        return;
      }
      // Persist a Boa struck while composing, now that the session exists.
      const newId = (data as unknown as { session?: { id?: string } }).session?.id;
      if (pendingBoaRef.current && newId) {
        pendingBoaRef.current = false;
        try { await api.post('/api/stamps', { die_key: 'boa', session_id: newId }); refetchStamps(); } catch { /* keepsake is best-effort */ }
      }
      // 500-session milestone. Lives here rather than in a caller's onSuccess
      // because every capture surface routes through this function — it used
      // to hang off the desktop log modal only, so mobile never saw it.
      if (data.session_count === 500 && !localStorage.getItem('j2-milestone-500')) {
        localStorage.setItem('j2-milestone-500', '1');
        const { toast } = await import('../../hooks/use-toast.ts');
        toast({ variant: 'success', title: '500 sessions. The mat remembers every one.' });
      }
      onSuccess?.(data.session_count);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your entry. Please try again.');
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl"
      style={{
        background: isDesktop || stage !== 'sheet' ? CARD_BG : 'transparent',
        border: isDesktop || stage !== 'sheet' ? '1px solid rgba(255,255,255,0.10)' : 'none',
        padding: isDesktop ? 32 : 16,
      }}
    >
      {error && <p style={{ fontSize: 13, color: STATUS_ERROR, marginBottom: 10 }}>{error}</p>}

      {stage === 'sheet' && (
        <>
          <ComposerSheet
            kernel={effectiveKernel}
            intention={activeIntention}
            speechSupported={speech.supported}
            onSpeak={() => { setStage('record'); speech.start(); }}
            onWrite={() => setStage('page')}
            onMarkAttended={() => void saveDraft({
              date: effectiveKernel.date,
              duration: effectiveKernel.duration,
              notes: '',
              gi_nogi: effectiveKernel.gi_nogi,
              intensity: 3,
              session_type: effectiveKernel.session_type,
              selections: [],
            })}
          />
          <p
            onClick={onCancel}
            style={{ textAlign: 'center', marginTop: 18, fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 14, color: TEXT_TERTIARY, cursor: 'pointer' }}
          >
            not now →
          </p>
        </>
      )}

      {stage === 'record' && (
        <ComposerRecorder
          kernelCaption={[effectiveKernel.date, effectiveKernel.scheduleName].filter(Boolean).join(' · ').toUpperCase()}
          transcript={speech.transcript}
          elapsed={speech.elapsed}
          onStop={() => { speech.stop(); setEntryText(speech.transcript); setStage('page'); }}
        />
      )}

      {stage === 'page' && (
        <MarginNotesEntry
          kernel={effectiveKernel}
          entryText={entryText}
          onTextChange={setEntryText}
          onSave={saveDraft}
          saving={saving}
          onBoaStruck={() => { pendingBoaRef.current = true; }}
          onOpenStamp={(dieKey, struckAt) => setStampReveal({ dieKey, struckAt, count: 1 })}
          skin={skin}
          pastPartners={pastPartners}
        />
      )}

      <SealRevealSheet
        open={stampReveal != null}
        die={stampReveal ? (STAMP_DIES[stampReveal.dieKey] ?? null) : null}
        struckAt={stampReveal?.struckAt ?? null}
        count={stampReveal?.count ?? 0}
        autoEarned={false}
        onClose={() => setStampReveal(null)}
      />
    </div>
  );
}
