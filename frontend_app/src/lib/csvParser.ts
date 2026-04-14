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
  heading: string | null;
  polarity: string | null;
  sub_skill_tag: string | null;
  script_source: string | null;
  resonance: number | null;
}

// ── Date format ────────────────────────────────────────────────────────────

export type DateFormat = 'auto' | 'mdy' | 'dmy';

// ── Date parsing ────────────────────────────────────────────────────────────

function parseDate(raw: string, format: DateFormat = 'auto'): string | null {
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD (unambiguous, always accepted)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    if (!isNaN(d.getTime())) return s;
  }

  // X/Y/YYYY — interpretation depends on format
  const slashFull = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashFull) {
    const [, a, b, y] = slashFull;
    if (format === 'dmy') {
      // DD/MM/YYYY
      const iso = `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
    } else if (format === 'mdy') {
      // MM/DD/YYYY
      const iso = `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
      if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
    } else {
      // Auto: if first segment > 12, must be DD/MM; otherwise default MM/DD
      if (parseInt(a) > 12) {
        const iso = `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
        if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
      } else {
        const iso = `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
        if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
      }
    }
  }

  // X/Y/YY (2-digit year)
  const slashShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShort) {
    const [, a, b, y] = slashShort;
    const fullYear = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
    if (format === 'dmy') {
      const iso = `${fullYear}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
    } else {
      // mdy or auto (default MM/DD for short years)
      const iso = `${fullYear}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
      if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
    }
  }

  return null;
}

// ── Duration parsing ─────────────────────────────────────────────────────────

function parseDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // Plain number: if > 12, treat as minutes (e.g. "90" → 90); otherwise hours (e.g. "1.5" → 90)
  const asNum = parseFloat(s);
  if (!isNaN(asNum) && asNum > 0) {
    return asNum > 12 ? Math.round(asNum) : Math.round(asNum * 60);
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

export type ColKey = 'date' | 'duration' | 'notes' | 'restriction' | 'heading' | 'polarity' | 'script_source' | 'sub_skill_tag' | 'resonance' | 'tags' | 'ignore';

export function classifyHeader(h: string): ColKey {
  const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['date'].includes(lower)) return 'date';
  if (['hrs', 'hrs', 'duration', 'hours', 'hrstime', 'time'].includes(lower)) return 'duration';
  if (['goalsdrillinggoals', 'goals', 'drilling', 'notes', 'focus', 'goalsdrillings',
       'goaldrilling', 'goalsdrilling'].includes(lower)) return 'notes';
  if (lower === 'restriction') return 'restriction';
  if (['heading', 'pillar'].includes(lower)) return 'heading';
  if (['polarity'].includes(lower)) return 'polarity';
  if (['scriptsource', 'script', 'source'].includes(lower)) return 'script_source';
  if (['subskill', 'subskilltag'].includes(lower)) return 'sub_skill_tag';
  if (['resonance'].includes(lower)) return 'resonance';
  if (['tags', 'skilltags', 'tag'].includes(lower)) return 'tags';
  if (lower.startsWith('hrsrunning') || lower.startsWith('runningtotal') ||
      lower === 'total' || lower === 'runninghrs') return 'ignore';
  if (lower.includes('running')) return 'ignore';
  return 'ignore';
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseCSV(
  file: File,
  existingDates: Set<string>,
  onDone: (rows: ParsedRow[]) => void,
  onError: (msg: string) => void,
  dateFormat: DateFormat = 'auto',
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
        let headingVal: string | null = null;
        let polarityVal: string | null = null;
        let scriptSourceVal: string | null = null;
        let subSkillTagVal: string | null = null;
        let resonanceVal: number | null = null;
        let tagsVal: SkillTagValue[] = [];

        for (const [col, val] of Object.entries(raw)) {
          const key = colMap[col];
          if (!key || key === 'ignore') continue;
          if (key === 'date') dateVal = parseDate(val, dateFormat);
          if (key === 'duration') durationVal = parseDuration(val);
          if (key === 'notes') notesVal = val.trim();
          if (key === 'restriction') restrictionVal = val.trim();
          if (key === 'heading') { const v = val.trim().toLowerCase(); if (v) headingVal = v; }
          if (key === 'polarity') { const v = val.trim().toLowerCase(); if (v) polarityVal = v; }
          if (key === 'script_source') { const v = val.trim().toLowerCase(); if (v) scriptSourceVal = v; }
          if (key === 'sub_skill_tag') { const v = val.trim(); if (v) subSkillTagVal = v; }
          if (key === 'resonance') { const n = parseInt(val.trim()); if (!isNaN(n) && n >= 1 && n <= 10) resonanceVal = n; }
          if (key === 'tags') {
            const validTagValues = new Set(SKILL_TAGS.map(t => t.value));
            tagsVal = val.split(/[;,|]/).map((t: string) => t.trim().toLowerCase()).filter((t: string) => validTagValues.has(t)) as SkillTagValue[];
          }
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
          tags: tagsVal,
          errors,
          isDuplicate: dateVal ? existingDates.has(dateVal) : false,
          skip: false,
          heading: headingVal,
          polarity: polarityVal,
          sub_skill_tag: subSkillTagVal,
          script_source: scriptSourceVal,
          resonance: resonanceVal,
        });
      });

      if (rows.length === 0) {
        onError('No sessions found in this file. Check that the columns include Date and @Hrs.');
        return;
      }

      if (rows.length > 2000) {
        // Cap at 2000 and warn — caller handles the warning display
        onDone(rows.slice(0, 2000));
        return;
      }

      onDone(rows);
    },
    error(err) {
      onError(`Could not parse CSV: ${err.message}`);
    },
  });
}
