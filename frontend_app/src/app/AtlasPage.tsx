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
import { PALE_YELLOW, GLOW_SOFT } from '../lib/theme.ts';
import { type TimeWindow } from '../lib/analyticsUtils.ts';
import AtlasEmptyHero from '../components/empty/AtlasEmptyHero.tsx';
import AtlasSegmentedToggle from '../components/atlas/AtlasSegmentedToggle.tsx';
import Last30IntensityCard from '../components/atlas/Last30IntensityCard.tsx';
import AtlasAnnualRadialHero from '../components/atlas/AtlasAnnualRadialHero.tsx';
import AtlasCalendarPanel from '../components/atlas/AtlasCalendarPanel.tsx';
import AtlasTimelinePanel from '../components/atlas/AtlasTimelinePanel.tsx';
import AtlasPrismPanel from '../components/atlas/AtlasPrismPanel.tsx';
import { SKILL_TAGS } from '../lib/constants.ts';

const LS_TAB_KEY = 'j2_atlas_tab';
type AtlasTab = 'timeline' | 'prism' | 'library' | 'calendar';
const TABS: { id: AtlasTab; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'prism',    label: 'Analytics' },
  { id: 'library',  label: 'Library'  },
  { id: 'calendar', label: 'Calendar' },
];

// ── Atlas page ─────────────────────────────────────────────────────────────

export default function AtlasPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  // Mobile renders Prism-only (the merged analytics view). The other Atlas
  // tabs (Timeline / Library / Calendar) stay desktop-only for now —
  // Calendar mobile users have the dedicated `/calendar` route in the
  // bottom nav, Timeline/Library don't have mobile analogues yet.
  const [tab, setTab] = useState<AtlasTab>(() => {
    const stored = localStorage.getItem(LS_TAB_KEY);
    // 'library' used to render an inline "Coming Soon" placeholder; it now
    // routes to /library instead. If a user has 'library' persisted from
    // the old behaviour, normalize back to the default so we don't briefly
    // flash a now-removed panel before redirecting.
    if (stored === 'library') return 'timeline';
    return TABS.some(t => t.id === stored) ? (stored as AtlasTab) : 'timeline';
  });
  useEffect(() => { localStorage.setItem(LS_TAB_KEY, tab); }, [tab]);

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
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
              The patterns in your training
            </p>
          </div>
          {fetchError && <p className="text-sm text-red-400">{fetchError}</p>}
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

  // ── Desktop: full 4-tab editorial layout ─────────────────────────────
  return (
    <PageContent ready={!loading} loadingMessages={['Charting the year...', 'Measuring the ring...', 'Lacing up for the long look...']}>
    <div className="j2-page-container" style={{ paddingTop: 64, paddingBottom: 104 }}>

      {/* ── Header ───────────────────────────────────────────────────
          On the Analytics tab the page-level editorial frame compresses to
          just the kicker — the reading sentence below the sticky band
          becomes the primary headline for that view. Other tabs keep the
          full "Look back at your training." treatment. */}
      <div
        style={{
          display: 'flex',
          alignItems: tab === 'prism' ? 'center' : 'flex-end',
          justifyContent: 'space-between',
          marginBottom: tab === 'prism' ? 28 : 44,
        }}
      >
        <div>
          <div className="j2-label-micro" style={{ marginBottom: tab === 'prism' ? 0 : 16 }}>Atlas</div>
          {tab !== 'prism' && (
            <>
              <h1 className="j2-serif-display j2-heading-glow" style={{ fontSize: 72, margin: 0 }}>
                Look back at your training.
              </h1>
              <div className="j2-serif-italic" style={{ marginTop: 14, fontSize: 22 }}>
                Where the patterns show up — across weeks, months, and years.
              </div>
            </>
          )}
        </div>
        <AtlasSegmentedToggle
          tabs={TABS}
          value={tab}
          onChange={(next) => {
            // Library is a navigation jump, not a local tab. Selecting it
            // routes to /library instead of switching the Atlas panel; the
            // other three tabs (timeline / prism / calendar) stay local.
            if (next === 'library') {
              navigate('/library');
              return;
            }
            setTab(next);
          }}
        />
      </div>

      {fetchError && <p style={{ fontSize: 13, color: '#F87171', marginBottom: 16 }}>{fetchError}</p>}

      {/* ── Panels ──────────────────────────────────────────────── */}
      {tab === 'timeline' && (
        <AtlasTimelinePanel sessions={allSessions} intentions={intentions} />
      )}

      {tab === 'prism' && (
        <>
          {/* Annual radial — moved here from /home (Path Ahead) since the
              year-shaped reflection belongs to Atlas's reflective register,
              not the operational dashboard. Sits at the top of the Prism tab
              as a hero before the existing PrismPanel content. */}
          <AtlasAnnualRadialHero
            sessions={allSessions}
            intentions={intentions}
            currentYear={currentYear}
          />

          {/* Last 30 days · intensity — moved here from PathAhead. Reflective
              snapshot ("how was last month") belongs in Atlas's analytical
              register; PathAhead is operational. */}
          <Last30IntensityCard sessions={allSessions} />

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
            isDesktop={true}
          />
        </>
      )}


      {tab === 'calendar' && (
        <AtlasCalendarPanel
          sessions={allSessions}
          intentions={intentions}
          year={calendarYear}
          onYearChange={setCalendarYear}
          currentYear={currentYear}
          loading={loading}
          onRefetch={fetchAll}
        />
      )}
    </div>
    </PageContent>
  );
}


// (PrismPanel + SelectedVertexZoom extracted to components/atlas/AtlasPrismPanel.tsx
// during the 2026-05-09 page-file refactor. BigPrism lives in components/atlas/BigPrism.tsx.)


