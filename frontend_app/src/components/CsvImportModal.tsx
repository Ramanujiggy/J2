import { useState, useRef, useCallback } from 'react';
import { parseCSV, type ParsedRow, type GiNogi, type SessionType, type SkillTagValue, type DateFormat } from '../lib/csvParser.ts';
import { parseJSON } from '../lib/jsonParser.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { api, ApiError } from '../lib/api.ts';
import { CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER_BORDER, PALE_YELLOW, SURFACE_2, SURFACE_2_BORDER, SURFACE_3, SURFACE_3_BORDER, TEXT_BODY, TEXT_TERTIARY, TEXT_HINT } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';

const COPPER_DIM = 'rgba(196,145,95,0.85)';
const COPPER_FG  = 'rgba(218,116,34,0.85)';

interface Props {
  existingDates: Set<string>;
  onClose: () => void;
  onImported: () => void;
}

type Step = 'upload' | 'review' | 'done';

export default function CsvImportModal({ existingDates, onClose, onImported }: Props) {
  const isDesktop = useIsDesktop();
  const [step, setStep]           = useState<Step>('upload');
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [duplicatePrompt, setDuplicatePrompt] = useState<string[] | null>(null);
  const [capped, setCapped]       = useState(false);
  const [dateFormat, setDateFormat] = useState<DateFormat>('auto');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Parse ────────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File, fmt: DateFormat = dateFormat) => {
    const ext = file.name.toLowerCase().split('.').pop();
    if (!ext || !['csv', 'json', 'numbers'].includes(ext)) {
      setParseError('Please upload a .csv, .json, or .numbers file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setParseError('File is too large (max 2 MB).');
      return;
    }
    setParseError('');
    setCurrentFile(file);

    const onDone = (parsed: ParsedRow[]) => {
      setCapped(parsed.length === 2000);
      setRows(parsed);
      setStep('review');
    };
    const onErr = (msg: string) => setParseError(msg);

    if (ext === 'json') {
      parseJSON(file, existingDates, onDone, onErr);
    } else if (ext === 'numbers') {
      try {
        const { parseNumbers } = await import('../lib/numbersParser.ts');
        await parseNumbers(file, existingDates, onDone, onErr);
      } catch {
        setParseError('Could not load .numbers file parser.');
      }
    } else {
      try {
        await parseCSV(file, existingDates, onDone, onErr, fmt);
      } catch {
        setParseError('Could not load CSV parser.');
      }
    }
  }, [existingDates, dateFormat]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
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
  const rowsWithErrors = activeRows.filter(r => r.errors.length > 0);
  const rowsMissingTags = activeRows.filter(r => r.tags.length === 0);
  const canImport = rowsWithErrors.length === 0 && activeRows.length > 0;

  // ── Bulk fixes ───────────────────────────────────────────────────────────

  const fixMissingDurations = () => {
    setRows(prev => prev.map(r => {
      if (r.skip || r.duration !== null) return r;
      const newErrors = r.errors.filter(e => !e.includes('duration') && !e.includes('Duration'));
      return { ...r, duration: 60, errors: newErrors };
    }));
  };

  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const setAllMissingTags = (tag: SkillTagValue) => {
    setRows(prev => prev.map(r => r.skip || r.tags.length > 0 ? r : { ...r, tags: [tag] }));
    setBulkTagOpen(false);
  };

  const skipAllUntagged = () => {
    setRows(prev => prev.map(r => r.tags.length === 0 && !r.skip ? { ...r, skip: true } : r));
  };

  // ── Import ───────────────────────────────────────────────────────────────

  const doImport = async (confirmDuplicates = false) => {
    if (!canImport) return;
    setImporting(true);
    setImportError('');
    setDuplicatePrompt(null);

    const payload = activeRows.map(r => ({
      date: r.date!,
      duration: r.duration!,
      gi_nogi: r.gi_nogi,
      intensity: r.intensity,
      session_type: r.session_type,
      tags: r.tags,
      notes: r.notes || '',
      heading: r.heading ?? null,
      polarity: r.polarity ?? null,
      sub_skill_tag: r.sub_skill_tag ?? null,
      script_source: r.script_source ?? null,
      resonance: r.resonance ?? null,
    }));

    try {
      const res = await api.post<{ imported: number }>('/api/sessions/import', { sessions: payload, confirmDuplicates });
      setImportedCount(res.imported);
      setStep('done');
      onImported();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Duplicate dates detected — show confirmation prompt
        setDuplicatePrompt([err.message]);
      } else {
        setImportError(err instanceof Error ? err.message : 'Import failed. Please try again.');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleImport = () => void doImport(false);

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totalFound   = rows.length;
  const skipped      = rows.filter(r => r.skip).length;
  const needAttention = rows.filter(r => !r.skip && r.errors.length > 0).length;
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
        data-testid="csv-import-modal"
        onClick={e => e.stopPropagation()}
        className="animate-j2-modal-in"
        style={{
          width: '100%',
          maxWidth: isDesktop ? 1180 : 680,
          backgroundColor: CARD_BG,
          border: `1px solid ${isDesktop ? CARD_GLOW_BORDER : 'rgba(255,255,255,0.10)'}`,
          borderRadius: isDesktop ? '1.25rem' : '1rem',
          boxShadow: isDesktop ? CARD_GLOW : undefined,
          padding: isDesktop ? '2.5rem 3rem' : '1.5rem',
          position: 'relative',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          overflowY: 'auto',
        }}
      >
        {/* Header — editorial on desktop, compact on mobile */}
        {isDesktop ? (
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="j2-label-copper" style={{ marginBottom: 8 }}>◇ Import training history</p>
              <h2
                className="j2-serif-display"
                style={{ fontSize: 36, lineHeight: 1.1, margin: 0, color: PALE_YELLOW }}
              >
                Bring the past on.
              </h2>
              <p
                className="j2-serif-italic"
                style={{ marginTop: 10, fontSize: 16, color: TEXT_TERTIARY, lineHeight: 1.5 }}
              >
                Upload a CSV, JSON, or Numbers spreadsheet — review every row before it lands in your record.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white/70 transition-colors"
              style={{ fontSize: 24, lineHeight: 1, padding: 4 }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Import Training History</h2>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white/70 transition-colors text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl cursor-pointer transition-colors"
              style={{
                border: `2px dashed ${COPPER_BORDER}`,
                padding: isDesktop ? '5rem 3rem' : '3rem 2rem',
                gap: isDesktop ? 16 : 12,
                backgroundColor: 'rgba(196,145,95,0.04)',
              }}
            >
              <span style={{ fontSize: isDesktop ? 48 : 32 }}>📂</span>
              <p
                className="text-center"
                style={{
                  color: TEXT_BODY,
                  fontSize: isDesktop ? 16 : 14,
                  lineHeight: 1.5,
                }}
              >
                Drop your file here, or{' '}
                <span style={{ color: COPPER_DIM, fontWeight: 600 }}>click to browse</span>
              </p>
              <p
                style={{
                  color: TEXT_HINT,
                  fontSize: isDesktop ? 12 : 11,
                  letterSpacing: isDesktop ? '0.08em' : 'normal',
                  textTransform: isDesktop ? 'uppercase' : 'none',
                }}
              >
                .csv · .json · .numbers
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.numbers"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>

            {/* Date format selector */}
            <div className={`flex items-center gap-3 ${isDesktop ? 'mt-6' : 'mt-4'}`}>
              <span
                style={{
                  fontSize: isDesktop ? 11 : 12,
                  color: TEXT_TERTIARY,
                  letterSpacing: isDesktop ? '0.16em' : 'normal',
                  textTransform: isDesktop ? 'uppercase' : 'none',
                  fontWeight: isDesktop ? 700 : 400,
                }}
              >
                Date format
              </span>
              <div
                className="flex overflow-hidden"
                style={{
                  border: `1px solid ${SURFACE_3_BORDER}`,
                  borderRadius: 10,
                  height: isDesktop ? 36 : undefined,
                }}
              >
                {([['auto', 'Auto'], ['mdy', 'MM/DD'], ['dmy', 'DD/MM']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => {
                      setDateFormat(val);
                      if (currentFile && currentFile.name.toLowerCase().endsWith('.csv')) {
                        void handleFile(currentFile, val);
                      }
                    }}
                    className="transition-colors"
                    style={{
                      fontSize: isDesktop ? 13 : 12,
                      padding: isDesktop ? '0 16px' : '4px 12px',
                      backgroundColor: dateFormat === val ? 'rgba(196,145,95,0.3)' : 'transparent',
                      color: dateFormat === val ? 'rgba(218,116,34,0.9)' : 'rgba(255,255,255,0.4)',
                      fontWeight: dateFormat === val ? 600 : 500,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`rounded-lg ${isDesktop ? 'mt-6 px-5 py-4' : 'mt-4 px-4 py-3'}`}
              style={{ backgroundColor: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}` }}
            >
              <p
                style={{
                  fontSize: isDesktop ? 11 : 12,
                  color: TEXT_TERTIARY,
                  letterSpacing: isDesktop ? '0.16em' : '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: isDesktop ? 700 : 600,
                  marginBottom: 8,
                }}
              >
                Expected columns
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Date', '@Hrs', 'Goals/Drilling', 'Restriction'].map(col => (
                  <span
                    key={col}
                    style={{
                      fontSize: isDesktop ? 12.5 : 11,
                      padding: isDesktop ? '4px 10px' : '2px 8px',
                      borderRadius: 6,
                      backgroundColor: 'rgba(196,145,95,0.12)',
                      color: COPPER_DIM,
                    }}
                  >
                    {col}
                  </span>
                ))}
                <span
                  className="line-through"
                  style={{
                    fontSize: isDesktop ? 12.5 : 11,
                    padding: isDesktop ? '4px 10px' : '2px 8px',
                    borderRadius: 6,
                    color: TEXT_HINT,
                    backgroundColor: SURFACE_2,
                  }}
                >
                  Hrs-Running total
                </span>
              </div>
              <p
                style={{
                  fontSize: isDesktop ? 13 : 11,
                  color: TEXT_TERTIARY,
                  marginTop: 10,
                  lineHeight: 1.5,
                }}
              >
                Running totals are ignored — Journada computes them live.
              </p>
            </div>

            {parseError && (
              <p className="mt-3 text-sm text-error">{parseError}</p>
            )}
          </div>
        )}

        {/* ── Step 2: Review ─────────────────────────────────────────────── */}
        {step === 'review' && (
          <div>
            {/* Summary banner — desktop: 5-cell stat strip; mobile: inline pills */}
            {isDesktop ? (
              <>
                <div
                  className="grid mb-3"
                  style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}
                >
                  {[
                    { label: 'Found',          value: capped ? `${totalFound}/2k` : String(totalFound), tone: 'champagne' as const },
                    { label: 'Need attention', value: String(needAttention), tone: needAttention > 0 ? 'amber' : 'dim' as const },
                    { label: 'Without tags',   value: String(rowsMissingTags.length), tone: rowsMissingTags.length > 0 ? 'champagne' : 'dim' as const },
                    { label: 'Duplicates',     value: String(duplicates), tone: duplicates > 0 ? 'copper' : 'dim' as const },
                    { label: 'Skipped',        value: String(skipped), tone: 'dim' as const },
                  ].map(cell => {
                    const valueColor =
                      cell.tone === 'amber' ? 'rgba(245,158,11,0.95)' :
                      cell.tone === 'copper' ? COPPER_FG :
                      cell.tone === 'champagne' ? PALE_YELLOW :
                      'rgba(255,255,255,0.45)';
                    return (
                      <div
                        key={cell.label}
                        className="rounded-xl"
                        style={{
                          backgroundColor: SURFACE_2,
                          border: `1px solid ${SURFACE_2_BORDER}`,
                          padding: '14px 16px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: TEXT_TERTIARY,
                            marginBottom: 6,
                          }}
                        >
                          {cell.label}
                        </div>
                        <div
                          className="j2-serif-display"
                          style={{ fontSize: 24, lineHeight: 1, color: valueColor }}
                        >
                          {cell.value}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Bulk-action row */}
                {(missingDur > 0 || rows.some(r => !r.skip && r.tags.length === 0)) && (
                  <div className="flex items-center justify-end gap-4 mb-4 flex-wrap">
                    {missingDur > 0 && (
                      <button
                        onClick={fixMissingDurations}
                        className="text-xs"
                        style={{
                          color: COPPER_DIM,
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          borderBottom: `1px solid rgba(196,145,95,0.30)`,
                          paddingBottom: 1,
                        }}
                      >
                        Set all missing durations to 60 min
                      </button>
                    )}
                    {rows.some(r => !r.skip && r.tags.length === 0) && (
                      <span className="relative inline-block">
                        <button
                          onClick={() => setBulkTagOpen(!bulkTagOpen)}
                          className="text-xs"
                          style={{
                            color: COPPER_DIM,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            borderBottom: `1px solid rgba(196,145,95,0.30)`,
                            paddingBottom: 1,
                          }}
                        >
                          Set all missing tags to…
                        </button>
                        {bulkTagOpen && (
                          <span
                            className="absolute right-0 top-full mt-1 z-10 flex flex-wrap gap-1 p-2 rounded-lg"
                            style={{
                              backgroundColor: SURFACE_3,
                              border: `1px solid ${SURFACE_3_BORDER}`,
                              minWidth: 240,
                            }}
                          >
                            {SKILL_TAGS.map(tag => (
                              <button
                                key={tag.value}
                                onClick={() => setAllMissingTags(tag.value as SkillTagValue)}
                                className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
                                style={{ backgroundColor: 'rgba(196,145,95,0.2)', color: COPPER_DIM, border: `1px solid ${COPPER_BORDER}` }}
                              >
                                {tag.label}
                              </button>
                            ))}
                          </span>
                        )}
                      </span>
                    )}
                    {rows.some(r => !r.skip && r.tags.length === 0) && (
                      <button
                        onClick={skipAllUntagged}
                        className="text-xs"
                        style={{ color: TEXT_TERTIARY, letterSpacing: '0.04em' }}
                      >
                        Skip all untagged
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div
                className="rounded-lg px-4 py-3 mb-4 text-sm"
                style={{ backgroundColor: SURFACE_2, border: `1px solid ${SURFACE_3_BORDER}` }}
              >
                <span className="text-white/70">
                  Found <strong className="text-white">{totalFound}</strong> sessions
                  {capped && <span className="text-amber-400"> (capped at 2,000)</span>}
                  {needAttention > 0 && <span className="text-amber-400"> · {needAttention} need attention</span>}
                  {rowsMissingTags.length > 0 && <span className="text-white/30"> · {rowsMissingTags.length} without tags</span>}
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
                {rows.some(r => !r.skip && r.tags.length === 0) && (
                  <span className="relative ml-2 inline-block">
                    <button
                      onClick={() => setBulkTagOpen(!bulkTagOpen)}
                      className="text-xs underline"
                      style={{ color: COPPER_DIM }}
                    >
                      Set all missing tags to…
                    </button>
                    {bulkTagOpen && (
                      <span className="absolute left-0 top-full mt-1 z-10 flex flex-wrap gap-1 p-2 rounded-lg" style={{ backgroundColor: SURFACE_3, border: `1px solid ${SURFACE_3_BORDER}`, minWidth: 200 }}>
                        {SKILL_TAGS.map(tag => (
                          <button
                            key={tag.value}
                            onClick={() => setAllMissingTags(tag.value as SkillTagValue)}
                            className="text-[10px] px-2 py-1 rounded-full transition-colors"
                            style={{ backgroundColor: 'rgba(196,145,95,0.2)', color: COPPER_DIM, border: `1px solid ${COPPER_BORDER}` }}
                          >
                            {tag.label}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                )}
                {rows.some(r => !r.skip && r.tags.length === 0) && (
                  <button
                    onClick={skipAllUntagged}
                    className="ml-2 text-xs underline"
                    style={{ color: TEXT_HINT }}
                  >
                    Skip all untagged
                  </button>
                )}
              </div>
            )}

            {/* Rows */}
            <div
              className="space-y-2"
              style={{
                maxHeight: isDesktop ? '60vh' : '55vh',
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {rows.map(row => (
                <ReviewRow
                  key={row.rowIndex}
                  row={row}
                  onUpdate={patch => updateRow(row.rowIndex, patch)}
                  onToggleTag={tag => toggleTag(row.rowIndex, tag)}
                  isDesktop={isDesktop}
                />
              ))}
            </div>

            {duplicatePrompt && (
              <div className="mt-3 rounded-lg px-4 py-3" style={{ backgroundColor: 'rgba(196,145,95,0.1)', border: `1px solid ${COPPER_BORDER}` }}>
                <p className="text-sm" style={{ color: COPPER_DIM }}>{duplicatePrompt[0]}</p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => void doImport(true)}
                    disabled={importing}
                    className="text-xs font-semibold px-4 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'rgba(218,116,34,0.85)', color: 'white' }}
                  >
                    {importing ? 'Importing…' : 'Import anyway'}
                  </button>
                  <button
                    onClick={() => setDuplicatePrompt(null)}
                    className="text-xs text-white/40 hover:text-white/70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {importError && (
              <p className="mt-3 text-sm text-error">{importError}</p>
            )}

            {/* Footer */}
            <div
              className={`flex items-center justify-between ${isDesktop ? 'mt-7 pt-5' : 'mt-5 pt-4'}`}
              style={{ borderTop: `1px solid ${SURFACE_3_BORDER}` }}
            >
              <button
                onClick={() => setStep('upload')}
                className="transition-colors"
                style={{
                  fontSize: isDesktop ? 12 : 14,
                  color: isDesktop ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.40)',
                  fontWeight: isDesktop ? 600 : 400,
                  letterSpacing: isDesktop ? '0.10em' : 'normal',
                  textTransform: isDesktop ? 'uppercase' : 'none',
                }}
              >
                ← Back
              </button>
              <div className="flex items-center gap-4">
                {!canImport && needAttention > 0 && (
                  <span
                    style={{
                      fontSize: isDesktop ? 13 : 12,
                      color: 'rgba(245,158,11,0.95)',
                    }}
                  >
                    Fix {needAttention} error{needAttention > 1 ? 's' : ''} to import
                  </span>
                )}
                {!canImport && activeRows.length === 0 && (
                  <span
                    style={{
                      fontSize: isDesktop ? 13 : 12,
                      color: TEXT_TERTIARY,
                    }}
                  >
                    All rows skipped
                  </span>
                )}
                <button
                  onClick={handleImport}
                  disabled={!canImport || importing}
                  className="transition-all disabled:opacity-40 j2-press"
                  style={{
                    height: isDesktop ? 52 : 36,
                    padding: isDesktop ? '0 28px' : '8px 20px',
                    fontSize: isDesktop ? 15 : 14,
                    fontWeight: 600,
                    color: 'white',
                    borderRadius: 10,
                    backgroundColor: canImport && !importing ? '#DA7422' : 'rgba(196,145,95,0.2)',
                    boxShadow: isDesktop && canImport && !importing
                      ? '0 2px 12px rgba(218,116,34,0.25), 0 0 0 1px rgba(218,116,34,0.30)'
                      : undefined,
                  }}
                >
                  {importing ? 'Importing…' : `Import ${activeRows.length} session${activeRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ───────────────────────────────────────────────── */}
        {step === 'done' && (
          <div
            className="flex flex-col items-center text-center"
            style={{
              gap: isDesktop ? 18 : 16,
              padding: isDesktop ? '32px 0 8px' : '32px 0',
            }}
          >
            <span style={{ fontSize: isDesktop ? 56 : 40, color: PALE_YELLOW, lineHeight: 1 }}>✓</span>
            <div>
              {isDesktop ? (
                <>
                  <p className="j2-label-copper" style={{ marginBottom: 8 }}>◇ Imported</p>
                  <p
                    className="j2-serif-display j2-heading-glow"
                    style={{ fontSize: 36, lineHeight: 1.1, margin: 0 }}
                  >
                    {importedCount} session{importedCount !== 1 ? 's' : ''} on the record.
                  </p>
                </>
              ) : (
                <p className="text-white font-semibold text-lg">
                  {importedCount} session{importedCount !== 1 ? 's' : ''} imported
                </p>
              )}
              {rows.filter(r => r.skip).length > 0 && (
                <p
                  style={{
                    marginTop: isDesktop ? 12 : 4,
                    fontSize: isDesktop ? 14 : 13,
                    color: TEXT_TERTIARY,
                    fontStyle: isDesktop ? 'italic' : 'normal',
                    fontFamily: isDesktop ? '"Cormorant Garamond", Georgia, serif' : undefined,
                  }}
                >
                  {rows.filter(r => r.skip).length} skipped
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="transition-all j2-press"
              style={{
                marginTop: isDesktop ? 12 : 8,
                height: isDesktop ? 52 : 36,
                padding: isDesktop ? '0 28px' : '8px 20px',
                fontSize: isDesktop ? 15 : 14,
                fontWeight: 600,
                color: 'white',
                borderRadius: 10,
                backgroundColor: '#DA7422',
                boxShadow: isDesktop
                  ? '0 2px 12px rgba(218,116,34,0.25), 0 0 0 1px rgba(218,116,34,0.30)'
                  : undefined,
              }}
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
  isDesktop?: boolean;
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

function ReviewRow({ row, onUpdate, onToggleTag, isDesktop = false }: ReviewRowProps) {
  const needsTag = !row.skip && row.tags.length === 0;
  const hasErrors = row.errors.length > 0;

  const rowBg = row.skip
    ? 'rgba(255,255,255,0.02)'
    : row.isDuplicate
      ? 'rgba(196,145,95,0.07)'
      : hasErrors
        ? 'rgba(245,158,11,0.06)'
        : SURFACE_2;

  const rowBorder = row.skip
    ? SURFACE_2_BORDER
    : row.isDuplicate
      ? COPPER_BORDER
      : hasErrors
        ? 'rgba(245,158,11,0.3)'
        : SURFACE_2_BORDER;

  return (
    <div
      className="rounded-lg"
      style={{
        backgroundColor: rowBg,
        border: `1px solid ${rowBorder}`,
        opacity: row.skip ? 0.45 : 1,
        padding: isDesktop ? '12px 16px' : '10px 12px',
      }}
    >
      {/* Top row: aligned grid on desktop, flex-wrap on mobile.
          Desktop columns: date | duration | gi/nogi | type | intensity | notes-preview | skip */}
      <div
        style={
          isDesktop
            ? {
                display: 'grid',
                gridTemplateColumns: '94px 110px 100px 132px 124px 1fr 78px',
                gap: 12,
                alignItems: 'center',
              }
            : { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }
        }
      >

        {/* Date */}
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
          style={{
            color: row.date ? 'rgba(255,255,255,0.7)' : 'rgba(245,158,11,0.8)',
            backgroundColor: SURFACE_2,
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
        <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${SURFACE_3_BORDER}` }}>
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
        <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${SURFACE_3_BORDER}` }}>
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
                backgroundColor: row.intensity === n ? 'rgba(196,145,95,0.5)' : SURFACE_3,
                color: row.intensity === n ? 'rgba(218,116,34,0.95)' : 'rgba(255,255,255,0.3)',
              }}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Notes preview — desktop only, lives in the grid's 6th column.
            On mobile the notes block renders below the row instead. */}
        {isDesktop && (
          <div
            className="truncate"
            style={{
              fontSize: 12,
              color: row.notes ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.20)',
              fontStyle: row.notes ? 'normal' : 'italic',
            }}
            title={row.notes ?? ''}
          >
            {row.notes || '—'}
          </div>
        )}

        {/* Skip toggle */}
        <button
          onClick={() => onUpdate({ skip: !row.skip })}
          className="transition-colors"
          style={{
            fontSize: isDesktop ? 12 : 12,
            color: row.skip ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.4)',
            fontWeight: isDesktop ? 600 : 400,
            letterSpacing: isDesktop ? '0.06em' : 'normal',
            textAlign: isDesktop ? 'right' : undefined,
            marginLeft: isDesktop ? 0 : 'auto',
          }}
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
                  backgroundColor: active ? 'rgba(196,145,95,0.25)' : SURFACE_2,
                  color: active ? 'rgba(218,116,34,0.9)' : 'rgba(255,255,255,0.3)',
                  border: active ? `1px solid rgba(196,145,95,0.4)` : `1px solid ${SURFACE_3_BORDER}`,
                }}
              >
                {tag.label}
              </button>
            );
          })}
          {needsTag && (
            <span className="text-[10px] text-white/25 self-center ml-1">← optional</span>
          )}
        </div>
      )}

      {/* Notes preview — mobile only; desktop renders this inside the grid above */}
      {!isDesktop && !row.skip && row.notes && (
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
          backgroundColor: duration ? SURFACE_2 : 'rgba(245,158,11,0.12)',
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
