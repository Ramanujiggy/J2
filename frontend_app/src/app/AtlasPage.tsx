// Atlas — desktop-only aggregate view with 4 sub-tabs:
//
//   • Timeline — year-by-year horizontal strips with session dots + focus ribbon
//   • Prism    — merged Prism Lab + Analytics: time-windowed pentagon (BigPrism)
//                with 5-view sub-rail, hero stats strip, alignment overlay, and
//                vertex-selected sessions/intentions panel below
//   • Library  — navigation jump to /library (the Technique Library lives at its
//                own route; selecting this tab in Atlas routes the user there
//                instead of rendering an Atlas-internal panel)
//   • Calendar — reuses existing TrainingHeatmap (the traditional detailed view)
//
// Mobile visitors are redirected to /calendar — Atlas is strictly a desktop surface.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useActiveIntention } from '../context/ActiveIntentionContext.tsx';
import { useSessions } from '../context/SessionsContext.tsx';
import PageContent from '../components/PageContent.tsx';
import { PALE_YELLOW, GLOW_SOFT, STATUS_ERROR, TEXT_SECONDARY, TEXT_TERTIARY, TEXT_HINT } from '../lib/theme.ts';
import { type TimeWindow } from '../lib/analyticsUtils.ts';
import AtlasEmptyHero from '../components/empty/AtlasEmptyHero.tsx';
import AtlasCalendarPanel from '../components/atlas/AtlasCalendarPanel.tsx';
import AtlasTimelinePanel from '../components/atlas/AtlasTimelinePanel.tsx';
import AtlasPrismPanel from '../components/atlas/AtlasPrismPanel.tsx';
import AtlasInstruments, { INSTRUMENTS, type Instrument } from '../components/atlas/AtlasInstruments.tsx';
import { pillarShares } from '../lib/atlasVerdicts.ts';
import { pillarLabel } from '../lib/prismGeometry.ts';
import { portraitDistributions } from '../lib/homeViewModel.ts';
import { toDateString } from '../lib/sessionUtils.ts';
import { toast } from '../hooks/use-toast.ts';
import { FONT_EDITORIAL } from '../lib/theme.ts';
import type { SessionSummary } from '../types/api.ts';
import { SKILL_TAGS } from '../lib/constants.ts';

const LS_INSTRUMENT_KEY = 'j2_atlas_instrument';

/** Desktop surfaces. The prism is the page; the other two are the panels
 *  Atlas has always had, now reached from the header links rather than
 *  from a tab strip that made them look like peers of the instrument. */
type AtlasSurface = 'prism' | 'years' | 'calendar';

// ── Atlas page ─────────────────────────────────────────────────────────────

