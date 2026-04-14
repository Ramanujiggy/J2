// trainingLogParser.ts — Dedicated parser for the "Training Log.numbers" weekly-grid format.
//
// The spreadsheet stores sessions in a Mon–Sun weekly calendar grid:
//   Row 0: AVG summary (skip)
//   Row 1: Headers (Month, Mon, Tues, Wed, Thurs, Fri, Sat, Sun, Hrs, ...)
//   Rows 2+: Weekly rows where each Mon–Sun cell contains e.g. "5th Oct-2.5HR" or "rest"
//
// This parser extracts individual sessions from each cell, resolving the date
// and duration from free-text strings like "5th Oct-2.5HR", "March 22nd-3",
// "11/20/23-1", etc.

import type { ParsedRow } from './csvParser.ts';

// ── Month name → number mapping ──────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, aprt: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

// ── Words/phrases that indicate "no training" ────────────────────────────────

const REST_PATTERNS = [
  /^rest/i, /^bad times/i, /^in tampa/i, /^in montana/i,
  /^quarantine/i, /^hurt/i, /^injured/i, /^sick/i,
  /^back rehab/i, /^didn.t/i, /^rest day/i,
];

function isRestOrEmpty(val: string): boolean {
  const s = val.trim();
  if (!s) return true;
  return REST_PATTERNS.some(p => p.test(s));
}

// ── Extract duration (hours) from a cell string ──────────────────────────────

function extractDuration(cell: string): number | null {
  // Normalize all dash variants (em-dash, en-dash, figure-dash) → hyphen
  const s = cell.trim().replace(/[\u2012\u2013\u2014\u2015—–]/g, '-');

  // "2.5HR", "2.5 HR", "2.5hr", "3 hours", "2 hour"
  const hrMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:HR|hrs?|hours?)/i);
  if (hrMatch) return parseFloat(hrMatch[1]);

  // Trailing "-2.5", "-3", "- 2", "-1.5" (most common pattern)
  const trailingDash = s.match(/-\s*(\d+(?:\.\d+)?)\s*$/);
  if (trailingDash) return parseFloat(trailingDash[1]);

  // Leading duration before date: rare but check
  // "2.5HR-5th Oct" → already caught by hrMatch

  // Standalone ".5" or "0.5" at end
  const trailingDecimal = s.match(/\s(\.\d+)\s*$/);
  if (trailingDecimal) return parseFloat(trailingDecimal[1]);

  return null;
}

// ── Extract date from a cell string given a context year/month ────────────────

