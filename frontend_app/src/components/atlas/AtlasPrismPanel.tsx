// AtlasPrismPanel — the merged Atlas/Analytics panel. Vertical layout:
//   1. Sticky time-window band (date pills + active-window readout)
//   2. Adaptive reading sentence (changes per sub-view)
//   3. AtlasPrismDeck (5 sub-views: Prism / Volume / Split / Format / Weekly)
//   4. AtlasPrismSelectedVertexZoom (gated on subView === 'prism')
//
// Used by both desktop and mobile branches of AtlasPage; `isDesktop` adapts
// the chrome (sticky-band negative margins, font sizes, gaps).
//
// Extracted from AtlasPage.tsx during the 2026-05-09 refactor pass.

import { useMemo, useState } from 'react';
import AtlasPrismDeck, { type ViewMode as PrismViewMode } from './AtlasPrismDeck.tsx';
import AtlasPrismSelectedVertexZoom from './AtlasPrismSelectedVertexZoom.tsx';
import TimeRangeBar from '../TimeRangeBar.tsx';
import ErrorBoundary from '../ErrorBoundary.tsx';
import { SKILL_TAGS } from '../../lib/constants.ts';
import { toDateString, giShare, nogiShare } from '../../lib/sessionUtils.ts';
import {
  type TimeWindow, WINDOW_DAYS,
  sessionPillarHours, computeAlignment, topTagInRange, tagHoursInRange,
} from '../../lib/analyticsUtils.ts';
import { FONT_EDITORIAL, GLOW_SOFT, PALE_YELLOW } from '../../lib/theme.ts';
import type { Intention, SessionSummary } from '../../types/api.ts';

interface Props {
  sessions: SessionSummary[];
  intentions: Intention[];
  timeWindow: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
  customRange: { start: string; end: string } | null;
  onCustomRangeChange: (r: { start: string; end: string } | null) => void;
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  onOpenSession: (id: string) => void;
  onOpenIntentionJournal: (id: string) => void;
  isDesktop: boolean;
}

