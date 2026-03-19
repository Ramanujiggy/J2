import Papa from 'papaparse';
import { SKILL_TAGS } from './constants.ts';

export type GiNogi = 'gi' | 'no_gi';
export type SessionType = 'class' | 'drilling' | 'competition_training';
export type SkillTagValue = typeof SKILL_TAGS[number]['value'];

export interface ParsedRow {
  rowIndex: number;
  date: string | null;       // YYYY-MM-DD or null
  duration: number | null;   // minutes or null
  notes: string;
  gi_nogi: GiNogi;
  intensity: number;
  session_type: SessionType;
  tags: SkillTagValue[];
  errors: string[];
  isDuplicate: boolean;
  skip: boolean;
}

// ── Date parsing ────────────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    if (!isNaN(d.getTime())) return s;
  }

  // MM/DD/YYYY
  const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy4) {
    const [, m, d, y] = mdy4;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const dt = new Date(iso + 'T00:00:00');
    if (!isNaN(dt.getTime())) return iso;
  }

  // MM/DD/YY
  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const [, m, d, y] = mdy2;
    const fullYear = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
    const iso = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const dt = new Date(iso + 'T00:00:00');
    if (!isNaN(dt.getTime())) return iso;
  }

  // DD/MM/YYYY (only if day > 12, otherwise ambiguous — default MM/DD)
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    if (parseInt(d) > 12) {
      const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      const dt = new Date(iso + 'T00:00:00');
      if (!isNaN(dt.getTime())) return iso;
    }
  }

  return null;
}

// ── Duration parsing ─────────────────────────────────────────────────────────

function parseDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // Plain number (treated as decimal hours, e.g. "1.5" → 90)
  const asNum = parseFloat(s);
  if (!isNaN(asNum) && asNum > 0) {
    return Math.round(asNum * 60);
  }

  // "90 mins" / "90 min" / "90m"
  const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*min/i);
  if (minMatch) return Math.round(parseFloat(minMatch[1]));

  // "1h30m" / "1h 30m" / "1:30"
  const hmMatch = s.match(/^(\d+)[h:](\d{1,2})/i);
  if (hmMatch) {
    return parseInt(hmMatch[1]) * 60 + parseInt(hmMatch[2]);
  }

  // "2h" alone
  const hOnly = s.match(/^(\d+(?:\.\d+)?)\s*h/i);
  if (hOnly) return Math.round(parseFloat(hOnly[1]) * 60);

  return null;
}

// ── Column header normalizer ─────────────────────────────────────────────────

type ColKey = 'date' | 'duration' | 'notes' | 'restriction' | 'ignore';

function classifyHeader(h: string): ColKey {
  const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['date'].includes(lower)) return 'date';
  if (['hrs', 'hrs', 'duration', 'hours', 'hrstime', 'time'].includes(lower)) return 'duration';
  if (['goalsdrillinggoals', 'goals', 'drilling', 'notes', 'focus', 'goalsdrillings',
       'goaldrilling', 'goalsdrilling'].includes(lower)) return 'notes';
  if (lower === 'restriction') return 'restriction';
  if (lower.startsWith('hrsrunning') || lower.startsWith('runningtotal') ||
      lower === 'total' || lower === 'runninghrs') return 'ignore';
  // fuzzy: contains 'running' → ignore
  if (lower.includes('running')) return 'ignore';
  return 'ignore';
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseCSV(
  file: File,
  existingDates: Set<string>,
  onDone: (rows: ParsedRow[]) => void,
  onError: (msg: string) => void,
) {
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete(results) {
      const headers = results.meta.fields ?? [];
      const colMap: Record<string, ColKey> = {};
      for (const h of headers) colMap[h] = classifyHeader(h);

      const rows: ParsedRow[] = [];

      results.data.forEach((raw, i) => {
        // Check if row is truly empty (all values blank)
        const vals = Object.values(raw).map(v => v.trim());
        if (vals.every(v => !v)) return;

        let dateVal: string | null = null;
        let durationVal: number | null = null;
        let notesVal = '';
        let restrictionVal = '';

        for (const [col, val] of Object.entries(raw)) {
          const key = colMap[col];
          if (!key || key === 'ignore') continue;
          if (key === 'date') dateVal = parseDate(val);
          if (key === 'duration') durationVal = parseDuration(val);
          if (key === 'notes') notesVal = val.trim();
          if (key === 'restriction') restrictionVal = val.trim();
        }

        // Merge restriction into notes
        let combinedNotes = notesVal;
        if (restrictionVal) {
          combinedNotes = combinedNotes
            ? `${combinedNotes}\n[Restriction: ${restrictionVal}]`
            : `[Restriction: ${restrictionVal}]`;
        }

        const errors: string[] = [];
        if (!dateVal) errors.push('Unrecognized date');
        if (!durationVal || durationVal < 1) errors.push('Missing duration');
        else if (durationVal > 720) errors.push('Duration too long (max 12h)');

        rows.push({
          rowIndex: i,
          date: dateVal,
          duration: durationVal && durationVal >= 1 && durationVal <= 720 ? durationVal : null,
          notes: combinedNotes,
          gi_nogi: 'gi',
          intensity: 3,
          session_type: 'class',
          tags: [],
          errors,
          isDuplicate: dateVal ? existingDates.has(dateVal) : false,
          skip: false,
        });
      });

      if (rows.length === 0) {
        onError('No sessions found in this file. Check that the columns include Date and @Hrs.');
        return;
      }

      if (rows.length > 500) {
        // Cap at 500 and warn — caller handles the warning display
        onDone(rows.slice(0, 500));
        return;
      }

      onDone(rows);
    },
    error(err) {
      onError(`Could not parse CSV: ${err.message}`);
    },
  });
}
