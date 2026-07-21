// papaparse is dynamic-imported at the export call site so it doesn't ship
// in the ProfilePage chunk for users who never click Export. ~15KB gzipped
// saved on first paint of /profile. See the 2026-05-09 perf audit Tier 2.

import type { SessionSummary, Intention } from '../types/api.ts';
import { SKILL_TAGS } from './constants.ts';
import { formatGiNogi } from './sessionUtils.ts';

const SESSION_TYPE_DISPLAY: Record<string, string> = {
  class: 'Class',
  drilling: 'Drilling',
  competition_training: 'Competition Training',
};

const SCRIPT_SOURCE_DISPLAY: Record<string, string> = {
  directed: 'Coach-led',
  organic: 'Open Mat',
};

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportSessionsCsv(sessions: SessionSummary[]): Promise<void> {
  const Papa = (await import('papaparse')).default;
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  const rows = sorted.map(s => ({
    'Date': s.date,
    'Duration (min)': s.duration,
    'Gi / No-Gi': formatGiNogi(s.gi_nogi),
    'Type': SESSION_TYPE_DISPLAY[s.session_type] ?? s.session_type,
    'Intensity': s.intensity,
    'Pillar': s.heading ? (SKILL_TAGS.find(t => t.value === s.heading)?.label ?? s.heading) : '',
    'Polarity': s.polarity ? s.polarity[0]!.toUpperCase() + s.polarity.slice(1) : '',
    'Sub-skill': s.sub_skill_tag ?? '',
    'Script Source': s.script_source ? (SCRIPT_SOURCE_DISPLAY[s.script_source] ?? s.script_source) : '',
    'Resonance': s.resonance ?? '',
    'Tags': (s.tags ?? []).join(';'),
    'Notes': s.notes ?? '',
  }));

  const csv = Papa.unparse(rows);
  downloadCsv(csv, `journada-sessions-${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportIntentionsCsv(intentions: Intention[]): Promise<void> {
  const Papa = (await import('papaparse')).default;
  const sorted = [...intentions].sort((a, b) => a.week_start.localeCompare(b.week_start));

  const rows = sorted.map(i => ({
    'Start Date': i.week_start.slice(0, 10),
    'Label': i.intent_label,
    'Category': i.intent_category ? i.intent_category[0]!.toUpperCase() + i.intent_category.slice(1) : '',
    'Pillar': i.heading ? (SKILL_TAGS.find(t => t.value === i.heading)?.label ?? i.heading) : '',
    'Duration (days)': i.duration_days,
    'Journal Entry': i.journal_entry ?? '',
  }));

  const csv = Papa.unparse(rows);
  downloadCsv(csv, `journada-intentions-${new Date().toISOString().slice(0, 10)}.csv`);
}
