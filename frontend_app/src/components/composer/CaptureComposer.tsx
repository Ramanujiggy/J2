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
import { vibrate } from '../../lib/haptics.ts';
import { buildSessionPayload, type SessionDraft } from '../../lib/sessionPayload.ts';
import { CARD_BG, STATUS_ERROR } from '../../lib/theme.ts';
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
  const { stamps: earnedStamps, refetch: refetchStamps } = useStamps();
  const [boaReveal, setBoaReveal] = useState<{ struckAt: string; count: number } | null>(null);

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
      onSuccess?.(data.session_count);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your entry. Please try again.');
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleBoa = async () => {
    vibrate(12);
    try {
      const data = await api.post<{ stamp?: { count: number; last_struck_at: string }; _offline?: boolean }>(
        '/api/stamps', { die_key: 'boa' },
      );
      if (data.stamp) {
        setBoaReveal({ struckAt: data.stamp.last_struck_at, count: data.stamp.count });
        refetchStamps();
      } else {
        const prev = earnedStamps.get('boa')?.count ?? 0;
        setBoaReveal({ struckAt: new Date().toISOString(), count: prev + 1 });
      }
    } catch { /* strike failed — no reveal */ }
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
            style={{ textAlign: 'center', marginTop: 18, fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 14, color: 'rgba(255,255,255,0.38)', cursor: 'pointer' }}
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
          onBoa={handleBoa}
          skin={skin}
          pastPartners={pastPartners}
        />
      )}

      <SealRevealSheet
        open={boaReveal != null}
        die={STAMP_DIES.boa ?? null}
        struckAt={boaReveal?.struckAt ?? null}
        count={boaReveal?.count ?? 0}
        autoEarned={false}
        onClose={() => setBoaReveal(null)}
      />
    </div>
  );
}
