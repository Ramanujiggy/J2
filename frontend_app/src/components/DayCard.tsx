import { useState } from 'react';
import { SKILL_TAGS, MONTH_NAMES } from '../lib/constants.ts';
import type { SessionSummary, Intention } from '../types/api.ts';
import { CARD_BG, PAGE_BG, SURFACE_2_BORDER, SURFACE_3 } from '../lib/theme.ts';
import { toDateString, formatDuration, DAY_NAMES, INTENSITY_COLOR, SESSION_TYPE_LABELS } from '../lib/sessionUtils.ts';
import { generateDayParticles } from '../lib/particles.ts';

// ── Tooltip ────────────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: 'absolute',
          top: 'calc(100% + 7px)',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: PAGE_BG,
          border: '1px solid rgba(196,145,95,0.4)',
          borderRadius: 8,
          padding: '5px 10px',
          fontSize: 11,
          color: 'rgba(255,255,255,0.65)',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          pointerEvents: 'none',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ── DayCard ────────────────────────────────────────────────────────────────

export interface DayCardProps {
  day: Date;
  today: Date;
  sessions: SessionSummary[];
  intention: Intention | null;
  intentionBrightness: number;
  onLogSession: (date?: Date) => void;
  onViewSession: (sessions: SessionSummary[], date: Date) => void;
  compact?: boolean;
}

