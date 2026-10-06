// SessionDetailModal — the shell around an entry: portal, backdrop, and the
// view ⇄ edit cross-fade.
//
// The read-only content itself lives in EntryReadView, shared with the routed
// /journal/:id page so every surface reads the entry identically. Editing is
// the full Margin Notes entry, unchanged — this modal never touches the
// voice-first capture flow for NEW sessions.

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { CARD_BG, COPPER, CARD_GLOW, CARD_GLOW_BORDER } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import EntryReadView from './EntryReadView.tsx';
import SealRevealSheet from './seal/SealRevealSheet.tsx';
import { STAMP_DIES } from '../lib/stampDies.ts';
import { useUserConstraints } from '../hooks/useUserConstraints.ts';
import { useCanonicalConstraints } from '../hooks/useCanonicalConstraints.ts';
import { useSessions } from '../context/SessionsContext.tsx';
import MarginNotesEntry from './composer/MarginNotesEntry.tsx';
import SessionVideoBlock from './SessionVideoBlock.tsx';
import { buildSessionPayload, type SessionDraft } from '../lib/sessionPayload.ts';
import type { Kernel } from '../lib/composerKernel.ts';
import type { SessionSummary } from './TrainingHeatmap.tsx';

const MODAL_PARTICLES = [
  { left: '7%',  bottom: 3, size: 2, drift: '-4px', duration: 4.1, delay: 0.0 },
  { left: '22%', bottom: 2, size: 2, drift: '5px',  duration: 3.7, delay: 0.9 },
  { left: '40%', bottom: 4, size: 2, drift: '-3px', duration: 4.8, delay: 1.6 },
  { left: '57%', bottom: 2, size: 2, drift: '4px',  duration: 3.4, delay: 0.4 },
  { left: '74%', bottom: 3, size: 2, drift: '-5px', duration: 4.5, delay: 1.2 },
  { left: '89%', bottom: 2, size: 2, drift: '3px',  duration: 3.9, delay: 2.1 },
] as const;

// ── Component ─────────────────────────────────────────────────────────────

interface IntentionSummary {
  intent_label: string;
  intent_category: string | null;
  // Optional pillar heading. Drives the editorial banner's serif title
  // (resolved through SKILL_TAGS to a pretty label, with intent_label
  // falling back when no heading is set). Optional so existing narrowed
  // call-sites continue to type-check without forcing every caller to
  // supply it; the banner gracefully degrades to intent_label.
  heading?: string | null;
}

interface Props {
  session: SessionSummary;
  date: Date;
  intention?: IntentionSummary | null;
  sessionCount?: number;
  sessionIndex?: number;
  onNavigate?: (index: number) => void;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  /** Open straight into the editor. Used by /journal/:id, which already
   *  renders the read view on the page behind this modal. */
  initialEditing?: boolean;
}

