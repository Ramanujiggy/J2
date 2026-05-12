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
import type { Intention } from '../types/api.ts';
import { COPPER, PALE_YELLOW } from '../lib/theme.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { addDays, toDateString } from '../lib/sessionUtils.ts';

interface Props {
  intention: Intention | null;
  weekSessionCount?: number;
  compact?: boolean;
  onSetIntent: () => void;
  onEditIntent?: () => void;
  onViewJournal?: () => void;
  onDeleteIntent: () => void;
}

export default function IntentionHeroCard({
  intention,
  weekSessionCount = 0,
  compact = false,
  onSetIntent,
  onEditIntent,
  onViewJournal,
  onDeleteIntent,
}: Props) {
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
  const progressFraction = Math.min(1, weekSessionCount / 3);

  return (
    <div
      style={{
        padding: compact ? 14 : 20,
        border: '1px solid rgba(196,145,95,0.22)',
        borderRadius: compact ? 12 : 14,
        background: 'rgba(196,145,95,0.04)',
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

        {/* Days-left status */}
        <div
          style={{
            marginTop: 14,
            fontSize: 12.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', fontWeight: 700,
            color: 'rgba(255,255,255,0.40)',
          }}
        >
          {daysRemaining === 0 ? 'Ends today' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`}
        </div>

        {/* Weekly session progress bar — quieter than the prior animated
            version. 3 sessions/week is the soft cap; bar fills to that. */}
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
                background: weekSessionCount >= 3
                  ? 'linear-gradient(90deg, #A8CB72, #C4915F 70%, #F2E4A8)'
                  : COPPER,
                transform: `scaleX(${progressFraction})`,
                transformOrigin: 'left center',
                transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), background 400ms ease',
                boxShadow: weekSessionCount >= 3 ? '0 0 10px rgba(242,228,168,0.20)' : 'none',
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', flexShrink: 0, letterSpacing: '0.04em' }}>
            {weekSessionCount} session{weekSessionCount !== 1 ? 's' : ''}
          </span>
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
          {onEditIntent && (
            <button
              onClick={onEditIntent}
              className="touch-manipulation j2-press"
              style={{
                padding: '8px 12px', borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                color: COPPER, background: 'transparent', border: 'none',
                minHeight: 40, cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
          {onViewJournal && (
            <button
              onClick={onViewJournal}
              className="touch-manipulation j2-press"
              style={{
                padding: '8px 12px', borderRadius: 8,
                fontSize: 13, fontWeight: 500,
                color: 'rgba(255,255,255,0.50)',
                background: 'transparent', border: 'none',
                minHeight: 40, cursor: 'pointer',
              }}
            >
              Journal
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
              color: deleteConfirm ? 'rgba(248,113,113,0.85)' : 'rgba(255,255,255,0.25)',
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

