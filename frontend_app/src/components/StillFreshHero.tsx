// StillFreshHero — dominant hero card for the home screen.
//
// Two modes, same immersive shell (gradient + prism + depth shadow):
// 1. "capture" — recent session exists, invite user to add notes
// 2. "technique" — no fresh session, showcase a technique from the library

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { COPPER, PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT, SURFACE_2, COPPER_BORDER } from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { useUserTags } from '../hooks/useUserTags.ts';
import PrismCanvas from './PrismCanvas.tsx';

interface LastSession {
  date: string;
  duration: number;
  focusLabel: string;
  endedAgo: string;
  hasNotes?: boolean;
}

interface Props {
  lastSession: LastSession | null;
  onAddNotes: () => void;
  onDismiss: () => void;
}

const ORANGE = '#DA7422';
const FRESH_THRESHOLD_HOURS = 24;

function FlameIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M8 1C8 1 3.5 5.5 3.5 9.5C3.5 12 5.5 14 8 14C10.5 14 12.5 12 12.5 9.5C12.5 5.5 8 1 8 1Z" fill="rgba(196,145,95,0.55)" />
      <path d="M8 6C8 6 6 8.5 6 10.2C6 11.2 6.9 12 8 12C9.1 12 10 11.2 10 10.2C10 8.5 8 6 8 6Z" fill="rgba(242,228,168,0.6)" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 3.5L12.5 6.5" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function isFresh(endedAgo: string): boolean {
  if (endedAgo === 'today') return true;
  const match = endedAgo.match(/^(\d+)\s*(h|hour)/i);
  if (match) return parseInt(match[1], 10) < FRESH_THRESHOLD_HOURS;
  return false;
}

