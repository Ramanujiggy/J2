// IntentionHeroCard — the active-intention card on the Path Ahead page.
//
// Visual chrome adopted from the (now-retired) DesktopAppShell rail focus
// card: copper-tinted bg, copper-at-22% border, radial champagne highlight
// from the top-right, ◇ kicker + serif display title + italic intent_label
// dek + small-caps "X days left" status. The rail card was duplicating
// this same surface, and the user preferred its restrained aesthetic over
// the prior animated particle/pulse treatment.
//
// Preserved from the prior implementation:
//   • weekSessionCount progress bar (functional — shows weekly traction)
//   • Edit / Journal / Delete action row (functional)
//   • Invitational empty state when no intention is set
// Removed:
//   • Animated champagne particles rising from the bottom
//   • Purple radial pulse + yellow lowlight pulse
//   • The yellow border + yellow-tint background

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Intention, UserTag } from '../types/api.ts';
import { COPPER, PALE_YELLOW, STATUS_ERROR } from '../lib/theme.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { addDays, toDateString } from '../lib/sessionUtils.ts';
import { useUserTags } from '../hooks/useUserTags.ts';

interface IntentionProgress {
  completed: number;
  target: number;
  unit: 'sessions' | 'training_weeks';
}

interface Props {
  intention: Intention | null;
  weekSessionCount?: number;
  /**
   * Completion progress for non-'days' intentions (mig 034). When provided,
   * replaces the "days remaining" + weekly-cap progress bar with progress
   * toward target_count of sessions or training weeks. Null / undefined for
   * 'days' mode and for surfaces that don't drive progress.
   */
  progress?: IntentionProgress | null;
  compact?: boolean;
  onSetIntent: () => void;
  onViewJournal?: () => void;
  onDeleteIntent: () => void;
}

