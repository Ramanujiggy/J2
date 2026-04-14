import { SKILL_TAGS } from './constants.ts';
import { classifyHeader, type ParsedRow, type SkillTagValue } from './csvParser.ts';

const VALID_TAGS = new Set(SKILL_TAGS.map(t => t.value));
const VALID_POLARITIES = new Set(['offense', 'defense', 'neutral']);
const VALID_SOURCES = new Set(['directed', 'organic']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Date parsing (same formats as CSV parser) ─────────────────────────────

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  if (DATE_RE.test(s)) {
    const d = new Date(s + 'T00:00:00');
    if (!isNaN(d.getTime())) return s;
  }

  const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy4) {
    const [, m, d, y] = mdy4;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
  }

  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const [, m, d, y] = mdy2;
    const fullYear = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
    const iso = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (!isNaN(new Date(iso + 'T00:00:00').getTime())) return iso;
  }

  // Date objects from SheetJS (serial dates get converted to JS Date strings)
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }

  return null;
}

// ── Duration parsing (same heuristic as CSV parser) ───────────────────────

function parseDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  const asNum = parseFloat(s);
  if (!isNaN(asNum) && asNum > 0) {
    return asNum > 12 ? Math.round(asNum) : Math.round(asNum * 60);
  }

  const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*min/i);
  if (minMatch) return Math.round(parseFloat(minMatch[1]));

  const hmMatch = s.match(/^(\d+)[h:](\d{1,2})/i);
  if (hmMatch) return parseInt(hmMatch[1]) * 60 + parseInt(hmMatch[2]);

  const hOnly = s.match(/^(\d+(?:\.\d+)?)\s*h/i);
  if (hOnly) return Math.round(parseFloat(hOnly[1]) * 60);

  return null;
}

// ── Main parser ───────────────────────────────────────────────────────────

export async function parseNumbers(
  file: File,
  existingDates: Set<string>,
  onDone: (rows: ParsedRow[]) => void,
  onError: (msg: string) => void,
) {
  try {
    // Lazy-load SheetJS to keep main bundle small (~500KB loaded on demand)
    const XLSX = await import('xlsx');

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer));

    if (workbook.SheetNames.length === 0) {
      onError('No sheets found in this file.');
      return;
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

    if (jsonRows.length === 0) {
      onError('No sessions found in this file. The first sheet appears to be empty.');
      return;
    }

    // Classify column headers using CSV parser's classifyHeader
    const headers = Object.keys(jsonRows[0]);
    const colMap: Record<string, ReturnType<typeof classifyHeader>> = {};
    for (const h of headers) colMap[h] = classifyHeader(h);

    const rows: ParsedRow[] = [];

    for (let i = 0; i < Math.min(jsonRows.length, 500); i++) {
      const raw = jsonRows[i];

      // Skip fully empty rows
      const vals = Object.values(raw).map(v => String(v).trim());
      if (vals.every(v => !v)) continue;

      let dateVal: string | null = null;
      let durationVal: number | null = null;
      let notesVal = '';
      let restrictionVal = '';
      let headingVal: string | null = null;
      let polarityVal: string | null = null;
      let scriptSourceVal: string | null = null;
      let subSkillTagVal: string | null = null;
      let resonanceVal: number | null = null;

      for (const [col, val] of Object.entries(raw)) {
        const strVal = String(val);
        const key = colMap[col];
        if (!key || key === 'ignore') continue;
        if (key === 'date') dateVal = parseDate(strVal);
        if (key === 'duration') durationVal = parseDuration(strVal);
        if (key === 'notes') notesVal = strVal.trim();
        if (key === 'restriction') restrictionVal = strVal.trim();
        if (key === 'heading') { const v = strVal.trim().toLowerCase(); if (v && VALID_TAGS.has(v)) headingVal = v; }
        if (key === 'polarity') { const v = strVal.trim().toLowerCase(); if (v && VALID_POLARITIES.has(v)) polarityVal = v; }
        if (key === 'script_source') { const v = strVal.trim().toLowerCase(); if (v && VALID_SOURCES.has(v)) scriptSourceVal = v; }
        if (key === 'sub_skill_tag') { const v = strVal.trim(); if (v) subSkillTagVal = v; }
        if (key === 'resonance') { const n = parseInt(strVal.trim()); if (!isNaN(n) && n >= 1 && n <= 10) resonanceVal = n; }
      }

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
        heading: headingVal,
        polarity: polarityVal,
        sub_skill_tag: subSkillTagVal,
        script_source: scriptSourceVal,
        resonance: resonanceVal,
      });
    }

    if (rows.length === 0) {
      onError('No sessions found in this file. Check that the columns include Date and a duration column.');
      return;
    }

    onDone(rows);
  } catch (err) {
    onError(`Could not parse .numbers file: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}
