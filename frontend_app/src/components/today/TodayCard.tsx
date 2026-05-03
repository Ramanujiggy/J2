// TodayCard — operational centerpiece for the desktop Path Ahead page.
// Surfaces today's class (from class_schedules, mig 020) in one of five
// time-aware states. The same physical slot transforms in place — pre-class
// → in-session → post-class drive-home prompt → logged ✓ — so the user
// never has to navigate to find what to do *right now*.
//
// Refero anchors:
//   - Headspace start-of-day (`6b43037f-…`) — today as the lit timeline node
//   - Daylish event timeline (`6b8f5a39-…`) — "in 2h 14m" relative time pill
//   - Headspace post-session check-in (`87fab23a-…`) — drive-home warmth
//   - 222 forest-green register (`fb8cfaaf-…`) — italic Cormorant + hairlines
//
// Public surface: just `<TodayCard sessions={...} onLogSession={...} />`.
// All state derivation lives in `useTodayClass`.

import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, COPPER_BORDER,
  PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT, SURFACE_2,
} from '../../lib/theme.ts';
import { formatGiNogi } from '../../lib/sessionUtils.ts';
import { useTodayClass, formatRelativeMinutes } from './useTodayClass.ts';
import type { SessionSummary } from '../../types/api.ts';

interface Props {
  sessions: SessionSummary[];
  /** Called when the user taps "Open log" / "Log a session anyway". The
   *  card passes a context payload describing today's class so the form
   *  can pre-fill date / gi-nogi where appropriate. */
  onLogSession: (ctx: LogContext) => void;
}

export interface LogContext {
  date: string;                 // YYYY-MM-DD (today)
  gi_nogi?: 'gi' | 'no_gi' | 'both';
  /** Class name, e.g. "Tuesday Night BJJ". Optional — provided when a
   *  scheduled class drove the open. */
  className?: string;
}

function formatTime(t: string): string {
  // 'HH:MM:SS' → '7:00 PM'
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

export default function TodayCard({ sessions, onLogSession }: Props) {
  const today = useTodayClass(sessions);

  // Don't paint anything until the schedules fetch resolves so we don't
  // flash "no class today" and then snap to a real class.
  if (today.loading) return <TodaySkeleton />;

  const { state, schedule } = today;

  // ── State: no_class_today ─────────────────────────────────────────────
  if (state === 'no_class_today' || schedule === null) {
    return (
      <Frame variant="quiet">
        <Italic large>No class scheduled today.</Italic>
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

  // ── State: pre_class ──────────────────────────────────────────────────
  if (state === 'pre_class' && today.minutesUntilStart !== null) {
    return (
      <Frame variant="quiet">
        <ClassTitle name={className} />
        <Meta>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          <Italic>{` · ${formatRelativeMinutes(today.minutesUntilStart, 'until')}`}</Italic>
        </Meta>
      </Frame>
    );
  }

  // ── State: in_class ───────────────────────────────────────────────────
  if (state === 'in_class') {
    return (
      <Frame variant="quiet">
        <ClassTitle name={className} />
        <Meta>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          <Italic>{' · in session'}</Italic>
        </Meta>
      </Frame>
    );
  }

  // ── State: logged ─────────────────────────────────────────────────────
  if (state === 'logged') {
    return (
      <Frame variant="quiet">
        <ClassTitle name={className} />
        <Meta>
          {timeLabel}
          {giNogiLabel && ` · ${giNogiLabel}`}
          {' · '}<span style={{ color: PALE_YELLOW }}>logged ✓</span>
        </Meta>
      </Frame>
    );
  }

  // ── State: post_class_unlogged (the drive-home moment) ────────────────
  const minutesSince = today.minutesSinceEnd ?? 0;
  return (
    <Frame variant="hero">
      <ClassTitle name={className} />
      <Meta>
        {timeLabel}
        {giNogiLabel && ` · ${giNogiLabel}`}
        <Italic>{` · ended ${formatRelativeMinutes(minutesSince, 'since')}`}</Italic>
      </Meta>
      <Italic large style={{ marginTop: 14, marginBottom: 22 }}>
        Log this while it's fresh.
      </Italic>
      <PrimaryAction label="Open log" onClick={() => onLogSession(ctx)} />
    </Frame>
  );
}

// ── Sub-pieces ───────────────────────────────────────────────────────────

function Frame({ variant, children }: { variant: 'quiet' | 'hero'; children: React.ReactNode }) {
  const isHero = variant === 'hero';
  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${isHero ? COPPER_BORDER : CARD_GLOW_BORDER}`,
        boxShadow: isHero ? `${CARD_GLOW}, 0 0 22px rgba(196,145,95,0.10)` : CARD_GLOW,
        borderRadius: 16,
        padding: isHero ? '32px 32px 28px' : '24px 28px',
        position: 'relative',
        transition: 'border-color 240ms ease, box-shadow 240ms ease',
      }}
    >
      {children}
    </div>
  );
}

function ClassTitle({ name }: { name: string }) {
  return (
    <h2
      style={{
        fontFamily: FONT_EDITORIAL,
        fontSize: 28,
        fontWeight: 600,
        color: PALE_YELLOW,
        textShadow: GLOW_SOFT,
        marginBottom: 6,
        letterSpacing: '-0.005em',
      }}
    >
      {name}
    </h2>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, color: 'rgba(242,228,168,0.55)', letterSpacing: '0.02em', lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

function Italic({
  children,
  large = false,
  style,
}: { children: React.ReactNode; large?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: FONT_EDITORIAL,
        fontStyle: 'italic',
        fontSize: large ? 18 : 'inherit',
        color: large ? 'rgba(242,228,168,0.72)' : undefined,
        display: large ? 'block' : 'inline',
        ...style,
      }}
    >
      {children}
    </span>
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
