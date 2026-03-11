// Training Calendar — unified scrollable grid, one row per week.
// Columns: Month label | Mon–Sun (7 day cells) | Notes | Journal
// Sticky header keeps day labels visible. Month label appears at month boundaries.

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const GRID_COLS = '5rem repeat(7, minmax(0, 1fr)) 13rem 7rem';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const LEGEND = [
  { color: '#1a3040', label: 'Rest' },
  { color: '#CDDFA0', label: 'Easy' },
  { color: '#6FD08C', label: 'Moderate' },
  { color: '#DA7422', label: 'High' },
] as const;

// Local-time date key — avoids UTC shift from toISOString()
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Normalize whatever the API sends for a date field into YYYY-MM-DD.
// pg returns DATE columns as "YYYY-MM-DD" strings via JSON, but this guards
// against TIMESTAMP columns coming back as Date objects or other formats.
function toDateKey(raw: unknown): string {
  if (raw instanceof Date) return localDateKey(raw);
  const s = String(raw);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s.slice(0, 10);
}

export interface SessionSummary {
  date: string;
  duration: number;
  intensity: number;
  notes?: string;
}

interface DayData {
  count: number;
  totalMinutes: number;
  maxIntensity: number;
  notes: string[];
}

const EMPTY_DAY: DayData = { count: 0, totalMinutes: 0, maxIntensity: 0, notes: [] };

function cellColor(day: DayData): string {
  if (day.count === 0)          return '#1a3040';
  if (day.maxIntensity <= 2)    return '#CDDFA0';
  if (day.maxIntensity === 3)   return '#6FD08C';
  return '#DA7422';
}

function buildDayMap(sessions: SessionSummary[]): Map<string, DayData> {
  const map = new Map<string, DayData>();
  for (const s of sessions) {
    const key = toDateKey(s.date);
    const prev = map.get(key) ?? { ...EMPTY_DAY, notes: [] };
    map.set(key, {
      count: prev.count + 1,
      totalMinutes: prev.totalMinutes + Number(s.duration),
      maxIntensity: Math.max(prev.maxIntensity, Number(s.intensity)),
      notes: s.notes?.trim() ? [...prev.notes, s.notes.trim()] : prev.notes,
    });
  }
  return map;
}

interface WeekRow {
  days: { date: Date; day: DayData }[];
  monthLabel: string;
  isMonthStart: boolean;
}