function extractDate(cell: string, contextYear: number, contextMonth: number): string | null {
  // Normalize all dash variants → regular hyphen
  const s = cell.trim().replace(/[\u2012\u2013\u2014\u2015—–]/g, '-');

  // Pattern: "MM/DD/YY-duration" or "MM/DD/YY" (e.g. "11/20/23-1", "2/10/22")
  const slashDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashDate) {
    const [, m, d, y] = slashDate;
    const fullYear = y.length === 2 ? (parseInt(y) >= 50 ? 1900 + parseInt(y) : 2000 + parseInt(y)) : parseInt(y);
    const iso = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
  }

  // Pattern: "5th Oct", "Oct 16th", "March 22nd", "march 8th", "Feb28th"
  // With optional duration suffix like "-2.5HR"

  // Try "Day Month" pattern: "5th Oct", "28th OCT", "31st OCT"
  const dayFirst = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s*[-]?\s*([A-Za-z]+)/i);
  if (dayFirst) {
    const day = parseInt(dayFirst[1]);
    const monthStr = dayFirst[2].toLowerCase().replace(/[^a-z]/g, '');
    const month = MONTH_MAP[monthStr];
    if (month !== undefined && day >= 1 && day <= 31) {
      // Determine year: use context year, but handle year boundaries.
      // If the parsed month is far ahead of context (e.g. context=Oct, parsed=Jan),
      // it means we've crossed into the next year.
      let year = contextYear;
      if (month < contextMonth && contextMonth - month > 6) year++;
      if (month > contextMonth && month - contextMonth > 6) year--;

      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
    }
  }

  // Try "Month Day" pattern: "Oct 16th", "May 1st", "june 5th", "Feb28th", "Mar. -21"
  const monthFirst = s.match(/([A-Za-z]+)\.?\s*[-.]?\s*(\d{1,2})(?:st|nd|rd|th)?/i);
  if (monthFirst) {
    const monthStr = monthFirst[1].toLowerCase().replace(/[^a-z]/g, '');
    const day = parseInt(monthFirst[2]);
    const month = MONTH_MAP[monthStr];
    if (month !== undefined && day >= 1 && day <= 31) {
      let year = contextYear;
      if (contextMonth >= 10 && month <= 1) year++;
      if (contextMonth <= 1 && month >= 10) year--;

      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
    }
  }

  // Fallback: MM/DD with no year (e.g. "10/30-1")
  const slashNoYear = s.match(/^(\d{1,2})\/(\d{1,2})/);
  if (slashNoYear) {
    const month = parseInt(slashNoYear[1]) - 1;
    const day = parseInt(slashNoYear[2]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      let year = contextYear;
      if (month < contextMonth && contextMonth - month > 6) year++;
      if (month > contextMonth && month - contextMonth > 6) year--;
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
    }
  }

  // Fallback: bare ordinal like "18th-1.5", "5th-2", "21st-1"
  const bareOrdinal = s.match(/^(\d{1,2})(?:st|nd|rd|th)/i);
  if (bareOrdinal) {
    const day = parseInt(bareOrdinal[1]);
    if (day >= 1 && day <= 31) {
      const iso = `${contextYear}-${String(contextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
    }
  }

  return null;
}

// ── Parse the "Month" column to get year/month context ───────────────────────

function parseMonthContext(val: string): { year: number; month: number } | null {
  const s = val.trim();

  // "10/1/20", "11/1/20", "2/1/21", "2/1/22", "3/1/23" (MM/DD/YY or MM/DD/YYYY)
  const slashMatch = s.match(/^(\d{1,2})\/\d{1,2}\/(\d{2,4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1]) - 1;
    const y = slashMatch[2];
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return { year, month };
  }

  // JS Date string from SheetJS raw mode: "Thu Oct 01 2020 01:00:00 GMT-0500 ..."
  const jsDateMatch = s.match(/([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})\s+\d{2}:/);
  if (jsDateMatch) {
    const monthStr = jsDateMatch[1].toLowerCase();
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) return { year: parseInt(jsDateMatch[3]), month };
  }

  // ISO string from SheetJS: "2020-10-01T06:00:00.000Z"
  const isoMatch = s.match(/^(\d{4})-(\d{2})-\d{2}T/);
  if (isoMatch) {
    return { year: parseInt(isoMatch[1]), month: parseInt(isoMatch[2]) - 1 };
  }

  // "january (2023)", "2021= 520ish hours"
  const yearMatch = s.match(/(20\d{2})/);
  const monthMatch = s.match(/([a-z]+)/i);
  if (yearMatch && monthMatch) {
    const month = MONTH_MAP[monthMatch[1].toLowerCase()];
    if (month !== undefined) return { year: parseInt(yearMatch[1]), month };
  }

  // Just a year: "2021= 520ish hours"
  if (yearMatch) {
    return { year: parseInt(yearMatch[1]), month: 0 };
  }

  return null;
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseTrainingLog(
  rows: Record<string, unknown>[],
  existingDates: Set<string>,
): ParsedRow[] {
  const sessions: ParsedRow[] = [];
  let rowIdx = 0;

  // Current context: year + month from the "Month" column (__EMPTY)
  let contextYear = 2020;
  let contextMonth = 9; // October (0-indexed)

  // Day columns: __EMPTY_1 (Mon) through __EMPTY_7 (Sun)
  const dayCols = ['__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7'];

  for (let i = 2; i < rows.length; i++) { // Skip row 0 (AVG) and row 1 (headers)
    const row = rows[i];

    // Update context from the Month column if present
    const monthVal = String(row['__EMPTY'] ?? '').trim();
    if (monthVal) {
      const ctx = parseMonthContext(monthVal);
      if (ctx) {
        contextYear = ctx.year;
        contextMonth = ctx.month;
      }
    }

    // Weekly notes (Goals/Drilling and Training Restriction)
    const goals = String(row['__EMPTY_11'] ?? '').trim();
    const restriction = String(row['__EMPTY_12'] ?? '').trim();
    let weekNotes = '';
    if (goals) weekNotes = goals;
    if (restriction) weekNotes = weekNotes ? `${weekNotes}\n[Restriction: ${restriction}]` : `[Restriction: ${restriction}]`;

    // Iterate day columns
    for (const col of dayCols) {
      const cellVal = String(row[col] ?? '').trim();
      if (!cellVal) continue;
      if (isRestOrEmpty(cellVal)) continue;

      // Try to extract a date and duration
      const date = extractDate(cellVal, contextYear, contextMonth);
      const durationHrs = extractDuration(cellVal);

      // Skip cells that are just bare day numbers without duration (e.g. "21", "22")
      if (!date && !durationHrs) continue;
      // Skip if we got a date but no duration (date-only cells like "Apr 3rd" with no hours)
      if (date && !durationHrs) continue;

      const durationMin = durationHrs !== null ? Math.round(durationHrs * 60) : null;

      const errors: string[] = [];
      if (!date) errors.push('Could not parse date');
      if (!durationMin || durationMin < 1) errors.push('Could not parse duration');
      else if (durationMin > 720) errors.push('Duration too long (max 12h)');

      const validDuration = durationMin && durationMin >= 1 && durationMin <= 720 ? durationMin : null;

      sessions.push({
        rowIndex: rowIdx++,
        date,
        duration: validDuration,
        notes: weekNotes,
        gi_nogi: 'gi',
        intensity: 3,
        session_type: 'class',
        tags: [],
        errors,
        isDuplicate: date ? existingDates.has(date) : false,
        skip: false,
        heading: null,
        polarity: null,
        sub_skill_tag: null,
        script_source: null,
        resonance: null,
      });
    }
  }

  // Cap at 500
  return sessions.slice(0, 500);
}
