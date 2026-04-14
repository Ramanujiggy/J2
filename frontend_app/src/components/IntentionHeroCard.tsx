import { useState } from 'react';
import type { Intention } from '../types/api.ts';
import { PALE_YELLOW, GLOW_SOFT, SURFACE_2, COPPER } from '../lib/theme.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { INTENT_PARTICLES } from '../lib/particles.ts';
import { addDays, toDateString } from '../lib/sessionUtils.ts';

interface Props {
  intention: Intention | null;
  weekSessionCount?: number;
  onSetIntent: () => void;
  onEditIntent?: () => void;
  onViewJournal?: () => void;
  onDeleteIntent: () => void;
}

export default function IntentionHeroCard({ intention, weekSessionCount = 0, onSetIntent, onEditIntent, onViewJournal, onDeleteIntent }: Props) {
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

  // Days remaining
  const today = toDateString(new Date());
  let daysRemaining = 0;
  if (intention) {
    const start = intention.week_start.slice(0, 10);
    const end = addDays(start, (intention.duration_days ?? 7) - 1);
    const endDate = new Date(end + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    daysRemaining = Math.max(0, Math.round((endDate.getTime() - todayDate.getTime()) / 86400000));
  }

  return (
    <>
      <style>{`
        @keyframes j2IntentParticleRise {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          8%   { opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(-52px) translateX(var(--drift)); opacity: 0; }
        }
        @keyframes j2IntentPurplePulse {
          0%   { opacity: 0.35; transform: scale(1); }
          50%  { opacity: 0.65; transform: scale(1.08); }
          100% { opacity: 0.35; transform: scale(1); }
        }
        @keyframes j2IntentYellowPulse {
          0%   { opacity: 0.4; transform: scaleX(1); }
          50%  { opacity: 0.7; transform: scaleX(1.03); }
          100% { opacity: 0.4; transform: scaleX(1); }
        }
      `}</style>

      {intention ? (
        /* ── Active intention ─────────────────────────────────────── */
        <div
          className="rounded-xl px-5 py-5"
          style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(242,228,168,0.06)',
            border: '1px solid rgba(242,228,168,0.18)',
            boxShadow: '0 0 12px rgba(242,228,168,0.08)',
          }}
        >
          {/* Purple glow */}
          <div style={{
            position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)',
            width: '60%', height: 48, borderRadius: '50%',
            background: 'radial-gradient(ellipse at center bottom, rgba(167,139,250,0.22) 0%, rgba(167,139,250,0.08) 50%, transparent 80%)',
            animation: 'j2IntentPurplePulse 4.2s ease-in-out infinite',
            zIndex: 0, pointerEvents: 'none',
          }} />

          {/* Yellow lowlight */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 28,
            background: 'linear-gradient(to top, rgba(242,228,168,0.09) 0%, transparent 100%)',
            animation: 'j2IntentYellowPulse 3.1s ease-in-out infinite',
            transformOrigin: 'center bottom', zIndex: 0, pointerEvents: 'none',
          }} />

          {/* Particles */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 50%, transparent 100%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 50%, transparent 100%)',
          }}>
            {INTENT_PARTICLES.map((p, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute', left: p.left, bottom: p.bottom,
                  width: p.size, height: p.size, borderRadius: '50%',
                  backgroundColor: 'rgba(242,228,168,0.9)',
                  boxShadow: '0 0 6px 2px rgba(242,228,168,0.75)',
                  filter: 'brightness(1.15)',
                  ['--drift' as string]: p.drift,
                  animation: `j2IntentParticleRise ${p.duration}s ease-in-out infinite ${p.delay}s`,
                  userSelect: 'none',
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm" style={{ color: 'rgba(242,228,168,0.5)' }}>◈</span>
              <span className="text-xs uppercase tracking-wide font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                This week's focus
              </span>
            </div>
            <p className="text-lg font-semibold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
              {intention.heading
                ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
                : intention.intent_label}
            </p>
            {intention.heading && intention.intent_label && intention.intent_label !== intention.heading && (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {intention.intent_label}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {daysRemaining === 0 ? 'Last day' : `${daysRemaining}d remaining`}
              </span>
            </div>

            {/* Session progress */}
            <div className="flex items-center gap-2.5 mt-3">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: '100%',
                    backgroundColor: weekSessionCount >= 3 ? 'rgba(82,181,108,0.70)' : COPPER,
                    transform: `scaleX(${Math.min(1, weekSessionCount / 3)})`,
                    transformOrigin: 'left center',
                    transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), background-color 400ms ease',
                  }}
                />
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.40)' }}>
                {weekSessionCount} session{weekSessionCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Action row */}
            <div className="flex items-center gap-1 mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {onEditIntent && (
                <button
                  onClick={onEditIntent}
                  className="px-3 py-2 rounded-lg text-xs font-medium touch-manipulation j2-press min-h-[40px]"
                  style={{ color: COPPER }}
                >
                  Edit
                </button>
              )}
              {onViewJournal && (
                <button
                  onClick={onViewJournal}
                  className="px-3 py-2 rounded-lg text-xs font-medium touch-manipulation j2-press min-h-[40px]"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  Journal
                </button>
              )}
              <div className="flex-1" />
              {deleteConfirm && (
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="px-3 py-2 rounded-lg text-xs text-white/25 transition-colors touch-manipulation min-h-[40px]"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleDelete}
                className="px-3 py-2 rounded-lg text-xs transition-colors touch-manipulation min-h-[40px]"
                style={{ color: deleteConfirm ? 'rgba(248,113,113,0.85)' : 'rgba(255,255,255,0.20)' }}
              >
                {deleteConfirm ? 'Confirm?' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── No intention — invitational ─────────────────────────── */
        <button
          onClick={onSetIntent}
          className="w-full rounded-xl px-5 py-4 text-left touch-manipulation j2-press"
          style={{
            backgroundColor: SURFACE_2,
            border: `1px dashed rgba(196,145,95,0.35)`,
            transition: 'border-color 200ms ease',
          }}
        >
          <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
            What's your focus this week?
          </p>
          <span className="text-sm font-medium" style={{ color: COPPER }}>
            + Set intent
          </span>
        </button>
      )}
    </>
  );
}
