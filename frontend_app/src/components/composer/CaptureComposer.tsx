// Capture Composer — journal-first capture orchestrator (spec-capture-composer.md).
// Stage machine: sheet → record → page → receipt → done, plus a 'details'
// drawer that renders the full legacy LogSessionForm (unforced escape hatch).
// Every path writes a COMPLETE session row: kernel fields come from the class
// schedule or defaults, so analytics never see a partial session (spec §3).
//
// Same public contract as LogSessionForm's core (onSuccess/onCancel/defaultDate)
// so mount sites swap 1:1; preset launches fall through to LogSessionForm at
// the mount site, not here.

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { deriveKernel, type Kernel } from '../../lib/composerKernel.ts';
import { extractChips, type ExtractedChip } from '../../lib/chipExtraction.ts';
import { useSpeechTranscript } from '../../hooks/useSpeechTranscript.ts';
import { useUserTags } from '../../hooks/useUserTags.ts';
import { useCanonicalPositions } from '../../hooks/useCanonicalPositions.ts';
import { useSessions } from '../../context/SessionsContext.tsx';
import { useActiveIntention } from '../../context/ActiveIntentionContext.tsx';
import { useIsDesktop } from '../../hooks/useIsDesktop.ts';
import { selectionsToDistribution, type ChipSelection } from '../../lib/selectionsToDistribution.ts';
import { SKILL_TAGS } from '../../lib/constants.ts';
import ComposerSheet from './ComposerSheet.tsx';
import ComposerRecorder from './ComposerRecorder.tsx';
import ComposerPage from './ComposerPage.tsx';
import ComposerReceipt from './ComposerReceipt.tsx';
import LogSessionForm from '../LogSessionForm.tsx';
import type { ClassSchedulesResponse, Pillar } from '../../types/api.ts';

