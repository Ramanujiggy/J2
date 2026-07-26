// EntryReadView — the entry as a page, not a dashboard.
//
// The writing IS the page. Meta stays quiet at the top; the seal sits after
// the prose like a mark made on the way out. Editing enters through the quiet
// Edit affordance only — this view is read-only prose.
//
// Two states:
//   · sealed / written — the date, a quiet meta line, the study glyph, the
//     prose, and (if struck) the die at press scale.
//   · logged, not written — the non-writer's page, and the mission's primary
//     user. ONE specific question drawn from the session itself, answerable in
//     a sentence, and the orange only acts on that. Never "reflect", never a
//     guilt trip.
//
// Used by SessionDetailModal (both viewports) and the routed /journal/:id
// page, so all three surfaces read identically.

import { useMemo, useState } from 'react';
import {
  COPPER, PALE_YELLOW, BRAND_ORANGE, FONT_EDITORIAL, STATUS_ERROR,
} from '../lib/theme.ts';
import { formatGiNogi } from '../lib/sessionUtils.ts';
import { prismVertices, dominantPillar, pillarLabel } from '../lib/prismGeometry.ts';
import { STAMP_DIES, bandDate } from '../lib/stampDies.ts';
import SealStamp from './seal/SealStamp.tsx';
import SealRevealSheet from './seal/SealRevealSheet.tsx';
import type { Pillar, SessionSummary } from '../types/api.ts';

const TEXT_PRIMARY   = 'rgba(255,255,255,0.92)';
const TEXT_SECONDARY = 'rgba(255,255,255,0.66)';
/** The contrast floor. Small text never goes below this. */
const TEXT_TERTIARY  = 'rgba(255,255,255,0.46)';
const HAIRLINE_2     = 'rgba(255,255,255,0.1)';

const SESSION_TYPE_LABELS: Record<string, string> = {
  class: 'Class',
  drilling: 'Drilling',
  cla: 'Constraints',
  competition_training: 'Competition',
};

const MICRO: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
};

// ── The study glyph ─────────────────────────────────────────────────────────
// A 26px prism with the studied pillar lit. Same geometry as every other
// prism in the app — see lib/prismGeometry.ts.

function StudyGlyph({ pillar, size = 26 }: { pillar: Pillar | null; size?: number }) {
  const verts = useMemo(() => prismVertices(44, 44, 30, 0), []);
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" style={{ flex: 'none' }} aria-hidden>
      {verts.map(v => (
        <line
          key={`ax-${v.value}`}
          x1={44} y1={44} x2={v.cx} y2={v.cy}
          stroke="rgba(255,255,255,0.09)" strokeWidth={1}
        />
      ))}
      {verts.map(v => (
        <circle
          key={`v-${v.value}`}
          cx={v.cx} cy={v.cy}
          r={v.value === pillar ? 6 : 3}
          fill={v.value === pillar ? PALE_YELLOW : 'rgba(196,145,95,0.4)'}
        />
      ))}
    </svg>
  );
}

// ── The one question ────────────────────────────────────────────────────────

/**
 * One specific question drawn from the session's own data — never a blank
 * page, never "reflect". Deterministic: the first source the session actually
 * carries wins, so the same entry always asks the same question.
 */
function oneQuestion(session: SessionSummary, constraints: string[], headingLabel: string | null): string {
  const partner = session.partners?.[0]?.trim();
  if (headingLabel) return `What stuck with you about ${lower(headingLabel)}?`;
  if (constraints[0]) return `How did ${lower(constraints[0])} change how you moved?`;
  if (partner) return `What did you learn rolling with ${partner}?`;
  return 'What stayed with you after you left the mat?';
}

