import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useBeltHistory } from '../hooks/useBeltHistory.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import CaptureComposer from '../components/composer/CaptureComposer.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import YearBook from '../components/calendar/YearBook.tsx';
import ChapterView from '../components/calendar/ChapterView.tsx';
import WeekSpread from '../components/calendar/WeekSpread.tsx';
import { Search, X } from 'lucide-react';
import SessionSearchPanel from '../components/SessionSearchPanel.tsx';
import Coachmark from '../components/Coachmark.tsx';
import { useCoachmark } from '../hooks/useCoachmark.ts';
import { COPPER, SURFACE_2 } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { toDateString } from '../lib/sessionUtils.ts';
import { sessionDateKey } from '../lib/analyticsUtils.ts';
import { MONTH_FULL, buildChapters, shiftDays } from '../lib/calendarBook.ts';
import type { Chapter } from '../lib/calendarBook.ts';
import type { SessionSummary, Intention, SessionsResponse, IntentionsResponse } from '../types/api.ts';

// The Calendar reads the year as a book: year → chapter → week → entry.
// Which page is open lives in the URL (?chapter=, ?month=, ?week=) so the
// phone's back gesture walks back up the book.
export default function CalendarPage() {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { intentionsEnabled } = useProfile();
  const calendarCoachmark = useCoachmark('calendar');
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [intentions,  setIntentions]  = useState<Intention[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [flipDir,     setFlipDir]     = useState<'forward' | 'back' | null>(null);
  const [logDate,     setLogDate]     = useState<string | null>(null); // YYYY-MM-DD for log-from-calendar
  const [searchOpen,  setSearchOpen]  = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const todayStr = toDateString(new Date());
  const currentYear = new Date().getFullYear();

  const navigateYear = (dir: 1 | -1) => {
    setFlipDir(dir === 1 ? 'forward' : 'back');
    setDisplayYear(y => y + dir);
  };

  const handleLogSession = useCallback((dateKey: string) => setLogDate(dateKey), []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const [sesData, intData] = await Promise.all([
        api.get<SessionsResponse>(`/api/sessions?from=${displayYear}-01-01&to=${displayYear}-12-31`),
        api.get<IntentionsResponse>('/api/intentions'),
      ]);
      setSessions(sesData.sessions ?? []);
      setIntentions(intData.intentions ?? []);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setFetchError('Could not load sessions. Please refresh.');
      }
    } finally {
      setLoading(false);
    }
  }, [displayYear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useOnlineRefetch(fetchAll);

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(
    () => [...sessions, ...pendingSessions].filter(s => sessionDateKey(s).slice(0, 4) === String(displayYear)),
    [sessions, pendingSessions, displayYear],
  );

  const { entries: beltHistory } = useBeltHistory();
  const promotions = useMemo(
    () => beltHistory.filter(p => p.promoted_at.slice(0, 4) === String(displayYear)),
    [beltHistory, displayYear],
  );

  const chapters = useMemo(
    () => buildChapters(allSessions, intentionsEnabled ? intentions : [], displayYear, todayStr),
    [allSessions, intentions, intentionsEnabled, displayYear, todayStr],
  );

  // ── Which page of the book is open ────────────────────────────────────────
  const chapterKey = params.get('chapter');
  const monthParam = params.get('month');
  const weekParam = params.get('week');

  const openChapter: Chapter | null = useMemo(() => {
    if (chapterKey) return chapters.find(c => c.key === chapterKey) ?? null;
    if (monthParam != null) {
      const m = Number(monthParam);
      if (!Number.isInteger(m) || m < 0 || m > 11) return null;
      const prefix = `${displayYear}-${String(m + 1).padStart(2, '0')}`;
      const start = `${prefix}-01`;
      const end = `${prefix}-${String(new Date(displayYear, m + 1, 0).getDate()).padStart(2, '0')}`;
      return {
        key: `book-${prefix}`,
        kind: 'month',
        title: MONTH_FULL[m]!,
        pillar: null,
        start,
        end,
        ongoing: todayStr >= start && todayStr <= end,
        number: null,
        intention: null,
        sessions: allSessions
          .filter(s => sessionDateKey(s).startsWith(prefix))
          .sort((a, b) => sessionDateKey(a).localeCompare(sessionDateKey(b))),
      };
    }
    return null;
  }, [chapterKey, monthParam, chapters, allSessions, displayYear, todayStr]);

  const weekMonday = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : null;

  const goTo = useCallback((next: Record<string, string>) => {
    setParams(next, { state: { calendarNav: true } });
  }, [setParams]);

  // Back walks up one level: through history when we pushed it, else by URL
  const goBack = useCallback((fallback: Record<string, string>) => {
    if ((location.state as { calendarNav?: boolean } | null)?.calendarNav) navigate(-1);
    else setParams(fallback, { replace: true });
  }, [location.state, navigate, setParams]);

  const chapterParams: Record<string, string> = chapterKey
    ? { chapter: chapterKey }
    : monthParam != null ? { month: monthParam } : {};

  // A new page starts at its top
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [chapterKey, monthParam, weekParam]);

  const handleMoveWeek = useCallback((monday: string) => {
    const year = Number(shiftDays(monday, 3).slice(0, 4));
    if (year !== displayYear) setDisplayYear(year);
    setParams({ ...chapterParams, week: monday }, { replace: true, state: location.state });
  }, [displayYear, setParams, chapterParams, location.state]);

  return (
    <>
    {/* Log session modal — triggered from a rest day in a week */}
    {logDate && (
      <div
        data-no-page-swipe=""
        role="dialog"
        aria-modal="true"
        aria-label="Log session"
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-5"
        style={{
          backgroundColor: 'rgba(13, 26, 20, 1)',
          backdropFilter: 'blur(16px)',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        onClick={() => setLogDate(null)}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="w-full sm:max-w-lg lg:max-w-5xl animate-j2-modal-in"
        >
          <CaptureComposer
            onSuccess={() => { fetchAll(); setLogDate(null); }}
            onCancel={() => setLogDate(null)}
            defaultDate={logDate}
          />
        </div>
      </div>
    )}

    <div
      ref={topRef}
      className={`space-y-5 ${isDesktop ? 'j2-page-container' : 'mx-auto px-4 sm:px-6'}`}
      style={{ maxWidth: 640, marginInline: 'auto', ...(isDesktop ? { paddingTop: 20, paddingBottom: 20 } : { paddingTop: 16, paddingBottom: 24 }) }}
    >
      <div className="flex items-center justify-end">
        <button
          onClick={() => setSearchOpen(v => !v)}
          className="flex items-center justify-center rounded-lg transition-colors touch-manipulation"
          style={{
            width: 44,
            height: 44,
            backgroundColor: searchOpen ? COPPER : SURFACE_2,
            color: searchOpen ? '#fff' : 'rgba(242,228,168,0.45)',
          }}
          aria-label={searchOpen ? 'Close search' : 'Search sessions'}
        >
          {searchOpen ? <X size={16} /> : <Search size={16} />}
        </button>
      </div>

      {fetchError && <p className="text-sm text-error">{fetchError}</p>}

      {searchOpen ? (
        <SessionSearchPanel
          cachedSessions={allSessions}
          onRefresh={fetchAll}
        />
      ) : (
        <ErrorBoundary>
          {weekMonday ? (
            <WeekSpread
              monday={weekMonday}
              sessions={allSessions}
              todayStr={todayStr}
              backLabel={openChapter?.title ?? String(displayYear)}
              onBack={() => goBack(chapterParams)}
              onMoveWeek={handleMoveWeek}
              onLogSession={handleLogSession}
              onSessionUpdated={fetchAll}
            />
          ) : openChapter ? (
            <ChapterView
              chapter={openChapter}
              year={displayYear}
              todayStr={todayStr}
              promotions={promotions}
              onBack={() => goBack({})}
              onOpenWeek={monday => goTo({ ...chapterParams, week: monday })}
            />
          ) : (
            <div
              key={displayYear}
              onAnimationEnd={() => setFlipDir(null)}
              style={flipDir ? {
                animation: `j2PageFlip${flipDir === 'forward' ? 'Forward' : 'Back'} 380ms ease-out both`,
              } : undefined}
            >
              <YearBook
                year={displayYear}
                todayStr={todayStr}
                sessions={allSessions}
                chapters={chapters}
                promotions={promotions}
                loading={loading}
                canGoForward={displayYear < currentYear}
                onYearChange={navigateYear}
                onOpenChapter={c => goTo({ chapter: c.key })}
                onOpenMonth={m => goTo({ month: String(m) })}
              />
            </div>
          )}
        </ErrorBoundary>
      )}
    </div>

    <Coachmark
      open={calendarCoachmark.isOpen}
      onDismiss={calendarCoachmark.dismiss}
      eyebrow="◇ Calendar"
      title="Your year, as a book."
      body="Each intention is a chapter. Open one to read it back week by week, or tap a month on the shelf."
    />
    </>
  );
}