type Stage = 'sheet' | 'record' | 'page' | 'receipt' | 'details';

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
  const [chips, setChips] = useState<ExtractedChip[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [intensity, setIntensity] = useState(3);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState('');

  const speech = useSpeechTranscript();
  const { tags: userTags } = useUserTags();
  const { positions: canonicals } = useCanonicalPositions();
  const { sessions } = useSessions();
  const { activeIntention } = useActiveIntention();

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

  const pastPartners = useMemo(
    () => [...new Set(sessions.flatMap(s => s.partners ?? []))],
    [sessions],
  );

  const kernelCaption = useMemo(() => {
    const gi = effectiveKernel.gi_nogi === 'no_gi' ? 'No-Gi' : effectiveKernel.gi_nogi === 'both' ? 'Gi + No-Gi' : 'Gi';
    return [effectiveKernel.date, effectiveKernel.scheduleName, `${effectiveKernel.duration} min`, gi]
      .filter(Boolean).join(' · ').toUpperCase();
  }, [effectiveKernel]);

  // Confirmed chips → selections → distribution/heading (mirrors LogSessionForm).
  const selections: ChipSelection[] = useMemo(() => {
    const counts = new Map<Pillar, number>();
    for (const c of chips) {
      if (!confirmed.has(c.name) || !c.pillar) continue;
      counts.set(c.pillar, (counts.get(c.pillar) ?? 0) + 1);
    }
    if (counts.size === 0) return [];
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    return [...counts.keys()].map(pillar => ({ pillar, primary: pillar === dominant, deep_work: false }));
  }, [chips, confirmed]);

  const headline = useMemo(() => {
    const primary = selections.find(s => s.primary);
    if (!primary) return 'A night on the mat';
    const label = SKILL_TAGS.find(t => t.value === primary.pillar)?.label ?? primary.pillar;
    return `A ${label.toLowerCase()}-heavy night`;
  }, [selections]);

  const runExtraction = (text: string) => {
    const found = extractChips(text, userTags, canonicals, pastPartners);
    setChips(found);
    setConfirmed(new Set(found.filter(c => c.kind !== 'partner').map(c => c.name))); // techniques pre-confirmed; partners opt-in
  };

  const save = async (notes: string) => {
    setSealing(true);
    setError('');
    const dist = selections.length > 0 ? selectionsToDistribution(selections) : null;
    const heading = selections.find(s => s.primary)?.pillar ?? null;
    try {
      const data = await api.post<LogResponse>('/api/sessions', {
        date: effectiveKernel.date,
        duration: effectiveKernel.duration,
        notes,
        gi_nogi: effectiveKernel.gi_nogi,
        intensity,
        session_type: effectiveKernel.session_type,
        tags: selections.map(s => s.pillar),
        heading,
        polarity: null,
        sub_skill_tag: '',
        script_source: null,
        user_tag_ids: chips.filter(c => c.kind === 'user_tag' && confirmed.has(c.name)).map(c => c.id!),
        canonical_position_ids: chips.filter(c => c.kind === 'canonical' && confirmed.has(c.name)).map(c => c.id!),
        pillar_distribution: dist,
        had_primary: selections.some(s => s.primary),
        had_deep_work: false,
        selection_count: selections.length,
        deep_work_pillars: [],
        canonical_constraint_ids: [],
        user_constraint_ids: [],
        partners: chips.filter(c => c.kind === 'partner' && confirmed.has(c.name)).map(c => c.name),
      });
      onSuccess?.(data.session_count);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your entry. Please try again.');
      setSealing(false);
    }
  };

  const [entryText, setEntryText] = useState('');
  // Keep entry text in lockstep with live transcription.
  useEffect(() => { if (speech.recording) setEntryText(speech.transcript); }, [speech.transcript, speech.recording]);

  if (stage === 'details') {
    return (
      <LogSessionForm
        onSuccess={onSuccess}
        onCancel={() => setStage('page')}
        defaultDate={effectiveKernel.date}
      />
    );
  }

  return (
    <div
      className="rounded-2xl"
      style={{ background: '#152E22', border: '1px solid rgba(255,255,255,0.10)', padding: isDesktop ? 32 : 20 }}
    >
      {error && <p style={{ fontSize: 13, color: '#F87171', marginBottom: 10 }}>{error}</p>}

      {stage === 'sheet' && (
        <>
          <ComposerSheet
            kernel={effectiveKernel}
            intention={activeIntention}
            speechSupported={speech.supported}
            onSpeak={() => { setStage('record'); speech.start(); }}
            onWrite={() => setStage('page')}
            onMarkAttended={() => { void save(''); }}
          />
          <p
            onClick={onCancel}
            style={{ textAlign: 'center', marginTop: 14, fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 14, color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}
          >
            not now →
          </p>
        </>
      )}

      {stage === 'record' && (
        <ComposerRecorder
          kernelCaption={kernelCaption}
          transcript={speech.transcript}
          elapsed={speech.elapsed}
          onStop={() => {
            speech.stop();
            setEntryText(speech.transcript);
            runExtraction(speech.transcript);
            setStage('page');
          }}
        />
      )}

      {stage === 'page' && (
        <ComposerPage
          kernelCaption={kernelCaption}
          text={entryText}
          onTextChange={setEntryText}
          chips={chips}
          confirmed={confirmed}
          onToggleChip={(name) => setConfirmed(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
          })}
          speechSupported={speech.supported}
          recording={speech.recording}
          onMicToggle={() => (speech.recording ? speech.stop() : speech.start())}
          onOpenDetails={() => setStage('details')}
          onContinue={() => { runExtraction(entryText); setStage('receipt'); }}
          isDesktop={isDesktop}
        />
      )}

      {stage === 'receipt' && (
        <ComposerReceipt
          selections={selections}
          headline={headline}
          intensity={intensity}
          onIntensity={setIntensity}
          onSeal={() => { void save(entryText.trim()); }}
          sealing={sealing}
        />
      )}
    </div>
  );
}
