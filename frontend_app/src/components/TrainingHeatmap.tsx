// Training Heatmap — a GitHub-style grid showing the full year.
// Each cell = one day. Color intensity = number of sessions that day.

const DAYS_IN_WEEK = 7;
const WEEKS_IN_YEAR = 53; // enough to cover any full year

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

// Color scale based on session count
function cellColor(count: number): string {
  if (count === 0) return '#1a3040';        // empty — slightly lighter than bg
  if (count === 1) return '#CDDFA0';        // light green
  if (count <= 3)  return '#6FD08C';        // green
  return '#DA7422';                         // orange — high intensity
}

// Build a map of "YYYY-MM-DD" -> session count from a flat list of date strings
function buildSessionMap(dates: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of dates) {
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return map;
}

// Generate the grid: array of 53 columns, each column is 7 days.
// We always start from the first Sunday on or before Jan 1 of the current year.
function buildGrid(sessionMap: Map<string, number>) {
  const now = new Date();
  const year = now.getFullYear();

  // Find the Sunday on or before Jan 1
  const jan1 = new Date(year, 0, 1);
  const startOffset = jan1.getDay(); // 0 = Sunday
  const gridStart = new Date(year, 0, 1 - startOffset);

  const weeks: { date: Date; count: number }[][] = [];

  for (let w = 0; w < WEEKS_IN_YEAR; w++) {
    const week: { date: Date; count: number }[] = [];
    for (let d = 0; d < DAYS_IN_WEEK; d++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      week.push({ date, count: sessionMap.get(key) ?? 0 });
    }
    weeks.push(week);
  }

  return { weeks, year };
}

// Find which week column each month label should sit above
function buildMonthPositions(weeks: { date: Date }[][]): { label: string; col: number }[] {
  const positions: { label: string; col: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, col) => {
    const firstDay = week[0];
    if (!firstDay) return;
    const month = firstDay.date.getMonth();
    if (month !== lastMonth) {
      positions.push({ label: MONTH_LABELS[month] ?? '', col });
      lastMonth = month;
    }
  });

  return positions;
}

// --- Props ---
interface TrainingHeatmapProps {
  // Array of ISO date strings ("2025-03-14") for each logged session.
  // A date appearing twice means two sessions that day.
  sessionDates?: string[];
}

export default function TrainingHeatmap({ sessionDates = [] }: TrainingHeatmapProps) {
  const sessionMap = buildSessionMap(sessionDates);
  const { weeks, year } = buildGrid(sessionMap);
  const monthPositions = buildMonthPositions(weeks);

  const cellSize = 13;
  const cellGap = 3;
  const step = cellSize + cellGap;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="overflow-x-auto">
        <div className="inline-block">

          {/* Month labels row */}
          <div className="flex mb-1 ml-8">
            {monthPositions.map(({ label, col }) => (
              <div
                key={`${label}-${col}`}
                className="text-xs text-white/40 absolute"
                style={{ marginLeft: col * step }}
              >
                {label}
              </div>
            ))}
            {/* invisible spacer so the flex container is the right width */}
            <div style={{ width: weeks.length * step }} />
          </div>

          {/* Grid */}
          <div className="flex gap-0.5">

            {/* Day-of-week labels */}
            <div className="flex flex-col mr-1" style={{ gap: cellGap }}>
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="text-xs text-white/40 flex items-center justify-end pr-1"
                  style={{ height: cellSize, fontSize: 10, lineHeight: `${cellSize}px` }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: cellGap }}>
                {week.map(({ date, count }, di) => {
                  const isCurrentYear = date.getFullYear() === year;
                  const isFuture = date > new Date();
                  const label = `${date.toDateString()}: ${count} session${count !== 1 ? 's' : ''}`;
                  return (
                    <div
                      key={di}
                      title={label}
                      className="rounded-sm cursor-default transition-opacity"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: (!isCurrentYear || isFuture) ? '#111e26' : cellColor(count),
                        opacity: (!isCurrentYear || isFuture) ? 0.3 : 1,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 text-xs text-white/40">
        <span>Less</span>
        {[0, 1, 2, 4].map(n => (
          <div
            key={n}
            className="rounded-sm"
            style={{ width: cellSize, height: cellSize, backgroundColor: cellColor(n) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