export default function IntentionHeroCard({
  intention,
  weekSessionCount = 0,
  progress = null,
  compact = false,
  onSetIntent,
  onViewJournal,
  onDeleteIntent,
}: Props) {
  const navigate = useNavigate();
  const { byId: userTagById } = useUserTags();
  const resolvedTags = (intention?.user_tag_ids ?? [])
    .map(id => userTagById.get(id))
    .filter((t): t is UserTag => !!t);

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setDeleteConfirm(false);
    onDeleteIntent();
  };

  // Days remaining (inclusive). 0 → ends today.
  const today = toDateString(new Date());
  let daysRemaining = 0;
  if (intention) {
    const start = intention.week_start.slice(0, 10);
    const end = addDays(start, (intention.duration_days ?? 7) - 1);
    const endDate = new Date(end + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    daysRemaining = Math.max(0, Math.round((endDate.getTime() - todayDate.getTime()) / 86400000));
  }

  const categoryLabel = intention?.heading
    ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
    : null;

  // Prefer the freeform goal as the headline; fall back to the pillar label
  // when the user didn't type a custom intent_label.
  const primaryLabel = intention
    ? (intention.intent_label?.trim() || categoryLabel)
    : null;

  const showCategory = !!categoryLabel
    && !!primaryLabel
    && primaryLabel.trim().toLowerCase() !== categoryLabel.toLowerCase();

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!intention) {
    return (
      <button
        onClick={onSetIntent}
        className="w-full rounded-xl text-left touch-manipulation j2-press"
        style={{
          backgroundColor: 'rgba(196,145,95,0.04)',
          border: '1px solid rgba(196,145,95,0.22)',
          borderRadius: compact ? 12 : 14,
          padding: compact ? '14px 14px' : '20px 20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 100% 0%, rgba(242,228,168,0.08), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div className="j2-label-copper" style={{ marginBottom: compact ? 8 : 10 }}>◇ This week</div>
        <div className="j2-serif-display" style={{ fontSize: compact ? 18 : 26, lineHeight: 1.1, color: PALE_YELLOW }}>
          Set your focus
        </div>
        <div
          style={{
            marginTop: compact ? 10 : 14,
            fontSize: compact ? 12 : 14, fontWeight: 600,
            color: COPPER, borderBottom: `1px solid ${COPPER}40`,
            display: 'inline-block',
          }}
        >
          + Set intent →
        </div>
      </button>
    );
  }

  // ── Active intention ────────────────────────────────────────────────────
  // Progress fraction: for non-'days' intentions, completion progress
  // toward target_count. For 'days' intentions (or when progress isn't
  // provided), fall back to a 3-sessions/week soft cap.
  const progressFraction = progress
    ? Math.min(1, progress.completed / Math.max(1, progress.target))
    : Math.min(1, weekSessionCount / 3);
  const progressComplete = progress
    ? progress.completed >= progress.target
    : weekSessionCount >= 3;
  const statusLabel = (() => {
    if (progress) {
      const unitWord = progress.unit === 'sessions'
        ? (progress.target === 1 ? 'session' : 'sessions')
        : (progress.target === 1 ? 'training week' : 'training weeks');
      return `${progress.completed} / ${progress.target} ${unitWord}`;
    }
    return daysRemaining === 0 ? 'Ends today' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;
  })();
  const trailingCount = progress ? null : `${weekSessionCount} session${weekSessionCount !== 1 ? 's' : ''}`;

  return (
    <div
      style={{
        padding: compact ? 14 : 20,
        border: '1px solid rgba(196,145,95,0.18)',
        borderRadius: compact ? 12 : 14,
        background: 'rgba(196,145,95,0.04)',
        backdropFilter: 'blur(12px) saturate(120%)',
        WebkitBackdropFilter: 'blur(12px) saturate(120%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12), inset 0 0 0 0.5px rgba(242,228,168,0.05)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Radial champagne highlight from the top-right — same as the rail's */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 100% 0%, rgba(242,228,168,0.08), transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Kicker */}
        <div className="j2-label-copper" style={{ marginBottom: compact ? 8 : 10 }}>◇ This week</div>

        <div
          className="j2-serif-display"
          style={{ fontSize: compact ? 18 : 28, lineHeight: 1.1, color: PALE_YELLOW }}
        >
          {primaryLabel}
        </div>

        {/* Italic subtext — pillar category, when distinct from the title */}
        {showCategory && (
          <div
            style={{
              marginTop: 6,
              fontSize: 14,
              color: 'rgba(255,255,255,0.60)',
              fontStyle: 'italic',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            Category: {categoryLabel}
          </div>
        )}

        {/* Technique chips — tappable copper tags linking to /techniques/:id */}
        {resolvedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
            {resolvedTags.map(tag => (
              <button
                key={tag.id}
                onClick={e => { e.stopPropagation(); navigate(`/techniques/${tag.id}`); }}
                className="px-2.5 py-1 rounded-md text-xs font-medium touch-manipulation"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: 'rgba(196,145,95,0.70)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}

        {/* Status line — days remaining (for 'days' mode) or progress
            toward target (for 'sessions' / 'training_weeks' modes). */}
        <div
          style={{
            marginTop: 14,
            fontSize: 12.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', fontWeight: 700,
            color: 'rgba(255,255,255,0.40)',
          }}
        >
          {statusLabel}
        </div>

        {/* Progress bar — fills toward 3 sessions/week (days mode) or
            target_count (sessions / training_weeks mode). */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 999,
                background: progressComplete
                  ? 'linear-gradient(90deg, #5E8A5C, #C4915F 70%, #F2E4A8)'
                  : COPPER,
                transform: `scaleX(${progressFraction})`,
                transformOrigin: 'left center',
                transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), background 400ms ease',
                boxShadow: progressComplete ? '0 0 10px rgba(242,228,168,0.20)' : 'none',
              }}
            />
          </div>
          {trailingCount && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', flexShrink: 0, letterSpacing: '0.04em' }}>
              {trailingCount}
            </span>
          )}
        </div>

        {/* Action row — quieter than before. Edit/Journal copper + faint
            white; Delete only blooms red on confirm. */}
        <div
          style={{
            marginTop: 14, paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {onViewJournal && (
            <button
              onClick={onViewJournal}
              className="touch-manipulation j2-press"
              style={{
                padding: '8px 12px', borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                color: COPPER, background: 'transparent', border: 'none',
                minHeight: 40, cursor: 'pointer',
              }}
            >
              Open →
            </button>
          )}
          <div style={{ flex: 1 }} />
          {deleteConfirm && (
            <button
              onClick={() => setDeleteConfirm(false)}
              className="touch-manipulation"
              style={{
                padding: '8px 10px', borderRadius: 8,
                fontSize: 12, color: 'rgba(255,255,255,0.30)',
                background: 'transparent', border: 'none',
                minHeight: 40, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleDelete}
            className="touch-manipulation"
            style={{
              padding: '8px 10px', borderRadius: 8,
              fontSize: 12,
              color: deleteConfirm ? STATUS_ERROR : 'rgba(255,255,255,0.25)',
              background: 'transparent', border: 'none',
              minHeight: 40, cursor: 'pointer',
              transition: 'color 160ms ease',
            }}
          >
            {deleteConfirm ? 'Confirm?' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

