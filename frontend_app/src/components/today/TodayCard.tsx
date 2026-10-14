// TodayCard — operational centerpiece for the Path Ahead page. Surfaces
// the next-relevant class on today's schedule and walks the user through a
// small dialog as the day progresses:
//
//   pre_class_unanswered          "Planning to attend?"   [Yes] [No]
//   pre_class_planning            quiet "you're on for it"
//   in_class                      quiet "in session"
//   post_class_unanswered         "Did you attend?"        [Yes] [No]
//   post_class_attended_unlogged  hero — "Open log" CTA (drive-home moment)
//   logged                        quiet "logged ✓"
//   no_class_today                quiet "no class scheduled today" + log link
//
// "No" answers persist to localStorage and remove the class from the rail
// until tomorrow — the card minimizes out and the next class (or
// no_class_today) takes its place.
//
// Refero anchors:
//   - Headspace start-of-day timeline (`6b43037f-…`) — today as a lit node
//   - Daylish event cards (`6b8f5a39-…`) — "in 2h 14m" relative pill
//   - Headspace post-session check-in (`87fab23a-…`) — drive-home warmth
//   - 222 forest-green register (`fb8cfaaf-…`) — italic Cormorant + hairlines

import { CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, COPPER_BORDER, PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT, SURFACE_2, TEXT_HINT } from '../../lib/theme.ts';
import { formatGiNogi } from '../../lib/sessionUtils.ts';
import { useTodayClass, formatRelativeMinutes } from './useTodayClass.ts';
import type { SessionSummary } from '../../types/api.ts';

interface Props {
  sessions: SessionSummary[];
  /** Called when the user taps "Open log" in the post-class hero state. */
  onLogSession: (ctx: LogContext) => void;
  /** Half-width mode for side-by-side layout on mobile home. */
  compact?: boolean;
  /** When true, no-class state renders as a quiet inline line (no card). */
  quiet?: boolean;
}

export interface LogContext {
  date: string;                 // YYYY-MM-DD (today)
  gi_nogi?: 'gi' | 'no_gi' | 'both';
  className?: string;
}

