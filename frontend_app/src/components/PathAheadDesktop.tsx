// PathAheadDesktop — the desktop (editorial dashboard) layout for
// PathAheadPage. Rail shell wraps this page; we own everything right
// of the rail.
//
// Structure, top → bottom:
//   • Editorial header (date eyebrow + serif hero + streak subtitle + CTAs)
//   • 2-stat strip (practice streak + this week's hours)
//   • 2-col main: operational spine (left) + pulse sidebar (right)
//   • Modals + RepRouletteFab
//
// Pure layout shell. All state, computations, and side-effects live in
// the parent; everything we need comes in as props.
//
// Extracted from PathAheadPage.tsx during the 2026-05-09 refactor pass.

import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import TodayCard from './today/TodayCard.tsx';
import IntentionHeroCard from './IntentionHeroCard.tsx';
import FirstVisitCard from './FirstVisitCard.tsx';
import DesktopPathAheadSkeleton from './DesktopPathAheadSkeleton.tsx';
import TopPartnersCard from './TopPartnersCard.tsx';
import RecentConstraintsCard from './RecentConstraintsCard.tsx';
import RepRouletteFab from './RepRouletteFab.tsx';
import MostRecentSessionCard from './MostRecentSessionCard.tsx';
import PageContent from './PageContent.tsx';
import PathAheadWeekSection, { type WeekViewMode } from './PathAheadWeekSection.tsx';
import { CARD_BG, FONT_EDITORIAL, PALE_YELLOW, PRESTIGE_TEAL, PRESTIGE_TEAL_GLOW } from '../lib/theme.ts';
import { toDateString, formatDuration } from '../lib/sessionUtils.ts';
import type { Intention, SessionSummary } from '../types/api.ts';

interface DaySessionEntry {
  session: SessionSummary;
  day: Date;
  dayStr: string;
}

interface Props {
  // Profile + ambient
  name: string | null;
  intentionsEnabled: boolean;
  loading: boolean;
  // Stats
  streak: number;
  longestStreak: number;
  weekStatsCount: number;
  weekStatsTotalMinutes: number;
  consistentWeeks: number;
  // Intention
  activeIntention: Intention | null;
  /** Completion progress for non-'days' intentions (mig 034). null otherwise. */
  activeIntentionProgress: { completed: number; target: number; unit: 'sessions' | 'training_weeks' } | null;
  // Sessions
  allSessions: SessionSummary[];
  // Week section
  weekOffset: number;
  weekLabel: string;
  weekView: WeekViewMode;
  onWeekOffsetChange: (next: number | ((prev: number) => number)) => void;
  onWeekViewChange: (mode: WeekViewMode) => void;
  displayWeekDays: Date[];
  today: Date;
  sessionsByDate: Map<string, SessionSummary[]>;
  weekSessionsList: DaySessionEntry[];
  onLogTap: (date?: string) => void;
  onDayTap: (day: Date, sessions: SessionSummary[]) => void;
  onSessionTap: (entry: DaySessionEntry) => void;
  // Other shared elements
  heatmapSection: React.ReactNode;
  telemetryContent: React.ReactNode;
  modals: React.ReactNode;
  styleBlock: React.ReactNode;
  // Callbacks
  openLog: (opts?: { date?: string; preset?: { heading?: string; sessionType?: 'drilling' | 'cla'; subSkillTag?: string; constraintName?: string } | null }) => void;
  setSetIntentOpen: (v: boolean) => void;
  handleDeleteIntention: () => void;
}

// SectionLabel — italic Cormorant lowercase + trailing copper hairline.
// Refero anchor: 222's "INVITES 6 ─────" pattern (`daf006a1-…`). Defines
// the page's vertical rhythm without adding card chrome. Used only by
// the desktop layout, so it lives alongside.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginTop: 8,
      }}
    >
      <span
        style={{
          fontFamily: FONT_EDITORIAL,
          fontStyle: 'italic',
          fontSize: 15,
          color: 'rgba(242,228,168,0.55)',
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {children}
      </span>
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 1,
          background: 'rgba(196,145,95,0.22)',
        }}
      />
    </div>
  );
}