function buildWeekRows(dayMap: Map<string, DayData>): { rows: WeekRow[]; year: number } {
  const now = new Date();
  const year = now.getFullYear();

  const jan1 = new Date(year, 0, 1);
  const dow = jan1.getDay();
  const offsetToMonday = dow === 0 ? 6 : dow - 1;
  const gridStart = new Date(year, 0, 1 - offsetToMonday);

  const dec31 = new Date(year, 11, 31);
  const rows: WeekRow[] = [];
  let cursor = new Date(gridStart);
  let lastMonth = -1;

  while (cursor <= dec31) {
    const days: WeekRow['days'] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + d);
      days.push({ date, day: dayMap.get(localDateKey(date)) ?? { ...EMPTY_DAY, notes: [] } });
    }

    const firstMonth = days[0]!.date.getMonth();
    const isMonthStart = firstMonth !== lastMonth;
    if (isMonthStart) lastMonth = firstMonth;

    rows.push({
      days,
      monthLabel: isMonthStart ? (MONTH_FULL[firstMonth] ?? '') : '',
      isMonthStart,
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return { rows, year };
}

function computeStats(sessions: SessionSummary[], year: number) {
  const thisYear = sessions.filter(s => toDateKey(s.date).slice(0, 4) === String(year));
  const totalSessions = thisYear.length;
  const totalMinutes = thisYear.reduce((sum, s) => sum + Number(s.duration), 0);

  const daySet = new Set(sessions.map(s => toDateKey(s.date)));
  const cursor = new Date();
  if (!daySet.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (daySet.has(localDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { totalSessions, totalMinutes, streak };
}

interface TrainingHeatmapProps {
  sessions?: SessionSummary[];
  loading?: boolean;
}

// Skeleton shimmer shown while sessions are fetching.
function HeatmapSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
      {/* Shimmer stats row */}
      <div className="flex gap-8 mb-6 pb-5 border-b border-white/10">
        {[80, 64, 56].map(w => (
          <div key={w}>
            <div className="h-8 rounded bg-white/10 mb-1" style={{ width: w }} />
            <div className="h-3 w-20 rounded bg-white/10" />
          </div>
        ))}
      </div>
      {/* Shimmer week rows */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-1 items-center">
            <div className="w-16 h-5 rounded bg-white/10 shrink-0" />
            {Array.from({ length: 7 }).map((__, j) => (
              <div key={j} className="flex-1 h-7 rounded bg-white/10" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrainingHeatmap({ sessions = [], loading = false }: TrainingHeatmapProps) {
  if (loading) return <HeatmapSkeleton />;

  const now = new Date();
  const dayMap = buildDayMap(sessions);
  const { rows, year } = buildWeekRows(dayMap);
  const { totalSessions, totalMinutes, streak } = computeStats(sessions, year);
  const hours = totalMinutes > 0 ? (totalMinutes / 60).toFixed(1) : '0';

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">

      {/* Stats */}
      <div className="flex gap-8 mb-6 pb-5 border-b border-white/10">
        <div>
          <p className="text-2xl font-bold text-white">{totalSessions}</p>
          <p className="text-xs text-white/40 mt-0.5">Sessions in {year}</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{hours}h</p>
          <p className="text-xs text-white/40 mt-0.5">Hours trained</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{streak}</p>
          <p className="text-xs text-white/40 mt-0.5">Day streak</p>
        </div>
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-white/60 text-sm font-medium">No sessions logged yet.</p>
          <p className="text-white/30 text-sm mt-1">Log your first session above to start tracking your year.</p>
        </div>
      )}

      {/* Scrollable calendar — hidden when empty */}
      {sessions.length > 0 && <div className="overflow-y-auto" style={{ maxHeight: 480 }}>

        {/* Sticky column headers */}
        <div
          className="grid sticky top-0 z-10 border-b border-white/10 mb-0.5"
          style={{ gridTemplateColumns: GRID_COLS, backgroundColor: '#1d3040' }}
        >
          <div className="py-2" />
          {DOW.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-white/40">
              {d}
            </div>
          ))}
          <div className="py-2 pl-4 text-xs font-medium text-white/40">Notes</div>
          <div className="py-2 pl-3 text-xs font-medium text-white/40">Journal</div>
        </div>

        {/* Week rows */}
        {rows.map((row, ri) => {
          const weekNotes = row.days.flatMap(({ day }) => day.notes).filter(Boolean);
          const noteText = weekNotes[0] ?? '';
          const extraNotes = weekNotes.length > 1 ? ` +${weekNotes.length - 1}` : '';

          return (
            <div
              key={ri}
              className={`grid items-center${row.isMonthStart && ri > 0 ? ' mt-1 border-t border-white/10 pt-1' : ''}`}
              style={{ gridTemplateColumns: GRID_COLS, minHeight: 40 }}
            >
              {/* Month label */}
              <div className="pr-2 text-xs font-semibold text-white/55 truncate">
                {row.monthLabel}
              </div>

              {/* Day cells */}
              {row.days.map(({ date, day }) => {
                const key = localDateKey(date);
                const isFuture = date > now;
                const isCurrentYear = date.getFullYear() === year;
                const dateStr = date.toDateString();
                const tooltip = day.count === 0
                  ? dateStr
                  : `${dateStr}: ${day.count} session${day.count !== 1 ? 's' : ''} · ${day.totalMinutes} min · intensity ${day.maxIntensity}/5`;
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div className="px-0.5 py-1">
                        <div
                          className="h-7 rounded cursor-default"
                          style={{
                            backgroundColor: (!isCurrentYear || isFuture) ? '#111e26' : cellColor(day),
                            opacity: (!isCurrentYear || isFuture) ? 0.18 : 1,
                          }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Notes */}
              <div
                className="pl-4 text-xs text-white/40 truncate"
                title={weekNotes.join(' · ')}
              >
                {noteText}
                {extraNotes && <span className="text-white/20">{extraNotes}</span>}
              </div>

              {/* Journal — placeholder */}
              <div className="pl-3 text-xs text-white/15 italic select-none">—</div>
            </div>
          );
        })}

      </div>}

      {/* Legend — hidden when empty */}
      {sessions.length > 0 && <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/10 text-xs text-white/40">
        <span>Intensity</span>
        {LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="rounded-sm w-3 h-3" style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>}

    </div>
  );
}