export default function StillFreshHero({ lastSession, onAddNotes, onDismiss }: Props) {
  const navigate = useNavigate();
  const { tags } = useUserTags();

  // Determine mode: capture if session is fresh + unannotated, else technique
  const showCapture = lastSession && isFresh(lastSession.endedAgo) && !lastSession.hasNotes;

  // Technique cycling — pick a random start, auto-rotate every 20s, swipeable
  const [techIndex, setTechIndex] = useState(() => tags.length > 0 ? Math.floor(Math.random() * tags.length) : 0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setInterval>>();

  const resetAutoTimer = useCallback(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    if (!showCapture && tags.length > 1) {
      autoTimerRef.current = setInterval(() => {
        setSlideDir('left');
        setTimeout(() => {
          setTechIndex(prev => (prev + 1) % tags.length);
          setSlideDir(null);
        }, 200);
      }, 20000);
    }
  }, [showCapture, tags.length]);

  useEffect(() => {
    if (showCapture || tags.length === 0) return;
    resetAutoTimer();
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  }, [showCapture, tags.length, resetAutoTimer]);

  const goNext = useCallback(() => {
    if (tags.length <= 1) return;
    setSlideDir('left');
    setTimeout(() => {
      setTechIndex(prev => (prev + 1) % tags.length);
      setSlideDir(null);
    }, 180);
    resetAutoTimer();
  }, [tags.length, resetAutoTimer]);

  const goPrev = useCallback(() => {
    if (tags.length <= 1) return;
    setSlideDir('right');
    setTimeout(() => {
      setTechIndex(prev => (prev - 1 + tags.length) % tags.length);
      setSlideDir(null);
    }, 180);
    resetAutoTimer();
  }, [tags.length, resetAutoTimer]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }
    if (!isHorizontal.current) return;
    setDragX(dx);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dt = Date.now();
    if (isHorizontal.current && (Math.abs(dx) > 50)) {
      if (dx < 0) goNext();
      else goPrev();
    }
    setDragX(0);
    setIsDragging(false);
  }, [goNext, goPrev]);

  const technique = tags.length > 0 ? tags[techIndex % tags.length] : null;
  const pillarLabel = technique
    ? (SKILL_TAGS.find(s => s.value === technique.parent_pillar)?.label ?? technique.parent_pillar)
    : null;

  if (!lastSession && !technique) return null;

  const techContentTransform = isDragging
    ? `translateX(${dragX}px)`
    : slideDir === 'left'
      ? 'translateX(-30px)'
      : slideDir === 'right'
        ? 'translateX(30px)'
        : 'translateX(0)';
  const techContentOpacity = slideDir ? 0 : 1;
  const techContentTransition = isDragging
    ? 'none'
    : 'transform 0.2s ease, opacity 0.18s ease';

  return (
    <div
      style={{
        borderRadius: 20,
        minHeight: showCapture ? 236 : 190,
        overflow: 'hidden',
        border: '1px solid var(--j2-border-2)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(196,145,95,0.08)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Background gradient */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(130% 120% at 18% -10%, #21432f 0%, #14291e 52%, #0b1c14 100%)' }} />

      {/* Bottom scrim */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,20,14,0.92) 6%, rgba(8,20,14,0.35) 46%, transparent 70%)' }} />

      {/* Live prism mark */}
      <div aria-hidden style={{ position: 'absolute', top: -10, right: -10, pointerEvents: 'none', opacity: 0.55 }}>
        <PrismCanvas size={120} />
      </div>

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: showCapture ? 236 : 190,
          flex: 1,
        }}
      >
        {showCapture && lastSession ? (
          /* ── CAPTURE MODE ── */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.50)', backgroundColor: SURFACE_2, padding: '5px 10px', borderRadius: 8 }}>
                {lastSession.endedAgo}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: COPPER, backgroundColor: 'rgba(196,145,95,0.16)', border: `1px solid ${COPPER_BORDER}`, padding: '5px 10px', borderRadius: 8 }}>
                <FlameIcon />
                Still fresh
              </span>
            </div>
            <div>
              <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 46, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
                Jiu Jitsu
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                {formatDuration(lastSession.duration)} &middot; {lastSession.focusLabel} &middot; ended {lastSession.endedAgo}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                <button type="button" onClick={onAddNotes} className="j2-press" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, padding: '0 20px', borderRadius: 12, border: 'none', backgroundColor: ORANGE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  <PencilIcon /> Add notes
                </button>
                <button type="button" onClick={onDismiss} style={{ height: 44, padding: '0 14px', borderRadius: 12, border: 'none', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  Not now
                </button>
              </div>
            </div>
          </>
        ) : technique ? (
          /* ── TECHNIQUE SHOWCASE MODE — swipeable ── */
          <div
            data-no-page-swipe=""
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'pan-y', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.50)', backgroundColor: SURFACE_2, padding: '5px 10px', borderRadius: 8 }}>
                From your library
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: COPPER }}>
                {pillarLabel}
              </span>
            </div>
            <div style={{ transform: techContentTransform, opacity: techContentOpacity, transition: techContentTransition }}>
              <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05, color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
                {technique.name}
              </div>
              {technique.resonance_journal && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.40)', fontStyle: 'italic', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                  {technique.resonance_journal}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => navigate(`/library/${technique.id}`)}
                  className="j2-press"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, padding: '0 16px', borderRadius: 10, border: 'none', backgroundColor: ORANGE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  View technique →
                </button>
                {tags.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {tags.map((_, i) => (
                      <span
                        key={i}
                        style={{
                          width: i === (techIndex % tags.length) ? 12 : 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: i === (techIndex % tags.length) ? COPPER : 'rgba(255,255,255,0.15)',
                          transition: 'width 0.2s ease, background-color 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : lastSession ? (
          /* ── FALLBACK: show session without "still fresh" framing ── */
          <>
            <div />
            <div>
              <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05, color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
                Jiu Jitsu
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>
                Last session: {formatDuration(lastSession.duration)} &middot; {lastSession.focusLabel} &middot; {lastSession.endedAgo}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