function formatTime(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return t;
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TodayCard({ sessions, onLogSession, compact = false, quiet = false }: Props) {
  const today = useTodayClass(sessions);

  if (today.loading) return <TodaySkeleton />;

  const { state, schedule, setPlanning, setAttended } = today;

  // ── State: no_class_today ─────────────────────────────────────────────
  if (state === 'no_class_today' || schedule === null) {
    if (quiet) {
      return (
        <div style={{ padding: '2px 0' }}>
          <Italic large compact>No class today.</Italic>{' '}
          <button
            onClick={() => onLogSession({ date: todayDateString() })}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: COPPER,
              background: 'none',
              border: 'none',
              borderBottom: `1px solid rgba(196,145,95,0.3)`,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            Log a session anyway →
          </button>
        </div>
      );
    }
    return (
      <Frame variant="quiet" compact={compact}>
        <Italic large compact={compact}>No class scheduled today.</Italic>
        <SecondaryAction
          label="Log a session anyway →"
          onClick={() => onLogSession({ date: todayDateString() })}
        />
      </Frame>
    );
  }

  const className = schedule.name;
  const timeLabel = formatTime(schedule.start_time);
  const giNogiLabel = schedule.gi_nogi ? formatGiNogi(schedule.gi_nogi) : null;
  const ctx: LogContext = {
    date: todayDateString(),
    className,
    ...(schedule.gi_nogi ? { gi_nogi: schedule.gi_nogi } : {}),
  };

  // ── State: pre_class_unanswered ───────────────────────────────────────
  if (state === 'pre_class_unanswered' && today.minutesUntilStart !== null) {
    return (
      <Frame variant="quiet" compact={compact}>
        <ClassTitle name={className} compact={compact} />
        <Meta>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          {` · ${formatRelativeMinutes(today.minutesUntilStart, 'until')}`}
        </Meta>
        <PromptRow
          question={pickPrompt(PRE_CLASS_PROMPTS)}
          onYes={() => setPlanning('yes')}
          onNo={() => setPlanning('no')}
        />
      </Frame>
    );
  }

  // ── State: pre_class_skipped ──────────────────────────────────────────
  // User pre-committed "no, not planning." Class still visible (struck +
  // muted) so they can change their mind. "Undo" clears the planning flag
  // and the card reverts to pre_class_unanswered.
  if (state === 'pre_class_skipped') {
    return (
      <Frame variant="muted" compact={compact}>
        <ClassTitle name={className} struck compact={compact} />
        <Meta muted>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          {' · not planning to attend'}
        </Meta>
        <SecondaryAction label="Undo →" onClick={() => setPlanning(null)} />
      </Frame>
    );
  }

  // ── State: pre_class_planning ─────────────────────────────────────────
  if (state === 'pre_class_planning' && today.minutesUntilStart !== null) {
    return (
      <Frame variant="quiet" compact={compact}>
        <ClassTitle name={className} compact={compact} />
        <Meta>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          {` · ${formatRelativeMinutes(today.minutesUntilStart, 'until')}`}
        </Meta>
        <Italic large style={{ marginTop: 14 }}>
          You're on for it.
        </Italic>
      </Frame>
    );
  }

  // ── State: in_class ───────────────────────────────────────────────────
  if (state === 'in_class') {
    return (
      <Frame variant="quiet" compact={compact}>
        <ClassTitle name={className} compact={compact} />
        <Meta>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          {' · in session'}
        </Meta>
      </Frame>
    );
  }

  // ── State: post_class_unanswered ──────────────────────────────────────
  if (state === 'post_class_unanswered') {
    const since = today.minutesSinceEnd ?? 0;
    return (
      <Frame variant="quiet" compact={compact}>
        <ClassTitle name={className} compact={compact} />
        <Meta>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          {` · ended ${formatRelativeMinutes(since, 'since')}`}
        </Meta>
        <PromptRow
          question={pickPrompt(POST_CLASS_PROMPTS)}
          onYes={() => setAttended('yes')}
          onNo={() => setAttended('no')}
        />
      </Frame>
    );
  }

  // ── State: post_class_skipped ─────────────────────────────────────────
  // User said "no, didn't attend." Same recovery affordance as pre-class
  // skipped — struck title, muted meta, "Undo" clears the attended flag
  // and the card reverts to post_class_unanswered.
  if (state === 'post_class_skipped') {
    const sinceSkip = today.minutesSinceEnd ?? 0;
    return (
      <Frame variant="muted" compact={compact}>
        <ClassTitle name={className} struck compact={compact} />
        <Meta muted>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          {` · ended ${formatRelativeMinutes(sinceSkip, 'since')} · didn't attend`}
        </Meta>
        <SecondaryAction label="Undo →" onClick={() => setAttended(null)} />
      </Frame>
    );
  }

  // ── State: logged ─────────────────────────────────────────────────────
  if (state === 'logged') {
    return (
      <Frame variant="quiet" compact={compact}>
        <ClassTitle name={className} compact={compact} />
        <Meta>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          {' · '}<span style={{ color: PALE_YELLOW }}>logged ✓</span>
        </Meta>
      </Frame>
    );
  }

  // ── State: post_class_attended_unlogged (hero / drive-home moment) ────
  const since = today.minutesSinceEnd ?? 0;
  return (
    <Frame variant="hero" compact={compact}>
      <ClassTitle name={className} compact={compact} />
      <Meta>
        {timeLabel}
        {giNogiLabel && ` · ${giNogiLabel}`}
        <Italic>{` · ended ${formatRelativeMinutes(since, 'since')}`}</Italic>
      </Meta>
      <Italic large style={{ marginTop: 14, marginBottom: 22 }}>
        Log this while it's fresh.
      </Italic>
      <PrimaryAction label="Open log" onClick={() => onLogSession(ctx)} />
    </Frame>
  );
}

// ── Sub-pieces ───────────────────────────────────────────────────────────

function Frame({ variant, compact, children }: { variant: 'quiet' | 'hero' | 'muted'; compact?: boolean; children: React.ReactNode }) {
  const isHero = variant === 'hero';
  const isMuted = variant === 'muted';
  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${isHero ? COPPER_BORDER : CARD_GLOW_BORDER}`,
        boxShadow: isHero ? `${CARD_GLOW}, 0 0 22px rgba(196,145,95,0.10)` : CARD_GLOW,
        borderRadius: compact ? 12 : 16,
        padding: compact
          ? (isHero ? '16px 14px 14px' : '14px 14px')
          : (isHero ? '32px 32px 28px' : '24px 28px'),
        position: 'relative',
        opacity: isMuted ? 0.62 : 1,
        transition: 'border-color 240ms ease, box-shadow 240ms ease, opacity 240ms ease',
      }}
    >
      {children}
    </div>
  );
}

function ClassTitle({ name, struck = false, compact = false }: { name: string; struck?: boolean; compact?: boolean }) {
  return (
    <h2
      style={{
        fontFamily: FONT_EDITORIAL,
        fontSize: compact ? 18 : 28,
        fontWeight: 600,
        color: PALE_YELLOW,
        textShadow: struck ? 'none' : GLOW_SOFT,
        marginBottom: compact ? 4 : 6,
        letterSpacing: '-0.005em',
        textDecoration: struck ? 'line-through' : 'none',
        textDecorationColor: struck ? 'rgba(242,228,168,0.5)' : undefined,
        textDecorationThickness: struck ? '1px' : undefined,
      }}
    >
      {name}
    </h2>
  );
}

function Meta({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <p
      style={{
        fontSize: 13,
        color: muted ? 'rgba(242,228,168,0.42)' : 'rgba(242,228,168,0.55)',
        letterSpacing: '0.02em',
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  );
}

function Italic({
  children,
  large = false,
  compact = false,
  style,
}: { children: React.ReactNode; large?: boolean; compact?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: FONT_EDITORIAL,
        fontStyle: 'italic',
        fontSize: large ? (compact ? 15 : 18) : 'inherit',
        color: large ? 'rgba(242,228,168,0.72)' : undefined,
        display: large ? 'block' : 'inline',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const PRE_CLASS_PROMPTS = [
  'On the mat tonight?',
  'Training tonight?',
  'Heading to the gym?',
  'Getting some rolls in?',
  'Hitting the mats today?',
];

const POST_CLASS_PROMPTS = [
  'Did you make it on the mat?',
  'Get some rounds in?',
  'How were the rolls?',
  'Make it to class?',
  'Did you train?',
];

function pickPrompt(prompts: string[]): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return prompts[dayOfYear % prompts.length]!;
}

function PromptRow({
  question, onYes, onNo,
}: { question: string; onYes: () => void; onNo: () => void }) {
  return (
    <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <Italic large style={{ flex: '0 0 auto' }}>{question}</Italic>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onYes}
          style={{
            fontSize: 13, fontWeight: 600, color: COPPER,
            background: 'none', border: 'none',
            borderBottom: '1px solid rgba(196,145,95,0.3)',
            cursor: 'pointer', padding: 0,
          }}
        >
          Yes →
        </button>
        <button
          onClick={onNo}
          style={{
            fontSize: 13, fontWeight: 600, color: TEXT_HINT,
            background: 'none', border: 'none',
            cursor: 'pointer', padding: 0,
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
function PrimaryAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: COPPER,
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        padding: '10px 20px',
        borderRadius: 999,
        border: `1px solid ${COPPER_BORDER}`,
        cursor: 'pointer',
        boxShadow: '0 0 18px rgba(196,145,95,0.25)',
      }}
    >
      {label}
    </button>
  );
}

function SecondaryAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        color: COPPER,
        fontSize: 13,
        fontWeight: 600,
        padding: '8px 0 4px',
        cursor: 'pointer',
        borderBottom: `1px solid ${COPPER_BORDER}`,
        marginTop: 12,
        alignSelf: 'flex-start',
      }}
    >
      {label}
    </button>
  );
}

function TodaySkeleton() {
  return (
    <div
      style={{
        backgroundColor: SURFACE_2,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        borderRadius: 16,
        padding: '24px 28px',
        height: 96,
        opacity: 0.65,
      }}
    />
  );
}