export default function SessionDetailModal({ session, date, intention, sessionCount, sessionIndex, onNavigate, onClose, onSaved, onDeleted, initialEditing = false }: Props) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const isDesktop = useIsDesktop();

  // ── Boa keepsake (per-session, struck on the entry in the edit view) ──────
  const [stampReveal, setStampReveal] = useState<{ dieKey: string; struckAt: string } | null>(null);

  // MarginNotesEntry plays the press animation optimistically; here we persist
  // the strike against this session and refresh so it survives a reopen.
  const persistBoa = async () => {
    try {
      await api.post('/api/stamps', { die_key: 'boa', session_id: session.id });
      onSaved();
    } catch { /* keepsake is best-effort */ }
  };

  const sessionDateStr = typeof session.date === 'string' ? session.date.slice(0, 10) : '';

  // Constraint names feed the "one question" fallback chain in EntryReadView.
  // The by-id maps cache reactively; a session with no constraint data simply
  // resolves to an empty array.
  const { byId: userConstraintById } = useUserConstraints();
  const { byId: canonicalConstraintById } = useCanonicalConstraints();

  const resolvedConstraints = useMemo<string[]>(() => {
    const names: string[] = [];
    for (const id of session.canonical_constraint_ids ?? []) {
      const c = canonicalConstraintById.get(id);
      if (c) names.push(c.name);
    }
    for (const id of session.user_constraint_ids ?? []) {
      const c = userConstraintById.get(id);
      if (c) names.push(c.name);
    }
    return names;
  }, [session.canonical_constraint_ids, session.user_constraint_ids, canonicalConstraintById, userConstraintById]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const headingLabel = session.heading
    ? (SKILL_TAGS.find(s => s.value === session.heading)?.label ?? session.heading)
    : null;

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/sessions/${session.id}`);
      onDeleted?.();
      onClose();
    } catch {
      // Leave the confirm row open so the user can retry; EntryReadView owns
      // that state and keeps showing Confirm while `deleting` is false.
      setDeleting(false);
    }
  };

  // Edit is the full Margin Notes entry, seeded from this session. Partners,
  // constraints, resonance, sub_skill_tag ride through untouched (§ backend
  // updateSession is a full-row overwrite — omitting a field nulls it).
  const { sessions } = useSessions();
  const pastPartners = useMemo(() => [...new Set(sessions.flatMap(s => s.partners ?? []))], [sessions]);
  const [editNotes, setEditNotes] = useState(session.notes ?? '');
  // Re-seed the entry text when the modal navigates to a different session.
  useEffect(() => { setEditNotes(session.notes ?? ''); }, [session.id, session.notes]);
  const skin = (typeof localStorage !== 'undefined' && localStorage.getItem('j2-prism-skin') === 'facet') ? 'facet' : 'etched';
  const editKernel: Kernel = {
    date: sessionDateStr,
    duration: session.duration,
    gi_nogi: session.gi_nogi,
    session_type: session.session_type,
    scheduleId: null, scheduleName: null, startTime: null,
  };

  const saveEdit = async (draft: SessionDraft) => {
    setSaving(true);
    setSaveError(false);
    try {
      await api.put(`/api/sessions/${session.id}`, buildSessionPayload(draft));
      onSaved();
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return createPortal(
    <>
      <div
        data-no-page-swipe=""
        role="dialog"
        aria-modal="true"
        aria-label={`Session details for ${dateLabel}`}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 animate-j2-backdrop-in"
        style={{
          backgroundColor: 'rgba(13, 26, 20, 1)',
          backdropFilter: 'blur(16px)',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl animate-j2-modal-in"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative',
            backgroundColor: isDesktop ? CARD_BG : 'transparent',
            border: isDesktop ? `1px solid ${CARD_GLOW_BORDER}` : 'none',
            borderRadius: isDesktop ? 20 : 0,
            boxShadow: isDesktop ? CARD_GLOW : undefined,
            overflow: 'hidden',
          }}
        >

          {/* ════════════════════════════════════════════════════════════
              VIEW PANEL
              ════════════════════════════════════════════════════════════ */}
          <div
            style={{
              position: isEditing ? 'absolute' : 'relative',
              inset: 0,
              transition: 'opacity 280ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: isEditing ? 0 : 1,
              transform: isEditing ? 'translateX(-16px)' : 'translateX(0)',
              pointerEvents: isEditing ? 'none' : 'auto',
            }}
          >
            {/* Intention particle layer */}
            {intention && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', borderRadius: 16 }}>
                <div style={{
                  position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)',
                  width: '55%', height: 56, borderRadius: '50%',
                  background: 'radial-gradient(ellipse at center bottom, rgba(167,139,250,0.18) 0%, transparent 80%)',
                  animation: 'j2IntentPurplePulse 4.2s ease-in-out infinite',
                }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
                  background: 'linear-gradient(to top, rgba(242,228,168,0.07) 0%, transparent 100%)',
                  animation: 'j2IntentYellowPulse 3.1s ease-in-out infinite', transformOrigin: 'center bottom',
                }} />
                {MODAL_PARTICLES.map((p, i) => (
                  <span key={i} style={{
                    position: 'absolute', left: p.left, bottom: p.bottom,
                    width: p.size, height: p.size, borderRadius: '50%',
                    backgroundColor: 'rgba(242,228,168,0.85)',
                    boxShadow: '0 0 4px 1px rgba(242,228,168,0.5)',
                    filter: 'brightness(1.2)',
                    ['--drift' as string]: p.drift,
                    animation: `j2IntentParticleRise ${p.duration}s ease-in-out infinite ${p.delay}s`,
                    userSelect: 'none',
                  } as React.CSSProperties} />
                ))}
              </div>
            )}

            <div style={{
              position: 'relative', zIndex: 1,
              overflowY: 'auto',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
              // Mobile: extra top padding so the date title doesn't crowd the
              // modal edge (2026-07-15 polish — "bump the title card down").
              padding: isDesktop ? '40px 48px 32px' : '2.25rem 1.25rem 1.25rem',
            }}>
              <EntryReadView
                session={session}
                date={date}
                constraints={resolvedConstraints}
                headingLabel={headingLabel}
                backLabel="Journal"
                onBack={onClose}
                onEdit={() => setIsEditing(true)}
                onDelete={handleDelete}
                deleting={deleting}
                sessionCount={sessionCount}
                sessionIndex={sessionIndex}
                onNavigate={onNavigate}
              />
              <SessionVideoBlock
                sessionId={session.id}
                sessionLabel={[dateLabel, headingLabel].filter(Boolean).join(' · ')}
              />
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
              EDIT PANEL — the full Margin Notes entry, seeded from the session.
              Partners/constraints/resonance/sub_skill_tag ride through untouched.
              ════════════════════════════════════════════════════════════ */}
          <div
            style={{
              position: isEditing ? 'relative' : 'absolute',
              inset: 0,
              transition: 'opacity 280ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: isEditing ? 1 : 0,
              transform: isEditing ? 'translateX(0)' : 'translateX(16px)',
              pointerEvents: isEditing ? 'auto' : 'none',
            }}
          >
            <div style={{
              overflowY: 'auto',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
              padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <button
                  onClick={() => {
                    setSaveError(false);
                    // When the modal opened straight into the editor there is
                    // no read view behind it to fall back to — close instead.
                    if (initialEditing) onClose(); else setIsEditing(false);
                  }}
                  className="touch-manipulation"
                  style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  ‹ Cancel
                </button>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: COPPER }}>
                  Journal entry
                </span>
                <span style={{ width: 52 }} aria-hidden />
              </div>
              {saveError && <p className="text-error text-xs mb-3">Save failed — please try again.</p>}
              {isEditing && (
                <MarginNotesEntry
                  key={session.id}
                  kernel={editKernel}
                  entryText={editNotes}
                  onTextChange={setEditNotes}
                  onSave={saveEdit}
                  saving={saving}
                  skin={skin}
                  pastPartners={pastPartners}
                  initial={session}
                  onBoaStruck={persistBoa}
                  onOpenStamp={(dieKey, struckAt) => setStampReveal({ dieKey, struckAt })}
                />
              )}
            </div>
          </div>

        </div>
      </div>

      <SealRevealSheet
        open={stampReveal != null}
        die={stampReveal ? (STAMP_DIES[stampReveal.dieKey] ?? null) : null}
        struckAt={stampReveal?.struckAt ?? null}
        count={1}
        autoEarned={false}
        onClose={() => setStampReveal(null)}
      />
    </>,
    document.body
  );
}