export default function DayCard({ day, today, sessions, intention, intentionBrightness, onLogSession, onViewSession, compact = false }: DayCardProps) {
  const [hovered, setHovered] = useState(false);

  const todayStr   = toDateString(today);
  const dayStr     = toDateString(day);
  const isToday    = dayStr === todayStr;
  const isFuture   = dayStr > todayStr;
  const isPast     = dayStr < todayStr;

  const primarySession = sessions.length > 0
    ? [...sessions].sort((a, b) => Number(b.intensity) - Number(a.intensity))[0]
    : null;
  const totalMinutes = sessions.reduce((sum, s) => sum + Number(s.duration), 0);
  const sessionCount = sessions.length;

  const intensityColor = primarySession ? (INTENSITY_COLOR[primarySession.intensity] ?? '#CDDFA0') : null;

  // Border + shadow — today gets a breathing copper glow, with intention adds yellow
  const borderColor = isToday ? 'rgba(196,145,95,0.7)' : SURFACE_2_BORDER;
  const baseShadow  = isToday
    ? intention
      ? '0 0 18px rgba(242,228,168,0.13), 0 0 22px rgba(196,145,95,0.18), 0 4px 16px rgba(0,0,0,0.5)'
      : '0 0 16px rgba(196,145,95,0.25), 0 4px 16px rgba(0,0,0,0.5)'
    : '0 2px 4px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.35)';
  const boxShadow = `${baseShadow}, inset 0 1px 0 rgba(255,255,255,0.06)`;

  const opacityScale = intention ? intentionBrightness / 1.3 : 1;
  const glowHeight   = intentionBrightness >= 1.25 ? 52 : 32;
  const dayParticles = intention ? generateDayParticles(dayStr) : [];

  return (
    <div
      className="w-full rounded-2xl flex flex-col overflow-hidden"
      style={{
        position: 'relative',
        background: `linear-gradient(160deg, rgba(255,255,255,0.035) 0%, transparent 55%), ${CARD_BG}`,
        border: `1px solid ${borderColor}`,
        boxShadow: hovered ? `${boxShadow}, 0 16px 40px rgba(0,0,0,0.6)` : boxShadow,
        minHeight: compact ? 260 : 320,
        transform: hovered ? `translateY(${compact ? -3 : -6}px)` : 'translateY(0)',
        transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        animation: isToday ? 'j2-today-pulse 4s ease-in-out infinite' : undefined,
        willChange: 'transform',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top accent bar for session days */}
      {sessionCount > 0 && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(to right, transparent 0%, ${intensityColor ?? '#CDDFA0'}99 25%, ${intensityColor ?? '#CDDFA0'}99 75%, transparent 100%)`,
          borderRadius: '16px 16px 0 0',
          pointerEvents: 'none',
        }} />
      )}

      {/* Card header */}
      <div className={`${compact ? 'px-3 pt-3 pb-2' : 'px-4 pt-4 pb-3'} border-b border-white/5`}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wide">
            {DAY_NAMES[day.getDay()]}
          </p>
          {isToday && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(196,145,95,0.3)', color: '#C4915F', letterSpacing: '0.05em' }}
            >
              TODAY
            </span>
          )}
        </div>
        <p
          className={`${compact ? 'text-base' : 'text-lg'} font-bold mt-0.5`}
          style={{ color: isToday ? '#C4915F' : 'rgba(255,255,255,0.9)' }}
        >
          {MONTH_NAMES[day.getMonth()]} {day.getDate()}
        </p>
      </div>

      {/* Card body */}
      <div className="flex-1 flex flex-col">
      {sessionCount > 0 ? (
        <button
          className="flex-1 px-4 py-3 text-left w-full"
          onClick={() => onViewSession(sessions, day)}
        >
          {/* Intensity dot + duration + count */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: intensityColor! }}
            />
            <span className="text-sm font-semibold text-white">{formatDuration(totalMinutes)}</span>
            {sessionCount > 1 && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>×{sessionCount}</span>
            )}
          </div>
          {/* Type · Style */}
          <p className="text-[12px] mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {SESSION_TYPE_LABELS[primarySession!.session_type] ?? primarySession!.session_type}
            {' · '}
            {primarySession!.gi_nogi === 'gi' ? 'Gi' : 'No-Gi'}
          </p>
          {/* Tags (up to 4) */}
          {primarySession!.tags && primarySession!.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {primarySession!.tags.slice(0, compact ? 2 : 4).map(tag => {
                const found = SKILL_TAGS.find(s => s.value === tag);
                return (
                  <span
                    key={tag}
                    className="text-[11px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: SURFACE_3, color: 'rgba(255,255,255,0.5)' }}
                  >
                    {found?.label ?? tag}
                  </span>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>Tap to view ›</p>
        </button>
      ) : isToday ? (
        <button
          onClick={() => onLogSession(day)}
          className="flex-1 flex flex-col items-center justify-center gap-1"
        >
          <span className="text-base font-semibold" style={{ color: 'rgba(196,145,95,0.85)' }}>+ Mat Time</span>
        </button>
      ) : isPast ? (
        <button
          onClick={() => onLogSession(day)}
          className="flex-1 flex flex-col items-center justify-center gap-1.5"
        >
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>Rest day</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(196,145,95,0.55)' }}>+ Log session</span>
        </button>
      ) : (
        <button
          onClick={() => onLogSession(day)}
          className="flex-1 flex flex-col items-center justify-center gap-1"
        >
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.18)' }}>+ Log</span>
        </button>
      )}
      </div>

      {/* Intention strip at bottom — fades in when active */}
      {intention && (
        <div
          className="px-3 py-1.5 text-[10px] truncate"
          style={{
            position: 'relative',
            borderTop: `1px solid rgba(242,228,168,0.22)`,
            color: 'rgba(242,228,168,0.5)',
            animation: 'j2IntentFadeIn 1.6s ease forwards',
          }}
        >
          {/* Glow wrapper — opacityScale controls day brightness without conflicting with pulse keyframes */}
          <div style={{ position: 'absolute', inset: 0, opacity: opacityScale, pointerEvents: 'none', zIndex: 0 }}>
            {/* Purple glow — bleeds from below the footer floor */}
            <div style={{
              position: 'absolute',
              bottom: -8, left: '50%',
              transform: 'translateX(-50%)',
              width: '70%', height: glowHeight,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center bottom, rgba(167,139,250,0.6) 0%, rgba(167,139,250,0.15) 50%, transparent 80%)',
              animation: 'j2IntentPurplePulse 5s ease-in-out infinite',
            }} />
            {/* Yellow lowlight */}
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0, height: 22,
              background: 'linear-gradient(to top, rgba(242,228,168,0.22) 0%, transparent 100%)',
              animation: 'j2IntentYellowPulse 4s ease-in-out infinite',
              transformOrigin: 'center bottom',
            }} />
          </div>
          {/* Rising particles — fade upward via mask so they dissolve before hitting the card overflow clip */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.8) 40%, transparent 90%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.8) 40%, transparent 90%)',
          }}>
            {dayParticles.map((p, i) => (
              <span key={i} style={{
                position: 'absolute',
                left: p.left, bottom: p.bottom,
                width: p.size, height: p.size,
                borderRadius: '50%',
                backgroundColor: 'rgba(242,228,168,0.9)',
                boxShadow: '0 0 6px 2px rgba(242,228,168,0.75)',
                filter: `brightness(${intentionBrightness})`,
                ['--drift' as string]: p.drift,
                animation: `j2IntentParticleRise ${p.duration}s ease-in-out infinite ${p.delay}s`,
                userSelect: 'none',
              } as React.CSSProperties} />
            ))}
          </div>
          {/* Label sits above effect layers */}
          <Tooltip text={[
            intention.intent_label,
            intention.intent_category ? intention.intent_category.charAt(0).toUpperCase() + intention.intent_category.slice(1) : null,
            `${intention.duration_days ?? 7}d intention`,
          ].filter(Boolean).join(' · ')}>
            <span style={{ position: 'relative', zIndex: 2, cursor: 'default' }}>◈ {intention.intent_label}</span>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
