import { SKILL_TAGS } from './constants.ts';
import type { ParsedRow, GiNogi, SessionType, SkillTagValue } from './csvParser.ts';

const VALID_GI_NOGI = new Set(['gi', 'no_gi']);
const VALID_SESSION_TYPES = new Set(['class', 'drilling', 'competition_training']);
const VALID_TAGS: Set<string> = new Set(SKILL_TAGS.map(t => t.value));
const VALID_POLARITIES = new Set(['offense', 'defense', 'neutral']);
const VALID_SOURCES = new Set(['directed', 'organic']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseJSON(
  file: File,
  existingDates: Set<string>,
  onDone: (rows: ParsedRow[]) => void,
  onError: (msg: string) => void,
) {
  const reader = new FileReader();

  reader.onerror = () => onError('Could not read file.');

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result as string);

      // Accept plain array or { sessions: [...] }
      const arr = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.sessions) ? parsed.sessions : null);

      if (!arr || arr.length === 0) {
        onError('No sessions found. Expected a JSON array or { "sessions": [...] }.');
        return;
      }

      const capped = arr.slice(0, 2000);

      const rows: ParsedRow[] = capped.map((obj: Record<string, unknown>, i: number) => {
        const errors: string[] = [];

        // Date
        const rawDate = typeof obj.date === 'string' ? obj.date.trim() : '';
        const date = DATE_RE.test(rawDate) && !isNaN(Date.parse(rawDate)) ? rawDate : null;
        if (!date) errors.push('Invalid or missing date');

        // Duration — accept number; apply >12 heuristic like CSV parser
        let duration: number | null = null;
        if (typeof obj.duration === 'number' && obj.duration > 0) {
          duration = obj.duration > 12 ? Math.round(obj.duration) : Math.round(obj.duration * 60);
          if (duration < 1 || duration > 720) {
            errors.push('Duration out of range (1–720 min)');
            duration = null;
          }
        } else {
          errors.push('Missing duration');
        }

        // Gi/Nogi
        const gi_nogi: GiNogi = VALID_GI_NOGI.has(obj.gi_nogi as string) ? (obj.gi_nogi as GiNogi) : 'gi';

        // Intensity
        const rawIntensity = Number(obj.intensity);
        const intensity = Number.isInteger(rawIntensity) && rawIntensity >= 1 && rawIntensity <= 5 ? rawIntensity : 3;

        // Session type
        const session_type: SessionType = VALID_SESSION_TYPES.has(obj.session_type as string) ? (obj.session_type as SessionType) : 'class';

        // Tags
        const tags: SkillTagValue[] = Array.isArray(obj.tags)
          ? (obj.tags as string[]).filter(t => VALID_TAGS.has(t)) as SkillTagValue[]
          : [];

        // Notes
        const notes = typeof obj.notes === 'string' ? obj.notes : '';

        // Migration 005 fields — pass through if valid
        const heading = typeof obj.heading === 'string' && VALID_TAGS.has(obj.heading) ? obj.heading : null;
        const polarity = typeof obj.polarity === 'string' && VALID_POLARITIES.has(obj.polarity) ? obj.polarity : null;
        const script_source = typeof obj.script_source === 'string' && VALID_SOURCES.has(obj.script_source) ? obj.script_source : null;
        const sub_skill_tag = typeof obj.sub_skill_tag === 'string' && obj.sub_skill_tag.length <= 50 ? obj.sub_skill_tag : null;
        const rawRes = Number(obj.resonance);
        const resonance = Number.isInteger(rawRes) && rawRes >= 1 && rawRes <= 10 ? rawRes : null;

        return {
          rowIndex: i,
          date,
          duration,
          notes,
          gi_nogi,
          intensity,
          session_type,
          tags,
          errors,
          isDuplicate: date ? existingDates.has(date) : false,
          skip: false,
          heading,
          polarity,
          sub_skill_tag,
          script_source,
          resonance,
        };
      });

      onDone(rows);
    } catch {
      onError('Invalid JSON file. Could not parse.');
    }
  };

  reader.readAsText(file);
}