export default function PathAheadDesktop({
  name,
  intentionsEnabled,
  loading,
  streak,
  longestStreak,
  weekStatsCount,
  weekStatsTotalMinutes,
  consistentWeeks,
  activeIntention,
  activeIntentionProgress,
  allSessions,
  weekOffset,
  weekLabel,
  weekView,
  onWeekOffsetChange,
  onWeekViewChange,
  displayWeekDays,
  today,
  sessionsByDate,
  weekSessionsList,
  onLogTap,
  onDayTap,
  onSessionTap,
  heatmapSection,
  telemetryContent,
  modals,
  styleBlock,
  openLog,
  setSetIntentOpen,
  handleDeleteIntention,
}: Props) {
  const navigate = useNavigate();

  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(today).toUpperCase(),
    [today],
  );

  // Streak subtitle — tiered copy based on consistent weeks
  const streakSubtitle =
    consistentWeeks >= 26 ? `${consistentWeeks} weeks logged. Consistency is showing.` :
    consistentWeeks >= 12 ? `${consistentWeeks} weeks in a row. Nice rhythm.` :
    consistentWeeks >= 1  ? `${consistentWeeks} week${consistentWeeks === 1 ? '' : 's'} in. Building the habit.` :
    `Welcome back${name ? `, ${name}` : ''}.`;

  // Most recent session — for the sidebar widget
  const mostRecent = allSessions.length > 0
    ? [...allSessions].sort((a, b) => {
        const da = typeof a.date === 'string' ? a.date.slice(0, 10) : toDateString(new Date(a.date));
        const db = typeof b.date === 'string' ? b.date.slice(0, 10) : toDateString(new Date(b.date));
        return db.localeCompare(da);
      })[0]
    : null;

  // heroCardStyle was used by the now-retired AnnualRadial hero block.
  // Removed with the IA migration to Atlas → Prism. Re-introduce only if a
  // new hero card lands on Path Ahead.
  const softCardStyle: React.CSSProperties = {
    backgroundColor: CARD_BG,
    border: '1px solid var(--j2-border-2)',
    borderRadius: 16,
  };

  // Desktop loading state — render the brand-correct skeleton instead of
  // the empty page chrome. PageContent itself short-circuits on desktop
  // (see PageContent.tsx:82), so the proper hand-off here is to swap in
  // the skeleton during `loading` rather than rely on the belt-tying
  // loader (which is mobile-only by design).
  if (loading) {
    return (
      <PageContent ready={true}>
        <DesktopPathAheadSkeleton />
      </PageContent>
    );
  }

  return (
    <PageContent ready={!loading} loadingMessages={['Shrimping down the mat...', 'Doing mat swims...', 'Pulling up gi pants...']}>
    <div className="j2-page-container" style={{ paddingTop: 64, paddingBottom: 104 }}>
      {styleBlock}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 52 }}>
        <div>
          <div className="j2-label-micro" style={{ marginBottom: 16 }}>{todayLabel}</div>
          <h1
            className="j2-serif-display j2-heading-glow"
            style={{ fontSize: 88, margin: 0, lineHeight: 1 }}
          >
            This week
          </h1>
          <div
            className="j2-serif-italic"
            style={{ marginTop: 14, fontSize: 22 }}
          >
            {streakSubtitle}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {/* Adjust-focus chip is only shown once an intention exists. The
              no-intention state is handled by the dashed IntentionHeroCard
              below, which is far more inviting — keeping both visible was
              offering the same action twice with different wording. */}
          {intentionsEnabled && activeIntention && (
            <button
              onClick={() => setSetIntentOpen(true)}
              style={{
                height: 50, padding: '0 22px',
                background: 'var(--j2-surface-3)',
                color: 'rgba(255,255,255,0.90)',
                border: '1px solid var(--j2-border-2)',
                borderRadius: 12,
                fontWeight: 500, fontSize: 15,
                display: 'inline-flex', alignItems: 'center', gap: 10,
                cursor: 'pointer',
                transition: 'background 180ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--j2-surface-3)'; }}
            >
              ◇ Adjust focus
            </button>
          )}
          <button
            onClick={() => openLog()}
            style={{
              height: 54, padding: '0 28px',
              background: '#DA7422', color: '#fff',
              fontWeight: 600, borderRadius: 12,
              boxShadow: '0 0 0 1px rgba(218,116,34,0.3), 0 10px 24px -12px rgba(218,116,34,0.6)',
              transition: 'background 180ms ease, transform 180ms ease',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              fontSize: 16,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E8823A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#DA7422'; }}
          >
            + Log session
          </button>
        </div>
      </div>

      {!loading && allSessions.length === 0 ? (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <FirstVisitCard onLogFirst={() => openLog()} />
        </div>
      ) : (
      <>

      {/* ── 2-stat strip (operational) ──────────────────────────────
          Reduced from 4 stats. Alignment and Consistent-Weeks were
          reflective metrics (multi-week comparisons) — moved to Atlas.
          What stays: practice streak (today's relationship to habit)
          and this week's hours (the current week's actual volume). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22, marginBottom: 44 }}>
        {([
          {
            label: 'Practice streak',
            value: streak > 0 ? `${streak}d` : '—',
            unit: longestStreak > 0 ? `best: ${longestStreak}d` : 'build the habit',
          },
          {
            label: 'This week',
            value: weekStatsTotalMinutes > 0 ? formatDuration(weekStatsTotalMinutes) : '0h',
            unit: `${weekStatsCount} session${weekStatsCount === 1 ? '' : 's'}`,
          },
        ] as { label: string; value: string; unit: string; prestige?: boolean }[]).map((s, i) => (
          <div
            key={i}
            style={{
              padding: '28px 30px',
              background: 'var(--j2-surface-2)',
              border: s.prestige ? `1px solid ${PRESTIGE_TEAL_GLOW}` : '1px solid var(--j2-border-1)',
              borderRadius: 16,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: s.prestige ? `0 0 24px ${PRESTIGE_TEAL_GLOW}, inset 0 0 32px rgba(0,212,170,0.08)` : undefined,
              transition: 'box-shadow 400ms ease, border-color 400ms ease',
            }}
          >
            {s.prestige && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background: `radial-gradient(ellipse 80% 90% at 50% 55%, ${PRESTIGE_TEAL_GLOW} 0%, rgba(0,212,170,0.14) 40%, transparent 78%)`,
                  animation: 'j2PrestigeBreathe 4.6s ease-in-out infinite',
                  mixBlendMode: 'screen',
                }}
              />
            )}
            <div className="j2-label-micro" style={{ marginBottom: 14, position: 'relative' }}>{s.label}</div>
            <div
              style={{
                fontSize: 52, fontFamily: FONT_EDITORIAL, fontWeight: 600,
                color: s.prestige ? PRESTIGE_TEAL : PALE_YELLOW, lineHeight: 1.05,
                textShadow: s.prestige ? `0 0 18px ${PRESTIGE_TEAL_GLOW}` : undefined,
                position: 'relative',
                transition: 'color 400ms ease, text-shadow 400ms ease',
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 13, color: 'rgba(255,255,255,0.40)',
                marginTop: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
                position: 'relative',
              }}
            >
              {s.unit}
            </div>
          </div>
        ))}
      </div>

      {/* ── 2-col main ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 40, alignItems: 'flex-start', marginBottom: 44 }}>

        {/* LEFT column — operational spine: today → this week → pulse */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
          {/* TodayCard — operational centerpiece. Time-aware dialog that
              walks the user through the day: pre-class "Planning to attend?"
              → in-session → post-class "Did you attend?" → drive-home log
              CTA. "No" answers minimize the class out (localStorage). */}
          <SectionLabel>next class</SectionLabel>
          <TodayCard
            sessions={allSessions}
            onLogSession={(ctx) => openLog({ date: ctx.date })}
          />

          {/* This week — promoted from the right rail. Now the operational
              anchor for "what does the rest of the week look like." */}
          <SectionLabel>this week</SectionLabel>
          <div style={{ ...softCardStyle, padding: 32 }}>
            <PathAheadWeekSection
              weekOffset={weekOffset}
              weekLabel={weekLabel}
              weekView={weekView}
              onWeekOffsetChange={onWeekOffsetChange}
              onWeekViewChange={onWeekViewChange}
              displayWeekDays={displayWeekDays}
              today={today}
              sessionsByDate={sessionsByDate}
              weekSessionsList={weekSessionsList}
              onLogTap={onLogTap}
              onDayTap={onDayTap}
              onSessionTap={onSessionTap}
              bodyMarginTop={16}
            />
          </div>

          {/* Active intention for the week — moved from right rail; sits
              directly under the week view since it's the *meaning* of
              this week, not a side metric. */}
          {intentionsEnabled && (
            <IntentionHeroCard
              intention={activeIntention}
              weekSessionCount={weekStatsCount}
              progress={activeIntentionProgress}
              onSetIntent={() => setSetIntentOpen(true)}
              onViewJournal={activeIntention ? () => navigate(`/intentions/${activeIntention.id}/journal`) : undefined}
              onDeleteIntent={handleDeleteIntention}
            />
          )}

          {/* Last 30 days — recent rhythm, short enough to feel operational. */}
          <SectionLabel>pulse</SectionLabel>
          {heatmapSection}

          {telemetryContent}

          {/* Most recent session — sits directly under telemetry so the
              operational left column reads top-to-bottom: today → this
              week → recent rhythm → telemetry → most recent training. */}
          {mostRecent && (
            <MostRecentSessionCard mostRecent={mostRecent} softCardStyle={softCardStyle} />
          )}
        </div>

        {/* RIGHT rail — pulse sidebar: who you trained with, what rules
            you trained under. Two cards. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* Top partners — last 30 days. Self-hides when no partner data. */}
          <TopPartnersCard sessions={allSessions} softCardStyle={softCardStyle} />
          {/* Recent constraints — last 30 days. Self-hides when empty. */}
          <RecentConstraintsCard sessions={allSessions} softCardStyle={softCardStyle} />
        </div>
      </div>

      {/* Recent intentions row removed — they live on /intentions where
          they belong. Path Ahead is for the present week, not a shelf of
          past weeks. */}

      </>
      )}

      {modals}
      <RepRouletteFab onLogDrill={(preset) => {
        // Both preset shapes (drill | constraint) fold into the same
        // logPreset structure. Constraint presets carry constraintName +
        // sessionType='cla'; drill presets carry subSkillTag +
        // sessionType='drilling'. openLog routes desktop locally and
        // mobile through the global event listener in MobileAppShell.
        const presetData = preset.pool === 'drill'
          ? { heading: preset.heading, sessionType: preset.sessionType, subSkillTag: preset.subSkillTag }
          : { heading: preset.heading, sessionType: preset.sessionType, constraintName: preset.constraintName };
        openLog({ date: toDateString(today), preset: presetData });
      }} />
    </div>
    </PageContent>
  );
}