function lower(s: string): string {
  // Leave acronyms and proper nouns alone; only de-capitalise a plain
  // sentence-case label so it reads inside the question.
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

// ── EntryReadView ───────────────────────────────────────────────────────────

interface Props {
  session: SessionSummary;
  date: Date;
  /** Resolved constraint display names — used only for the one-question fallback. */
  constraints?: string[];
  headingLabel?: string | null;
  /** Back affordance. Label sits next to the chevron. */
  backLabel?: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete?: () => Promise<void> | void;
  deleting?: boolean;
  /** Session navigator, when a day holds more than one session. */
  sessionCount?: number;
  sessionIndex?: number;
  onNavigate?: (index: number) => void;
  /** Constrains the prose column on wide viewports. */
  maxWidth?: number;
}

export default function EntryReadView({
  session,
  date,
  constraints = [],
  headingLabel = null,
  backLabel = 'Journal',
  onBack,
  onEdit,
  onDelete,
  deleting = false,
  sessionCount,
  sessionIndex,
  onNavigate,
  maxWidth = 640,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sealOpen, setSealOpen] = useState(false);

  const prose = session.notes?.trim() ?? '';
  const hasWriting = prose.length > 0;

  const stamp = session.stamps?.[0];
  const die = stamp ? STAMP_DIES[stamp.die_key] : undefined;

  const study = dominantPillar(session.pillar_distribution);

  // "Wednesday,\nJuly 22" — the line break is deliberate; the date is display
  // type here, not a label.
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
  const monthDay = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date);

  const metaParts = [
    headingLabel || 'Jiu Jitsu',
    `${session.duration} min`,
    formatGiNogi(session.gi_nogi),
    SESSION_TYPE_LABELS[session.session_type],
  ].filter(Boolean);

  return (
    <div style={{ maxWidth, marginInline: 'auto' }}>
      {/* ── Top bar: back · Edit ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, minHeight: 44,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <span style={{ color: TEXT_TERTIARY, fontSize: 20, lineHeight: 1 }} aria-hidden>‹</span>
          <span style={{ ...MICRO, color: TEXT_SECONDARY }}>{backLabel}</span>
        </button>

        {/* The quiet Edit affordance — the only way into editing. */}
        <button
          type="button"
          onClick={onEdit}
          className="touch-manipulation"
          style={{
            ...MICRO, color: TEXT_TERTIARY, minHeight: 44, paddingInline: 4,
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          Edit
        </button>
      </div>

      {/* ── Session navigator (multiple sessions on one day) ─────────── */}
      {(sessionCount ?? 1) > 1 && onNavigate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => onNavigate(sessionIndex! - 1)}
            disabled={sessionIndex === 0}
            aria-label="Previous session"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
              color: sessionIndex === 0 ? 'rgba(255,255,255,0.18)' : TEXT_TERTIARY,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 11.5, color: TEXT_TERTIARY }}>
            session {sessionIndex! + 1} of {sessionCount}
          </span>
          <button
            type="button"
            onClick={() => onNavigate(sessionIndex! + 1)}
            disabled={sessionIndex === sessionCount! - 1}
            aria-label="Next session"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
              color: sessionIndex === sessionCount! - 1 ? 'rgba(255,255,255,0.18)' : TEXT_TERTIARY,
            }}
          >
            →
          </button>
        </div>
      )}

      {/* ── The date ─────────────────────────────────────────────────── */}
      <h1
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 30, fontWeight: 600,
          color: PALE_YELLOW, marginTop: 18, lineHeight: 1.12,
        }}
      >
        {weekday},<br />{monthDay}
      </h1>

      <div style={{ fontSize: 12.5, color: TEXT_TERTIARY, marginTop: 8 }}>
        {metaParts.join(' · ')}
      </div>

      {/* ── The study ────────────────────────────────────────────────── */}
      {study && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
          <StudyGlyph pillar={study} />
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            The study ·{' '}
            <b style={{ color: PALE_YELLOW, fontWeight: 600 }}>{pillarLabel(study)}</b>
          </span>
        </div>
      )}

      {hasWriting ? (
        <>
          {/* ── The writing ──────────────────────────────────────────── */}
          <div
            style={{
              fontFamily: FONT_EDITORIAL, fontSize: 17.5, lineHeight: 1.7,
              color: TEXT_PRIMARY, marginTop: 20, whiteSpace: 'pre-wrap',
              textWrap: 'pretty',
            }}
          >
            {prose}
          </div>

          {/* ── The seal, at press scale ─────────────────────────────── */}
          {die && stamp && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
                <button
                  type="button"
                  aria-label={`${die.name} seal — a mat moment, ${bandDate(stamp.struck_at)}. Open details.`}
                  onClick={() => setSealOpen(true)}
                  style={{
                    width: 140, height: 140, transform: 'rotate(-8deg)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  }}
                >
                  <SealStamp die={die} top={bandDate(stamp.struck_at)} size={140} />
                </button>
              </div>
              <div style={{ ...MICRO, textAlign: 'right', color: TEXT_TERTIARY, marginTop: 10 }}>
                {die.name} · struck {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' })
                  .format(new Date(stamp.struck_at))}
                {(session.stamps?.length ?? 0) > 1 && ` · ${session.stamps!.length} marks`}
              </div>
            </>
          )}
        </>
      ) : (
        /* ── Logged, but nothing written yet ────────────────────────── */
        <>
          <div
            style={{
              fontFamily: FONT_EDITORIAL, fontSize: 19, fontStyle: 'italic',
              color: TEXT_SECONDARY, marginTop: 26, lineHeight: 1.5,
            }}
          >
            Logged, but nothing written yet.
          </div>

          <div
            style={{
              marginTop: 18, padding: 16,
              border: `1px solid ${HAIRLINE_2}`, borderRadius: 15,
            }}
          >
            <div style={{ ...MICRO, color: COPPER, letterSpacing: '0.12em', marginBottom: 5 }}>
              One question
            </div>
            <div
              style={{
                fontFamily: FONT_EDITORIAL, fontSize: 21, color: PALE_YELLOW,
                lineHeight: 1.35, marginTop: 4,
              }}
            >
              {oneQuestion(session, constraints, headingLabel)}
            </div>
            <button
              type="button"
              onClick={onEdit}
              style={{
                height: 44, padding: '0 18px', borderRadius: 11,
                background: BRAND_ORANGE, color: '#fff', fontWeight: 600, fontSize: 14,
                display: 'inline-flex', alignItems: 'center', gap: 7,
                marginTop: 14, border: 'none', cursor: 'pointer',
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 21h4L20 8l-4-4L3 17v4z" />
              </svg>
              Two lines is plenty
            </button>
          </div>
        </>
      )}

      {/* ── Delete — present, deliberately unobtrusive ────────────────── */}
      {onDelete && (
        <div
          style={{
            marginTop: 32, paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 44,
          }}
        >
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{ fontSize: 12, color: TEXT_TERTIARY, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Delete
            </button>
          ) : (
            <>
              <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 13, color: TEXT_TERTIARY }}>
                Delete this entry?
              </span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={{ fontSize: 12, color: TEXT_TERTIARY, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onDelete()}
                disabled={deleting}
                style={{ fontSize: 12, fontWeight: 600, color: STATUS_ERROR, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
            </>
          )}
        </div>
      )}

      {die && stamp && (
        <SealRevealSheet
          open={sealOpen}
          die={die}
          struckAt={stamp.struck_at}
          count={session.stamps?.filter(s => s.die_key === stamp.die_key).length ?? 1}
          autoEarned={die.earnRule === 'auto'}
          onClose={() => setSealOpen(false)}
        />
      )}
    </div>
  );
}
