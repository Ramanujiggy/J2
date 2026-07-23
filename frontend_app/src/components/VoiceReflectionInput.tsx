// VoiceReflectionInput — notes textarea with a mic button that streams
// Web Speech API transcription into the field. Designed for post-training
// use (sweaty, short attention, don't-make-them-type).
//
// Graceful fallback: when SpeechRecognition isn't available (desktop Firefox
// sometimes, older iOS, privacy-locked contexts), the mic button renders
// hidden and the textarea behaves like a plain textarea.

import { useEffect, useRef, useState } from 'react';
import { COPPER, PALE_YELLOW } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';

// Webkit and unprefixed SpeechRecognition, typed loosely — the DOM lib typings
// only cover one of the pair and we need both for iOS Safari support.
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  textareaName?: string;
  /** Optional — if provided, style overrides merge over defaults. */
  textareaStyle?: React.CSSProperties;
  textareaClassName?: string;
}

export default function VoiceReflectionInput({
  value,
  onChange,
  placeholder = "What stood out today?",
  rows = 2,
  textareaName,
  textareaStyle,
  textareaClassName,
}: Props) {
  const [recognitionSupported] = useState(() => getSpeechRecognitionCtor() !== null);
  const [recording, setRecording] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Snapshot of `value` at the moment recording started — incoming transcripts
  // are appended to this baseline so the user can keep pre-typed text intact.
  const baselineRef = useRef('');

  // Show the "don't type — just talk" hint on first render if supported.
  useEffect(() => {
    if (!recognitionSupported) return;
    if (localStorage.getItem('j2_voice_hint_seen')) return;
    setShowHint(true);
    const t = setTimeout(() => setShowHint(false), 5_000);
    return () => clearTimeout(t);
  }, [recognitionSupported]);

  function dismissHint() {
    setShowHint(false);
    localStorage.setItem('j2_voice_hint_seen', '1');
  }

  function startRecording() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    baselineRef.current = value;

    rec.onresult = (event: unknown) => {
      // Normalize the results (they come as a live-growing array).
      const ev = event as { results: ArrayLike<ArrayLike<{ transcript: string }>> };
      let combined = '';
      for (let i = 0; i < ev.results.length; i++) {
        const alt = ev.results[i]?.[0];
        if (alt) combined += alt.transcript;
      }
      const merged = baselineRef.current
        ? `${baselineRef.current.trim()} ${combined.trim()}`.trim()
        : combined.trim();
      onChange(merged);
    };
    rec.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setRecording(true);
      dismissHint();
      vibrate(10);
    } catch {
      // Start can throw if permission was denied or the API is locked —
      // silently fail back to typing.
      setRecording(false);
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    vibrate(8);
  }

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        name={textareaName}
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={textareaClassName ?? 'w-full rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder-white/25 outline-none resize-none transition-colors'}
        style={{
          backgroundColor: 'var(--j2-surface-3)',
          border: '1px solid rgba(255,255,255,0.08)',
          paddingRight: recognitionSupported ? 44 : undefined,
          ...textareaStyle,
        }}
      />

      {recognitionSupported && (
        <>
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            aria-label={recording ? 'Stop recording' : 'Record voice note'}
            aria-pressed={recording}
            className="touch-manipulation"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 32,
              height: 32,
              borderRadius: 16,
              background: recording ? COPPER : 'rgba(196,145,95,0.12)',
              border: recording ? 'none' : '1px solid rgba(196,145,95,0.35)',
              color: recording ? '#0A1410' : COPPER,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 160ms ease, box-shadow 160ms ease',
              boxShadow: recording
                ? `0 0 0 4px rgba(196,145,95,0.18), 0 0 14px rgba(196,145,95,0.55)`
                : 'none',
              animation: recording ? 'j2-mic-pulse 1.6s ease-in-out infinite' : undefined,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <line x1="12" y1="18" x2="12" y2="22" />
            </svg>
          </button>

          {showHint && (
            <div
              role="status"
              aria-live="polite"
              onClick={dismissHint}
              style={{
                position: 'absolute',
                top: 44,
                right: 4,
                background: 'rgba(10,20,16,0.96)',
                border: '1px solid rgba(196,145,95,0.35)',
                color: PALE_YELLOW,
                fontSize: 11.5,
                padding: '8px 12px',
                borderRadius: 10,
                letterSpacing: '0.02em',
                boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
                cursor: 'pointer',
                maxWidth: 220,
                lineHeight: 1.35,
                zIndex: 10,
              }}
            >
              Don't type — just talk. Tap the mic.
            </div>
          )}

          {/* Pulse keyframes — scoped via a <style> tag so we don't touch
              the global stylesheet for a rarely-animating control. */}
          <style>{`
            @keyframes j2-mic-pulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(196,145,95,0.55), 0 0 14px rgba(196,145,95,0.55); }
              50%      { box-shadow: 0 0 0 6px rgba(196,145,95,0.08), 0 0 18px rgba(196,145,95,0.75); }
            }
          `}</style>

          {recording && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                bottom: 8,
                left: 16,
                fontSize: 10.5,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: COPPER,
                fontWeight: 700,
              }}
            >
              ● Recording
            </div>
          )}
        </>
      )}
    </div>
  );
}