export default function AtlasPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  // Mobile still renders the Prism panel only. Its own pass will bring the
  // instruments across; until then Calendar mobile users have the dedicated
  // `/calendar` route in the bottom nav.

  // Sessions + intentions both come from shared contexts now (perf Tier 3 #8
  // for sessions; Tier 2 for intentions). Atlas wants the broadest "all-time"
  // session history, which is exactly what SessionsContext provides (≤1000 by
  // default, mig-029).
  const { sessions, loading: sessionsLoading, error: fetchError, refresh: fetchAll } = useSessions();
  const { intentions, loading: intentionsLoading } = useActiveIntention();
  const loading = sessionsLoading || intentionsLoading;

  // Calendar year navigation (tab-local state)
  const currentYear = new Date().getFullYear();
  const [calendarYear, setCalendarYear] = useState(currentYear);

  // Prism tab state — lifted so the user's window/vertex selections persist
  // across Atlas-tab switches (they unmount the panel otherwise).
  // localStorage key kept as `j2-analytics-timeWindow` so existing user
  // preferences carry over from the retired /analytics route.
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    if (typeof window === 'undefined') return '30d';
    const stored = window.localStorage.getItem('j2-analytics-timeWindow');
    return (stored as TimeWindow) ?? '30d';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('j2-analytics-timeWindow', timeWindow);
    }
  }, [timeWindow]);
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>(SKILL_TAGS[0]!.value);

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(() => [...sessions, ...pendingSessions], [sessions, pendingSessions]);

  // ── Desktop surfaces ─────────────────────────────────────────────────
  // 'prism' is the page; 'years' and 'calendar' are the same panels Atlas
  // always had, now reached from the header links.
  const [surface, setSurface] = useState<AtlasSurface>('prism');
  const [instrument, setInstrument] = useState<Instrument>(() => {
    const stored = localStorage.getItem(LS_INSTRUMENT_KEY);
    return INSTRUMENTS.some(i => i.id === stored && !i.stub) ? (stored as Instrument) : 'overlay';
  });
  useEffect(() => { localStorage.setItem(LS_INSTRUMENT_KEY, instrument); }, [instrument]);

  const sessionYear = (s: SessionSummary) =>
    (typeof s.date === 'string' ? s.date : toDateString(new Date(s.date))).slice(0, 4);
  const sessionKey = (s: SessionSummary) =>
    (typeof s.date === 'string' ? s.date : toDateString(new Date(s.date))).slice(0, 10);

  /** This year's sessions — the instruments describe the current year. */
  const yearSessions = useMemo(
    () => allSessions.filter(s => sessionYear(s) === String(currentYear)),
    [allSessions, currentYear],
  );
  const yearShapes = useMemo(() => portraitDistributions(yearSessions), [yearSessions]);

  /** Weeks of the current year, oldest first, labelled by their Monday. */
  const weekGroups = useMemo(() => {
    const buckets = new Map<string, SessionSummary[]>();
    for (const s of yearSessions) {
      const d = new Date(sessionKey(s) + 'T00:00:00');
      const dow = d.getDay();
      d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      const key = toDateString(d);
      const list = buckets.get(key);
      if (list) list.push(s); else buckets.set(key, [s]);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, group]) => ({
        label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
          .format(new Date(key + 'T00:00:00')),
        shapes: portraitDistributions(group),
      }));
  }, [yearSessions]);

  /** The most recent prior year with sessions — the ghost. */
  const ghostYear = useMemo(() => {
    const years = [...new Set(allSessions.map(sessionYear))]
      .filter(y => y < String(currentYear))
      .sort((a, b) => b.localeCompare(a));
    const target = years[0];
    if (!target) return null;
    return {
      label: target,
      shapes: portraitDistributions(allSessions.filter(s => sessionYear(s) === target)),
    };
  }, [allSessions, currentYear]);

  /** The years band — density and a one-line summary per year. */
  const yearRows = useMemo(() => {
    const byYear = new Map<string, SessionSummary[]>();
    for (const s of allSessions) {
      const y = sessionYear(s);
      const list = byYear.get(y);
      if (list) list.push(s); else byYear.set(y, [s]);
    }
    return [...byYear.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, group]) => {
        const ticks = new Array(24).fill(0);
        for (const s of group) {
          const key = sessionKey(s);
          const month = Number(key.slice(5, 7)) - 1;
          const day = Number(key.slice(8, 10));
          ticks[Math.min(23, month * 2 + (day > 15 ? 1 : 0))] += 1;
        }
        const peak = Math.max(...ticks, 1);
        const hours = Math.round(group.reduce((a, s) => a + (s.duration ?? 0), 0) / 60);
        const top = pillarShares(portraitDistributions(group))[0];
        return {
          year,
          ticks: ticks.map(n => n / peak),
          summary: `${group.length} session${group.length === 1 ? '' : 's'} · ${hours} h${top && top.share > 0 ? ` · mostly ${pillarLabel(top.pillar)}` : ''}`,
        };
      });
  }, [allSessions]);

  // ── Mobile: Prism-only ───────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <PageContent ready={!loading} loadingMessages={['Charting the year...']}>
        <div className="mx-auto space-y-4 max-w-5xl px-4 sm:px-6 py-6">
          <div>
            <h2
              className="text-2xl font-display font-bold tracking-tight"
              style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
            >
              Atlas
            </h2>
            <p className="text-xs mt-1" style={{ color: TEXT_HINT }}>
              The patterns in your training
            </p>
          </div>
          {fetchError && <p className="text-sm text-error">{fetchError}</p>}
          {!loading && allSessions.length === 0 ? (
            <AtlasEmptyHero />
          ) : (
            <AtlasPrismPanel
              sessions={allSessions}
              intentions={intentions}
              timeWindow={timeWindow}
              onWindowChange={setTimeWindow}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
              selectedTag={selectedTag}
              onSelectTag={setSelectedTag}
              onOpenSession={(id) => navigate(`/journal/${id}`)}
              onOpenIntentionJournal={(id) => navigate(`/intentions/${id}/journal`)}
              isDesktop={false}
            />
          )}
        </div>
      </PageContent>
    );
  }

  // -- Desktop: the instruments ------------------------------------------
  // The prism IS the page now. Years, Library and Calendar keep existing as
  // their own surfaces, reached from the quiet header links rather than
  // competing with the instrument for one tab strip.
  const backLink = (
    <button
      type="button"
      onClick={() => setSurface('prism')}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
        background: 'none', border: 'none', cursor: 'pointer',
        color: TEXT_SECONDARY, fontSize: 12, fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}
    >
      <span style={{ fontSize: 19, color: TEXT_HINT }}>&lsaquo;</span>
      <span>Atlas</span>
    </button>
  );

  return (
    <PageContent ready={!loading} loadingMessages={['Charting the year...', 'Measuring the ring...', 'Lacing up for the long look...']}>
    <div className="j2-desk-page">
      {fetchError && <p style={{ fontSize: 13, color: STATUS_ERROR, marginBottom: 16 }}>{fetchError}</p>}

      {surface === 'years' && (
        <>
          {backLink}
          <AtlasTimelinePanel sessions={allSessions} intentions={intentions} />
        </>
      )}

      {surface === 'calendar' && (
        <>
          {backLink}
          <AtlasCalendarPanel
            sessions={allSessions}
            intentions={intentions}
            year={calendarYear}
            onYearChange={setCalendarYear}
            currentYear={currentYear}
            loading={loading}
            onRefetch={fetchAll}
          />
        </>
      )}

      {surface === 'prism' && (
        <>
          {/* Header - title left, the other three surfaces as quiet links */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px 24px' }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
                Atlas
              </div>
              <h1
                style={{
                  fontFamily: FONT_EDITORIAL, fontSize: 33, fontWeight: 600,
                  color: PALE_YELLOW, letterSpacing: '-0.01em', margin: '8px 0 0',
                }}
              >
                Look back at your training
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, fontWeight: 600, color: TEXT_TERTIARY, paddingBottom: 8 }}>
              {([
                ['Years', () => setSurface('years')],
                ['Library', () => navigate('/library')],
                ['Calendar', () => setSurface('calendar')],
              ] as [string, () => void][]).map(([label, go]) => (
                <button
                  key={label}
                  type="button"
                  onClick={go}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.66)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.46)'; }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!loading && allSessions.length === 0 ? (
            <div style={{ marginTop: 34 }}><AtlasEmptyHero /></div>
          ) : (
            <>
              {/* One segmented control drives the body */}
              <div style={{ marginTop: 18, display: 'inline-flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, overflow: 'hidden' }}>
                {INSTRUMENTS.map(inst => {
                  const on = instrument === inst.id;
                  return (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => {
                        if (inst.stub) { toast({ title: inst.label + ' \u2014 drawn in a later pass.' }); return; }
                        setInstrument(inst.id);
                      }}
                      aria-pressed={on}
                      style={{
                        height: 36, padding: '0 16px',
                        fontSize: 12, fontWeight: 700,
                        background: on ? 'rgba(196,145,95,0.9)' : 'transparent',
                        color: on ? '#12130e' : 'rgba(255,255,255,0.46)',
                        border: 'none', cursor: 'pointer',
                        opacity: inst.stub ? 0.5 : 1,
                      }}
                    >
                      {inst.label}
                    </button>
                  );
                })}
              </div>

              <AtlasInstruments
                instrument={instrument}
                shapes={yearShapes}
                sessions={yearSessions}
                weeks={weekGroups}
                ghost={ghostYear}
                onStub={label => toast({ title: label + ' \u2014 drawn in a later pass.' })}
              />

              {/* The years - a teaser band; the full surface is one link up */}
              <div style={{ marginTop: 44, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: TEXT_TERTIARY, margin: '14px 0 2px' }}>
                  The years
                </div>
                {yearRows.map(row => (
                  <button
                    key={row.year}
                    type="button"
                    onClick={() => setSurface('years')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 22, width: '100%',
                      textAlign: 'left', padding: '13px 0',
                      background: 'none', border: 'none',
                      borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                    }}
                  >
                    <b style={{ fontFamily: FONT_EDITORIAL, fontSize: 22, color: PALE_YELLOW, fontWeight: 600, width: 70, flex: 'none' }}>
                      {row.year}
                    </b>
                    <span style={{ flex: 1, display: 'flex', gap: 3, height: 20, alignItems: 'flex-end' }} aria-hidden>
                      {row.ticks.map((tick, i) => (
                        <i key={i} style={{ flex: 1, height: tick === 0 ? 2 : Math.round(4 + tick * 16), background: 'rgba(196,145,95,0.5)', borderRadius: 1, opacity: tick === 0 ? 0.25 : 0.85 }} />
                      ))}
                    </span>
                    <span style={{ width: 240, flex: 'none', textAlign: 'right', fontSize: 11, color: TEXT_TERTIARY }}>
                      {row.summary}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
    </PageContent>
  );
}


// (PrismPanel + SelectedVertexZoom extracted to components/atlas/AtlasPrismPanel.tsx
// during the 2026-05-09 page-file refactor. BigPrism lives in components/atlas/BigPrism.tsx.)


