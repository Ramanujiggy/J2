import Papa from 'papaparse';
import type { SessionSummary, Intention } from '../types/api.ts';
import { SKILL_TAGS } from './constants.ts';

const SESSION_TYPE_DISPLAY: Record<string, string> = {
  class: 'Class',
  drilling: 'Drilling',
  competition_training: 'Competition Training',
};

const SCRIPT_SOURCE_DISPLAY: Record<string, string> = {
  directed: 'Coach-led',
  organic: 'Open Mat',
};

function headingLabel(value: string | null | undefined): string {
  if (!value) return '';
  return SKILL_TAGS.find(s => s.value === value)?.label ?? value;
}

function capitalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

export function exportSessionsCsv(sessions: SessionSummary[]): void {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  const rows = sorted.map(s => ({
    'Date': s.date,
    'Duration (min)': s.duration,
    'Gi / No-Gi': s.gi_nogi === 'gi' ? 'Gi' : 'No-Gi',
    'Type': SESSION_TYPE_DISPLAY[s.session_type] ?? s.session_type,
    'Intensity': s.intensity,
    'Pillar': headingLabel(s.heading),
    'Polarity': capitalize(s.polarity),
    'Sub-skill': s.sub_skill_tag ?? '',
    'Script Source': s.script_source ? (SCRIPT_SOURCE_DISPLAY[s.script_source] ?? s.script_source) : '',
    'Resonance': s.resonance ?? '',
    'Tags': (s.tags ?? []).join(';'),
    'Notes': s.notes ?? '',
  }));

  const csv = Papa.unparse(rows);
  downloadCsv(csv, `journada-sessions-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportIntentionsCsv(intentions: Intention[]): void {
  const sorted = [...intentions].sort((a, b) => a.week_start.localeCompare(b.week_start));

  const rows = sorted.map(i => ({
    'Start Date': i.week_start.slice(0, 10),
    'Label': i.intent_label,
    'Category': capitalize(i.intent_category),
    'Pillar': headingLabel(i.heading),
    'Duration (days)': i.duration_days,
    'Journal Entry': i.journal_entry ?? '',
  }));

  const csv = Papa.unparse(rows);
  downloadCsv(csv, `journada-intentions-${new Date().toISOString().slice(0, 10)}.csv`);
}
