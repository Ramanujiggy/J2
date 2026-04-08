import { useState, useRef, useCallback } from 'react';
import { parseCSV, type ParsedRow, type GiNogi, type SessionType, type SkillTagValue } from '../lib/csvParser.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { api } from '../lib/api.ts';
import { CARD_BG, COPPER_BORDER } from '../lib/theme.ts';

const COPPER_DIM = 'rgba(196,145,95,0.85)';
const COPPER_FG  = 'rgba(218,116,34,0.85)';

interface Props {
  existingDates: Set<string>;
  onClose: () => void;
  onImported: () => void;
}

type Step = 'upload' | 'review' | 'done';

export default function CsvImportModal({ existingDates, onClose, onImported }: Props) {
  const [step, setStep]           = useState<Step>('upload');
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [capped, setCapped]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Parse ────────────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setParseError('File is too large (max 2 MB).');
      return;
    }
    setParseError('');
    const wasCapped = file.size > 0; // placeholder; real cap set in callback
    parseCSV(
      file,
      existingDates,
      (parsed) => {
        // Detect whether we hit the 500-row cap (parser sliced to 500)
        setCapped(parsed.length === 500);
        setRows(parsed);
        setStep('review');
      },
      (msg) => setParseError(msg),
    );
    void wasCapped;
  }, [existingDates]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ── Row editors ──────────────────────────────────────────────────────────

  const updateRow = (rowIndex: number, patch: Partial<ParsedRow>) => {
    setRows(prev => prev.map(r => r.rowIndex === rowIndex ? { ...r, ...patch } : r));
  };

  const toggleTag = (rowIndex: number, tag: SkillTagValue) => {
    setRows(prev => prev.map(r => {
      if (r.rowIndex !== rowIndex) return r;
      const has = r.tags.includes(tag);
      return { ...r, tags: has ? r.tags.filter(t => t !== tag) : [...r.tags, tag] };
    }));
  };

  // ── Validation ───────────────────────────────────────────────────────────

  const activeRows = rows.filter(r => !r.skip);
  const rowsWithErrors = activeRows.filter(r => r.errors.length > 0 || r.tags.length === 0);
  const canImport = rowsWithErrors.length === 0 && activeRows.length > 0;

  // ── Bulk fixes ───────────────────────────────────────────────────────────

  const fixMissingDurations = () => {
    setRows(prev => prev.map(r => {
      if (r.skip || r.duration !== null) return r;
      const newErrors = r.errors.filter(e => !e.includes('duration') && !e.includes('Duration'));
      return { ...r, duration: 60, errors: newErrors };
    }));
  };

  // ── Import ───────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    setImportError('');

    const payload = activeRows.map(r => ({
      date: r.date!,
      duration: r.duration!,
      gi_nogi: r.gi_nogi,
      intensity: r.intensity,
      session_type: r.session_type,
      tags: r.tags,
      notes: r.notes || '',
    }));

    try {
      const res = await api.post<{ imported: number }>('/api/sessions/import', { sessions: payload });
      setImportedCount(res.imported);
      setStep('done');
      onImported();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totalFound   = rows.length;
  const skipped      = rows.filter(r => r.skip).length;
  const needAttention = rows.filter(r => !r.skip && (r.errors.length > 0 || r.tags.length === 0)).length;
  const duplicates   = rows.filter(r => !r.skip && r.isDuplicate).length;
  const missingDur   = rows.filter(r => !r.skip && r.duration === null).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'rgba(13,26,20,0.85)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto',
        padding: '1rem',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-j2-modal-in"
        style={{
          width: '100%', maxWidth: 680,
          backgroundColor: CARD_BG,
          border: `1px solid ${COPPER_BORDER}`,
          borderRadius: '1rem',
          padding: '1.5rem',
          position: 'relative',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Import Training History</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-colors"
              style={{
                border: `2px dashed ${COPPER_BORDER}`,
                padding: '3rem 2rem',
                backgroundColor: 'rgba(196,145,95,0.04)',
              }}
            >
              <span style={{ fontSize: 32 }}>📂</span>
              <p className="text-white/70 text-sm text-center">
                Drop your CSV file here, or <span style={{ color: COPPER_DIM }}>click to browse</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>

            <div
              className="mt-4 rounded-lg px-4 py-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-xs text-white/40 mb-1 uppercase tracking-wide">Expected columns</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Date', '@Hrs', 'Goals/Drilling', 'Restriction'].map(col => (
                  <span key={col} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(196,145,95,0.12)', color: COPPER_DIM }}>
                    {col}
                  </span>
                ))}
                <span className="text-xs px-2 py-0.5 rounded text-white/25 line-through" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  Hrs-Running total
                </span>
              </div>
              <p className="text-xs text-white/30 mt-2">Running totals are ignored — Jornada computes them live.</p>
            </div>

            {parseError && (
              <p className="mt-3 text-sm text-red-400">{parseError}</p>
            )}
          </div>
        )}

        {/* ── Step 2: Review ─────────────────────────────────────────────── */}
        {step === 'review' && (
          <div>
            {/* Summary banner */}
            <div
              className="rounded-lg px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-white/70">
                Found <strong className="text-white">{totalFound}</strong> sessions
                {capped && <span className="text-amber-400"> (capped at 500)</span>}
                {needAttention > 0 && <span className="text-amber-400"> · {needAttention} need attention</span>}
                {duplicates > 0 && <span style={{ color: COPPER_FG }}> · {duplicates} duplicate date{duplicates > 1 ? 's' : ''}</span>}
                {skipped > 0 && <span className="text-white/40"> · {skipped} skipped</span>}
              </span>
              {missingDur > 0 && (
                <button
                  onClick={fixMissingDurations}
                  className="ml-3 text-xs underline"
                  style={{ color: COPPER_DIM }}
                >
                  Set all missing durations to 60 min
                </button>
              )}
            </div>

            {/* Rows */}
            <div className="space-y-2" style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
              {rows.map(row => (
                <ReviewRow
                  key={row.rowIndex}
                  row={row}
                  onUpdate={patch => updateRow(row.rowIndex, patch)}
                  onToggleTag={tag => toggleTag(row.rowIndex, tag)}
                />
              ))}
            </div>

            {importError && (
              <p className="mt-3 text-sm text-red-400">{importError}</p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setStep('upload')}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                {!canImport && needAttention > 0 && (
                  <span className="text-xs text-amber-400">Fix {needAttention} row{needAttention > 1 ? 's' : ''} or mark as skip</span>
                )}
                {!canImport && activeRows.length === 0 && (
                  <span className="text-xs text-white/40">All rows skipped</span>
                )}
                <button
                  onClick={handleImport}
                  disabled={!canImport || importing}
                  className="text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-40"
                  style={{ backgroundColor: canImport && !importing ? 'rgba(218,116,34,0.85)' : 'rgba(196,145,95,0.2)', color: 'white' }}
                >
                  {importing ? 'Importing…' : `Import ${activeRows.length} session${activeRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ───────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span style={{ fontSize: 40 }}>✓</span>
            <div>
              <p className="text-white font-semibold text-lg">
                {importedCount} session{importedCount !== 1 ? 's' : ''} imported
              </p>
              {rows.filter(r => r.skip).length > 0 && (
                <p className="text-sm text-white/40 mt-1">
                  {rows.filter(r => r.skip).length} skipped
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-2 text-sm font-medium px-5 py-2 rounded-lg"
              style={{ backgroundColor: 'rgba(196,145,95,0.2)', color: COPPER_DIM }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ReviewRow sub-component ──────────────────────────────────────────────────

interface ReviewRowProps {
  row: ParsedRow;
  onUpdate: (patch: Partial<ParsedRow>) => void;
  onToggleTag: (tag: SkillTagValue) => void;
}

const GI_NOGI_OPTIONS: { value: GiNogi; label: string }[] = [
  { value: 'gi',    label: 'Gi'    },
  { value: 'no_gi', label: 'No-Gi' },
];

const SESSION_TYPE_OPTIONS: { value: SessionType; label: string }[] = [
  { value: 'class',               label: 'Class'    },
  { value: 'drilling',            label: 'Drilling' },
  { value: 'competition_training', label: 'Comp'    },
];

const COPPER_BORDER_STR = 'rgba(196,145,95,0.45)';

function ReviewRow({ row, onUpdate, onToggleTag }: ReviewRowProps) {
  const needsTag = !row.skip && row.tags.length === 0;
  const hasErrors = row.errors.length > 0 || needsTag;

  const rowBg = row.skip
    ? 'rgba(255,255,255,0.02)'
    : row.isDuplicate
      ? 'rgba(196,145,95,0.07)'
      : hasErrors
        ? 'rgba(245,158,11,0.06)'
        : 'rgba(255,255,255,0.03)';

  const rowBorder = row.skip
    ? 'rgba(255,255,255,0.06)'
    : row.isDuplicate
      ? COPPER_BORDER_STR
      : hasErrors
        ? 'rgba(245,158,11,0.3)'
        : 'rgba(255,255,255,0.07)';

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        backgroundColor: rowBg,
        border: `1px solid ${rowBorder}`,
        opacity: row.skip ? 0.45 : 1,
      }}
    >
      {/* Top row: date, duration, gi/nogi, type, skip */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Date */}
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
          style={{
            color: row.date ? 'rgba(255,255,255,0.7)' : 'rgba(245,158,11,0.8)',
            backgroundColor: 'rgba(255,255,255,0.06)',
            minWidth: 86,
          }}
        >
          {row.date ?? '⚠ bad date'}
        </span>

        {/* Duration */}
        <DurationCell
          duration={row.duration}
          onSave={val => {
            const newErrors = row.errors.filter(e => !e.toLowerCase().includes('duration'));
            onUpdate({ duration: val, errors: val ? newErrors : [...newErrors, 'Missing duration'] });
          }}
          disabled={row.skip}
        />

        {/* Gi/No-gi toggle */}
        <div className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {GI_NOGI_OPTIONS.map(opt => (
            <button
              key={opt.value}
              disabled={row.skip}
              onClick={() => onUpdate({ gi_nogi: opt.value })}
              className="text-xs px-2 py-0.5 transition-colors"
              style={{
                backgroundColor: row.gi_nogi === opt.value ? 'rgba(196,145,95,0.3)' : 'transparent',
                color: row.gi_nogi === opt.value ? 'rgba(218,116,34,0.9)' : 'rgba(255,255,255,0.4)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Session type */}
        <div className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          {SESSION_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              disabled={row.skip}
              onClick={() => onUpdate({ session_type: opt.value })}
              className="text-xs px-2 py-0.5 transition-colors"
              style={{
                backgroundColor: row.session_type === opt.value ? 'rgba(196,145,95,0.3)' : 'transparent',
                color: row.session_type === opt.value ? 'rgba(218,116,34,0.9)' : 'rgba(255,255,255,0.4)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Intensity */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              disabled={row.skip}
              onClick={() => onUpdate({ intensity: n })}
              className="w-5 h-5 rounded text-[10px] font-semibold transition-colors"
              style={{
                backgroundColor: row.intensity === n ? 'rgba(196,145,95,0.5)' : 'rgba(255,255,255,0.07)',
                color: row.intensity === n ? 'rgba(218,116,34,0.95)' : 'rgba(255,255,255,0.3)',
              }}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Skip toggle */}
        <button
          onClick={() => onUpdate({ skip: !row.skip })}
          className="ml-auto text-xs transition-colors"
          style={{ color: row.skip ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}
        >
          {row.skip ? 'Undo skip' : 'Skip'}
        </button>
      </div>

      {/* Tags row */}
      {!row.skip && (
        <div className="flex flex-wrap gap-1 mt-2">
          {SKILL_TAGS.map(tag => {
            const active = row.tags.includes(tag.value as SkillTagValue);
            return (
              <button
                key={tag.value}
                onClick={() => onToggleTag(tag.value as SkillTagValue)}
                className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                style={{
                  backgroundColor: active ? 'rgba(196,145,95,0.25)' : 'rgba(255,255,255,0.06)',
                  color: active ? 'rgba(218,116,34,0.9)' : 'rgba(255,255,255,0.3)',
                  border: active ? `1px solid rgba(196,145,95,0.4)` : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {tag.label}
              </button>
            );
          })}
          {needsTag && (
            <span className="text-[10px] text-amber-400 self-center ml-1">← select at least one</span>
          )}
        </div>
      )}

      {/* Notes preview */}
      {!row.skip && row.notes && (
        <p className="text-[10px] text-white/25 mt-1.5 truncate">{row.notes}</p>
      )}

      {/* Error badges */}
      {!row.skip && row.errors.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {row.errors.map(e => (
            <span key={e} className="text-[10px] text-amber-300 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}>
              ⚠ {e}
            </span>
          ))}
        </div>
      )}

      {/* Duplicate badge */}
      {!row.skip && row.isDuplicate && (
        <div className="mt-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'rgba(218,116,34,0.8)', backgroundColor: 'rgba(196,145,95,0.12)' }}>
            ◎ Date already exists in your log
          </span>
        </div>
      )}
    </div>
  );
}

// ── Inline duration editor ───────────────────────────────────────────────────

interface DurationCellProps {
  duration: number | null;
  onSave: (val: number | null) => void;
  disabled: boolean;
}

function DurationCell({ duration, onSave, disabled }: DurationCellProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const label = duration ? `${duration} min` : '⚠ —';

  if (!editing) {
    return (
      <button
        disabled={disabled}
        onClick={() => { setRaw(duration ? String(duration) : ''); setEditing(true); }}
        className="text-xs px-2 py-0.5 rounded transition-colors"
        style={{
          backgroundColor: duration ? 'rgba(255,255,255,0.06)' : 'rgba(245,158,11,0.12)',
          color: duration ? 'rgba(255,255,255,0.6)' : 'rgba(245,158,11,0.9)',
          minWidth: 54,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      min={1}
      max={720}
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={() => {
        const n = parseInt(raw);
        onSave(n >= 1 && n <= 720 ? n : null);
        setEditing(false);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="text-xs px-2 py-0.5 rounded bg-white/10 text-white border border-brand-orange outline-none"
      style={{ width: 64 }}
      placeholder="min"
    />
  );
}
