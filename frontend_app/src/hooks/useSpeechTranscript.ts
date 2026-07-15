// Continuous Web Speech transcription for the Capture Composer. Extracted
// from VoiceReflectionInput's recognition wiring (which stays as-is for the
// legacy form): continuous + interim results, transcript accumulates across
// pauses, elapsed ticks while recording. Unsupported browsers (desktop
// Firefox, locked-down iOS) get supported=false — callers fall back to the
// keyboard path with the transcript-so-far preserved.

import { useEffect, useRef, useState } from 'react';

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

function getCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechTranscript() {
  const [supported] = useState(() => getCtor() !== null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baselineRef = useRef('');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    const Ctor = getCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    baselineRef.current = transcript;

    rec.onresult = (event: unknown) => {
      const ev = event as { results: ArrayLike<ArrayLike<{ transcript: string }>> };
      let combined = '';
      for (let i = 0; i < ev.results.length; i++) {
        const alt = ev.results[i]?.[0];
        if (alt) combined += alt.transcript;
      }
      const merged = baselineRef.current
        ? `${baselineRef.current.trim()} ${combined.trim()}`.trim()
        : combined.trim();
      setTranscript(merged);
    };
    const cleanup = () => {
      setRecording(false);
      recRef.current = null;
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
    rec.onend = cleanup;
    rec.onerror = cleanup;

    try {
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setElapsed(0);
      tickRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch {
      cleanup();
    }
  };

  const stop = () => recRef.current?.stop();

  useEffect(() => () => {
    recRef.current?.abort();
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  return { supported, recording, transcript, setTranscript, elapsed, start, stop };
}