export default function AtlasPrismPanel({
  sessions, intentions, timeWindow, onWindowChange, customRange, onCustomRangeChange,
  selectedTag, onSelectTag, onOpenSession, onOpenIntentionJournal, isDesktop,
}: Props) {
  // Sub-view state lifted from AtlasPrismDeck so AtlasPrismPanel can adapt the
  // reading sentence per view and hide the selected-vertex zoom on non-Shape
  // sub-views (where a vertex tap is not possible).
  const [subView, setSubView] = useState<PrismViewMode>('prism');
  // ── Hero stats — filtered to current time window ──
  const filtered = useMemo(() => {
    if (timeWindow === 'custom' && customRange) {
      const start = new Date(customRange.start + 'T00:00:00');
      const end   = new Date(customRange.end   + 'T23:59:59');
      return sessions.filter(s => {
        const d = new Date(s.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    }
    const days = WINDOW_DAYS[timeWindow];
    const cutoff = days != null ? new Date(Date.now() - days * 86_400_000) : null;
    return cutoff ? sessions.filter(s => new Date(s.date) >= cutoff) : sessions;
  }, [sessions, timeWindow, customRange]);

  const totalHours = filtered.reduce((sum, s) => sum + (s.duration ?? 0) / 60, 0);

  const WINDOW_LABELS: Partial<Record<TimeWindow, string>> = {
    '7d': 'last 7 days', '14d': 'last 2 weeks', '30d': 'last 30 days',
    '90d': 'last 90 days', '180d': 'last 6 months', '1y': 'last year',
    'all': 'all time',
  };
  const windowLabel = timeWindow === 'custom' ? 'custom range' : (WINDOW_LABELS[timeWindow] ?? 'all time');
  // Detect the unbounded case so stat-card subs can adapt their copy.
  const isAllTime = timeWindow === 'all' || (timeWindow === 'custom' && !customRange);

  // ── Selected-vertex stats ──
  // ALL pillar stats source from `filtered` so the Selected Vertex card
  // reflects the active time window. When the user picks "All time", filtered
  // === sessions and the values match the career-long view.
  const pillarStats = useMemo(() => {
    const stats: Record<string, { count: number; minutes: number; intensitySum: number }> = {};
    SKILL_TAGS.forEach(t => { stats[t.value] = { count: 0, minutes: 0, intensitySum: 0 }; });
    filtered.forEach(s => {
      // pillar_distribution-aware: a session contributes proportionally to each
      // pillar that had weight, so multi-chip sessions don't double-count.
      const ph = sessionPillarHours(s);
      const totalH = (s.duration ?? 0) / 60;
      for (const [k, v] of Object.entries(ph)) {
        if (k in stats && v > 0 && totalH > 0) {
          const share = v / totalH;
          stats[k]!.count += share;
          stats[k]!.minutes += v * 60;
          stats[k]!.intensitySum += (s.intensity ?? 3) * share;
        }
      }
    });
    return stats;
  }, [filtered]);

  const totalCount = filtered.length;
  const selected = pillarStats[selectedTag] ?? { count: 0, minutes: 0, intensitySum: 0 };
  const selectedLabel = SKILL_TAGS.find(t => t.value === selectedTag)?.label ?? selectedTag;

  // Intentions whose week_start falls in the active window. Mirrors the
  // semantics of `filtered` for sessions.
  const intentionsInWindow = useMemo(() => {
    if (isAllTime) return intentions;
    let windowStart: Date | null = null;
    let windowEnd: Date | null = null;
    if (timeWindow === 'custom' && customRange) {
      windowStart = new Date(customRange.start + 'T00:00:00');
      windowEnd   = new Date(customRange.end   + 'T23:59:59');
    } else {
      const days = WINDOW_DAYS[timeWindow];
      if (days != null) windowStart = new Date(Date.now() - days * 86_400_000);
    }
    return intentions.filter(i => {
      const ws = new Date(i.week_start + 'T00:00:00');
      if (windowStart && ws < windowStart) return false;
      if (windowEnd && ws > windowEnd) return false;
      return true;
    });
  }, [intentions, timeWindow, customRange, isAllTime]);

  const weeksAsFocus = intentionsInWindow.filter(i => i.heading === selectedTag).length;
  const avgIntensity = selected.count > 0 ? selected.intensitySum / selected.count : 0;

  // Recent sessions for the selected vertex — windowed.
  const recentSessions = useMemo(() => {
    return filtered
      .filter(s => s.tags?.includes(selectedTag) || s.heading === selectedTag)
      .slice()
      .sort((a, b) => {
        const ak = typeof a.date === 'string' ? a.date.slice(0, 10) : toDateString(new Date(a.date));
        const bk = typeof b.date === 'string' ? b.date.slice(0, 10) : toDateString(new Date(b.date));
        return bk.localeCompare(ak);
      })
      .slice(0, 6);
  }, [filtered, selectedTag]);

  // Intentions targeting the selected vertex within the active window, with
  // alignment computed from the original (un-windowed) sessions so an
  // intention's score reflects the full week it covered, even if the window
  // chops a piece off.
  const focusIntentions = useMemo(() => {
    return intentionsInWindow
      .filter(i => i.heading === selectedTag)
      .slice()
      .sort((a, b) => b.week_start.localeCompare(a.week_start))
      .slice(0, 6)
      .map(i => {
        const top   = topTagInRange(sessions, i.week_start, i.duration_days);
        const hours = tagHoursInRange(sessions, i.week_start, i.duration_days);
        const a     = computeAlignment(i, top, hours);
        return { intention: i, alignment: a };
      });
  }, [intentionsInWindow, sessions, selectedTag]);

  const descriptions: Record<string, string> = {
    standup:     'Where it begins. Grip fighting, entries, takedowns, the scramble before the mat.',
    guard:       'Where you live on your back. Sweeps, submissions, off-balancing — the long exchange.',
    passing:     'The long game above the legs. Pressure, angles, and the patience of the knee-cut.',
    pins:        'Mount, side, back — dynamic control. The art of staying and arriving.',
    submissions: 'The ending itself. Finish mechanics that carry across every belt.',
  };

  // ── Reading sentence ────────────────────────────────────────────────────
  // The editorial line that frames the page. Adapts per sub-view so the
  // headline always speaks to whatever lens the user is currently looking
  // through — the Shape view's pillar story is irrelevant when the reader
  // is staring at a Gi/No-Gi donut.
  const readingSentence = useMemo(() => {
    if (totalHours <= 0) return 'No training logged in this window.';

    const hoursLabel = (h: number) =>
      h >= 100 ? Math.round(h).toString() : h.toFixed(1);
    const totalLabel = `${hoursLabel(totalHours)}h`;

    // ── Shape — pillar-shape narrative ────────────────────────────────
    if (subView === 'prism') {
      const trained = SKILL_TAGS
        .map(t => ({ value: t.value, label: t.label, hours: (pillarStats[t.value]?.minutes ?? 0) / 60 }))
        .filter(p => p.hours > 0)
        .sort((a, b) => b.hours - a.hours);
      const top    = trained[0];
      const bottom = trained[trained.length - 1];
      const pillarsWord = trained.length === 1 ? 'pillar' : 'pillars';
      let s = `${totalLabel} across ${trained.length} ${pillarsWord}.`;
      if (top) {
        s += ` You've spent the most time on ${top.label}`;
        if (bottom && top !== bottom && trained.length >= 3 && bottom.hours < top.hours * 0.4) {
          s += `, and the least on ${bottom.label}`;
        }
        s += '.';
      }
      return s;
    }

    // ── Volume — monthly cadence ──────────────────────────────────────
    if (subView === 'volume') {
      const monthly = Array(12).fill(0) as number[];
      for (const s of filtered) {
        const d = typeof s.date === 'string' ? new Date(s.date.slice(0, 10) + 'T00:00:00') : new Date(s.date);
        if (!isNaN(d.getTime())) monthly[d.getMonth()] += (s.duration ?? 0) / 60;
      }
      const trainedMonths = monthly.filter(h => h > 0).length;
      if (trainedMonths === 0) return `${totalLabel} logged in this window.`;
      const peakIdx = monthly.indexOf(Math.max(...monthly));
      const peakName = ['January','February','March','April','May','June','July','August','September','October','November','December'][peakIdx];
      return `${totalLabel} logged across ${trainedMonths} ${trainedMonths === 1 ? 'month' : 'months'}. Peak was ${peakName} at ${hoursLabel(monthly[peakIdx]!)}h.`;
    }

    // ── Weekly — week-by-week rhythm ─────────────────────────────────
    if (subView === 'weekly') {
      const monday = (d: Date) => {
        const c = new Date(d); const dow = c.getDay();
        c.setDate(c.getDate() - (dow === 0 ? 6 : dow - 1));
        c.setHours(0, 0, 0, 0); return c;
      };
      const weekMap = new Map<string, number>();
      for (const s of filtered) {
        const d = typeof s.date === 'string' ? new Date(s.date.slice(0, 10) + 'T00:00:00') : new Date(s.date);
        if (isNaN(d.getTime())) continue;
        const key = monday(d).toISOString().slice(0, 10);
        weekMap.set(key, (weekMap.get(key) ?? 0) + (s.duration ?? 0) / 60);
      }
      const activeWeeks = weekMap.size;
      if (activeWeeks === 0) return `${totalLabel} logged in this window.`;
      let peakHrs = 0; let peakKey = '';
      for (const [k, v] of weekMap) if (v > peakHrs) { peakHrs = v; peakKey = k; }
      const peakDate = new Date(peakKey + 'T00:00:00');
      const peakLabel = peakDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${totalLabel} across ${activeWeeks} active ${activeWeeks === 1 ? 'week' : 'weeks'}. Peak was the week of ${peakLabel} at ${hoursLabel(peakHrs)}h.`;
    }

    // ── Split — Gi vs No-Gi ──────────────────────────────────────────
    if (subView === 'split') {
      // 'both' (mig 025) counts 0.5 toward each side.
      const gi    = filtered.reduce((a, s) => a + (s.duration ?? 0) / 60 * giShare(s.gi_nogi), 0);
      const nogi  = filtered.reduce((a, s) => a + (s.duration ?? 0) / 60 * nogiShare(s.gi_nogi), 0);
      const total = gi + nogi;
      if (total <= 0) return `${totalLabel} logged — no Gi or No-Gi training tagged in this window.`;
      const giPct   = Math.round((gi / total) * 100);
      const nogiPct = 100 - giPct;
      // Single-side dominance: lean into the call. Otherwise just state the ratio.
      if (giPct >= 90)   return `${totalLabel} total. Almost entirely Gi training — No-Gi makes up just ${nogiPct}%.`;
      if (nogiPct >= 90) return `${totalLabel} total. Almost entirely No-Gi training — Gi makes up just ${giPct}%.`;
      return `${totalLabel} total. ${giPct}% Gi, ${nogiPct}% No-Gi.`;
    }

    // ── Format — Class / Drill / Comp ────────────────────────────────
    if (subView === 'format') {
      const cls   = filtered.filter(s => s.session_type === 'class').reduce((a, s) => a + (s.duration ?? 0) / 60, 0);
      const drill = filtered.filter(s => s.session_type === 'drilling').reduce((a, s) => a + (s.duration ?? 0) / 60, 0);
      const comp  = filtered.filter(s => s.session_type === 'competition_training').reduce((a, s) => a + (s.duration ?? 0) / 60, 0);
      const total = cls + drill + comp;
      if (total <= 0) return `${totalLabel} logged — no class, drill, or competition formats tagged in this window.`;
      const clsPct   = Math.round((cls / total) * 100);
      const drillPct = Math.round((drill / total) * 100);
      const compPct  = Math.max(0, 100 - clsPct - drillPct);
      if (clsPct >= 90)   return `${totalLabel} total. Almost all in class — drilling and competition are rare.`;
      if (drillPct >= 90) return `${totalLabel} total. Almost all drilling — class and competition are rare.`;
      if (compPct >= 90)  return `${totalLabel} total. Almost all competition training — class and drilling are rare.`;
      return `${totalLabel} total. ${clsPct}% class, ${drillPct}% drilling, ${compPct}% competition.`;
    }

    return `${totalLabel} logged in this window.`;
  }, [subView, totalHours, pillarStats, filtered]);

  return (
    <>
      {/* ── Sticky time-window band ────────────────────────────────────
          Sticky control bar — date pills on the left, active-window readout
          on the right (small caps). Tighter than v1's 14px padding so it
          reads as utility, not as a feature zone. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backgroundColor: 'rgba(13,26,20,0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(196,145,95,0.10)',
          marginLeft: isDesktop ? -64 : -16,
          marginRight: isDesktop ? -64 : -16,
          marginBottom: isDesktop ? 36 : 22,
          padding: isDesktop ? '12px 64px' : '10px 16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            maxWidth: 1360,
            margin: '0 auto',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <TimeRangeBar
              value={timeWindow}
              onChange={onWindowChange}
              customRange={customRange}
              onCustomRange={onCustomRangeChange}
            />
          </div>
          {isDesktop && (
            <div
              style={{
                flexShrink: 0,
                fontSize: 12,
                color: 'rgba(255,255,255,0.42)',
                letterSpacing: '0.20em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {windowLabel}
            </div>
          )}
        </div>
      </div>

      {/* ── Reading sentence ────────────────────────────────────────────
          Left-aligned editorial line. Window label moved to the band, so
          the sentence stands alone. */}
      <div
        style={{
          maxWidth: 900,
          margin: isDesktop ? '0 0 52px' : '0 0 32px',
          padding: 0,
        }}
      >
        <p
          style={{
            fontFamily: FONT_EDITORIAL,
            fontSize: isDesktop ? 36 : 24,
            fontWeight: 500,
            lineHeight: 1.35,
            color: PALE_YELLOW,
            textShadow: GLOW_SOFT,
            margin: 0,
            textAlign: 'left',
          }}
        >
          {readingSentence}
        </p>
      </div>

      {/* ── Deck (chrome-less) ──────────────────────────────────────── */}
      <ErrorBoundary>
        <AtlasPrismDeck
          sessions={sessions}
          intentions={intentions}
          timeWindow={timeWindow}
          customRange={customRange}
          selectedTag={selectedTag}
          onSelectTag={onSelectTag}
          viewMode={subView}
          onViewModeChange={setSubView}
          bigPrismSize={isDesktop ? 600 : 280}
        />
      </ErrorBoundary>

      {/* ── Selected vertex zoom — chrome-less, separated by hairline.
          Hidden on non-Shape sub-views since vertex selection isn't possible
          there (donut/bar charts have no clickable per-pillar surface). */}
      {subView === 'prism' && (
        <AtlasPrismSelectedVertexZoom
          selectedTag={selectedTag}
          selectedLabel={selectedLabel}
          description={descriptions[selectedTag] ?? 'Your training in this pillar.'}
          selected={selected}
          totalCount={totalCount}
          weeksAsFocus={weeksAsFocus}
          avgIntensity={avgIntensity}
          windowLabel={windowLabel}
          isAllTime={isAllTime}
          recentSessions={recentSessions}
          focusIntentions={focusIntentions}
          isDesktop={isDesktop}
          onOpenSession={onOpenSession}
          onOpenIntentionJournal={onOpenIntentionJournal}
        />
      )}
    </>
  );
}
