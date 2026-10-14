// ReportProblemModal — user-facing "something's broken" form.
//
// User types subject + description; the form silently captures debug context
// (page_url, user_agent, app_version) at submit time so the admin gets full
// triage info without burdening the user. The submitted case lands in the
// admin dashboard's queue (POST /api/cases → support_cases table, mig 023).
//
// Modal chrome mirrors CsvImportModal: fixed inset-0, z-[60], opaque backdrop
// + 12px blur, animate-j2-modal-in on the content card.

import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { PALE_YELLOW, COPPER, CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, SURFACE_3, SURFACE_3_BORDER, STATUS_ERROR, STATUS_ERROR_BG, STATUS_ERROR_BORDER, TEXT_PRIMARY, TEXT_TERTIARY } from '../lib/theme.ts';

interface Props {
    onClose: () => void;
}

export default function ReportProblemModal({ onClose }: Props) {
    const [subject, setSubject]         = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting]   = useState(false);
    const [error, setError]             = useState<string | null>(null);
    const [success, setSuccess]         = useState(false);

    // Auto-close on Escape (matches the rest of the modal-chrome convention).
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Auto-dismiss on success after a short pause so the user sees the confirmation.
    useEffect(() => {
        if (!success) return;
        const t = setTimeout(onClose, 1500);
        return () => clearTimeout(t);
    }, [success, onClose]);

    const canSubmit = subject.trim().length > 0 && description.trim().length > 0 && !submitting;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            await api.post('/api/cases', {
                subject:     subject.trim(),
                description: description.trim(),
                // ── Auto-context (zero user friction) ──
                // The user types subject + description; everything else is
                // captured silently so the admin has full debug context when
                // triaging the case.
                page_url:    typeof window !== 'undefined' ? window.location.href : null,
                user_agent:  typeof navigator !== 'undefined' ? navigator.userAgent : null,
                app_version: (import.meta as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION ?? 'dev',
            });
            setSuccess(true);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to send. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Report a problem"
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto px-5 animate-j2-backdrop-in"
            style={{
                backgroundColor: 'rgba(13,26,20,0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                paddingTop: 'max(2rem, env(safe-area-inset-top))',
                paddingBottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 32px)',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-md animate-j2-modal-in"
                style={{
                    backgroundColor: CARD_BG,
                    border: `1px solid ${CARD_GLOW_BORDER}`,
                    boxShadow: CARD_GLOW,
                    borderRadius: 16,
                    padding: 24,
                }}
            >
                <div style={{ marginBottom: 18 }}>
                    <p className="j2-label-copper" style={{ marginBottom: 8 }}>◇ Support</p>
                    <h2
                        className="j2-serif-display"
                        style={{ fontSize: 28, color: PALE_YELLOW, lineHeight: 1.1, margin: 0 }}
                    >
                        Report a problem
                    </h2>
                    <p style={{ fontSize: 13, color: TEXT_TERTIARY, marginTop: 8, lineHeight: 1.5 }}>
                        Tell us what's wrong and we'll take a look. The page you're on
                        and your browser info come along automatically.
                    </p>
                </div>

                {success ? (
                    <div
                        style={{
                            backgroundColor: 'rgba(168,203,114,0.10)',
                            border: '1px solid rgba(168,203,114,0.30)',
                            borderRadius: 12,
                            padding: '14px 18px',
                            color: 'rgba(168,203,114,0.95)',
                            fontSize: 14,
                            lineHeight: 1.5,
                        }}
                    >
                        Sent. Thanks — we'll look into it.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: '0.16em',
                                    textTransform: 'uppercase',
                                    color: TEXT_TERTIARY,
                                }}
                            >
                                Subject
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                maxLength={200}
                                required
                                placeholder="e.g. Can't save a session"
                                style={{
                                    width: '100%',
                                    padding: '11px 14px',
                                    backgroundColor: SURFACE_3,
                                    border: `1px solid ${SURFACE_3_BORDER}`,
                                    borderRadius: 10,
                                    color: TEXT_PRIMARY,
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: '0.16em',
                                    textTransform: 'uppercase',
                                    color: TEXT_TERTIARY,
                                }}
                            >
                                What happened
                            </label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={6}
                                maxLength={5000}
                                required
                                placeholder="Describe the issue — what you were doing, what you expected, what happened instead."
                                style={{
                                    width: '100%',
                                    padding: '11px 14px',
                                    backgroundColor: SURFACE_3,
                                    border: `1px solid ${SURFACE_3_BORDER}`,
                                    borderRadius: 10,
                                    color: TEXT_PRIMARY,
                                    fontSize: 14,
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    outline: 'none',
                                    lineHeight: 1.5,
                                }}
                            />
                        </div>

                        {error && (
                            <p
                                style={{
                                    fontSize: 13,
                                    padding: '10px 14px',
                                    backgroundColor: STATUS_ERROR_BG,
                                    border: `1px solid ${STATUS_ERROR_BORDER}`,
                                    borderRadius: 10,
                                    color: STATUS_ERROR,
                                }}
                            >
                                {error}
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    flex: 1,
                                    height: 48,
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.10)',
                                    borderRadius: 12,
                                    color: TEXT_TERTIARY,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                style={{
                                    flex: 1,
                                    height: 48,
                                    background: COPPER,
                                    border: 'none',
                                    borderRadius: 12,
                                    color: '#fff',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                                    opacity: canSubmit ? 1 : 0.5,
                                    transition: 'opacity 160ms ease',
                                }}
                            >
                                {submitting ? 'Sending…' : 'Send report'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
