// NotificationPermissionPrimer — modal that primes the user before triggering
// the OS-level permission dialog. Patterned on Headspace (named categories
// with per-category toggles) + Atoms (mocked notification preview banner).
//
// On iOS, Web Push only fires when the PWA is installed via "Add to Home
// Screen". When we detect tab-mode + iOS we surface an install hint instead
// of attempting requestPermission() (which silently rejects in a tab).

import { useEffect, useState } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import {
  isPushSupported,
  isStandaloneInstall,
  isIOS,
  subscribeThisDevice,
  setCategories,
  type SubscriptionCategories,
} from '../lib/pushClient.ts';
import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, COPPER_BORDER,
  PALE_YELLOW, SURFACE_2, SURFACE_2_BORDER, FONT_EDITORIAL, GLOW_SOFT,
} from '../lib/theme.ts';

interface CategoryDef {
  key: keyof SubscriptionCategories;
  title: string;
  rationale: string;
  preview: { title: string; body: string };
}

const CATEGORIES: CategoryDef[] = [
  {
    key: 'pre_class',
    title: 'Pre-class focus',
    rationale: 'We surface your training intention 30 minutes before class starts.',
    preview: { title: 'Tue Night BJJ starts in 30 minutes.', body: 'Carry your DLR retention focus with you.' },
  },
  {
    key: 'intention_check',
    title: 'Post-class check-in',
    rationale: 'A short prompt right after class — did you train what you set out to?',
    preview: { title: 'How did the round feel?', body: 'A quick mark on whether you trained your focus.' },
  },
  {
    key: 'drive_home_log',
    title: 'Drive-home log',
    rationale: 'A quiet ping ~8 minutes after class ends, when the session is freshest.',
    preview: { title: 'A few quiet minutes.', body: 'What stayed with you from Tue Night BJJ?' },
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubscribed?: () => void;
}

export default function NotificationPermissionPrimer({ open, onClose, onSubscribed }: Props) {
  const isDesktop = useIsDesktop();
  const [flags, setFlags] = useState<SubscriptionCategories>({
    pre_class: true,
    intention_check: true,
    drive_home_log: true,
  });
  const [previewIdx, setPreviewIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cycle preview between active categories so the user sees what they're agreeing to.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setPreviewIdx(i => {
        const active = CATEGORIES.map((_, idx) => idx).filter(idx => flags[CATEGORIES[idx].key]);
        if (active.length === 0) return i;
        const cur = active.indexOf(i);
        return active[(cur + 1) % active.length] ?? active[0];
      });
    }, 3500);
    return () => clearInterval(id);
  }, [open, flags]);

  if (!open) return null;

  const supported = isPushSupported();
  const ios = isIOS();
  const installed = isStandaloneInstall();
  const blocked = !supported || (ios && !installed);

  const togglePreview = CATEGORIES[previewIdx]?.preview ?? CATEGORIES[0].preview;

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await subscribeThisDevice();
      if (!result.ok) {
        setError(humanizeReason(result.reason));
        setBusy(false);
        return;
      }
      // Apply per-category flags after subscribing so the server has a row to update.
      await setCategories(flags);
      onSubscribed?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enable notifications"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex',
        alignItems: isDesktop ? 'center' : 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        padding: isDesktop ? 24 : 0,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: CARD_BG,
          border: `1px solid ${CARD_GLOW_BORDER}`,
          boxShadow: CARD_GLOW,
          borderRadius: isDesktop ? 20 : '20px 20px 0 0',
          width: '100%',
          maxWidth: 520,
          padding: '28px 24px 24px',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        <p
          style={{
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: COPPER, marginBottom: 8,
          }}
        >
          ◇ Notifications
        </p>
        <h2
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 26, color: PALE_YELLOW,
            textShadow: GLOW_SOFT, marginBottom: 8,
          }}
        >
          Three quiet pings around each class.
        </h2>
        <p style={{ color: 'rgba(242,228,168,0.6)', fontSize: 14, marginBottom: 22 }}>
          Pick which ones you want. You can change them any time.
        </p>

        {/* Mocked iOS notification preview (Atoms pattern) */}
        <div
          style={{
            backgroundColor: SURFACE_2,
            border: `1px solid ${SURFACE_2_BORDER}`,
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: `linear-gradient(135deg, ${COPPER}, ${PALE_YELLOW})`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>
              Journada · now
            </span>
          </div>
          <p style={{ color: PALE_YELLOW, fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
            {togglePreview.title}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            {togglePreview.body}
          </p>
        </div>

        {/* Three category toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {CATEGORIES.map((cat) => {
            const active = flags[cat.key];
            return (
              <button
                key={cat.key}
                onClick={() => setFlags(f => ({ ...f, [cat.key]: !f[cat.key] }))}
                style={{
                  textAlign: 'left',
                  backgroundColor: SURFACE_2,
                  border: `1px solid ${active ? COPPER_BORDER : SURFACE_2_BORDER}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: PALE_YELLOW, fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                    {cat.title}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                    {cat.rationale}
                  </p>
                </div>
                <div
                  aria-hidden
                  style={{
                    width: 38, height: 22, borderRadius: 999, flexShrink: 0,
                    backgroundColor: active ? COPPER : 'rgba(255,255,255,0.10)',
                    border: `1px solid ${active ? COPPER_BORDER : 'rgba(255,255,255,0.12)'}`,
                    position: 'relative',
                    transition: 'background-color 180ms ease',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute', top: 2, left: active ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%',
                      backgroundColor: active ? PALE_YELLOW : 'rgba(255,255,255,0.6)',
                      transition: 'left 180ms ease, background-color 180ms ease',
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {blocked && (
          <p style={{ color: 'rgba(255,180,140,0.85)', fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
            {ios && !installed
              ? 'iOS only delivers PWA notifications when Journada is installed to your Home Screen. Tap the share icon and choose "Add to Home Screen" first.'
              : 'Your browser doesn\'t support web push. Try Safari (iOS 16.4+), Chrome, or Edge.'}
          </p>
        )}

        {error && !blocked && (
          <p style={{ color: 'rgba(255,140,120,0.9)', fontSize: 13, marginBottom: 18 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'rgba(242,228,168,0.55)',
              fontSize: 13,
              padding: '8px 4px',
              cursor: 'pointer',
              borderBottom: '1px solid transparent',
            }}
          >
            Not now
          </button>
          <button
            onClick={onSave}
            disabled={blocked || busy}
            style={{
              backgroundColor: blocked ? 'rgba(196,145,95,0.25)' : COPPER,
              color: blocked ? 'rgba(255,255,255,0.4)' : '#fff',
              fontSize: 14, fontWeight: 600,
              borderRadius: 12, padding: '10px 18px',
              cursor: blocked || busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Enabling…' : 'Save & enable'}
          </button>
        </div>
      </div>
    </div>
  );
}

function humanizeReason(reason: string): string {
  if (reason === 'unsupported') return 'This browser doesn\'t support web push.';
  if (reason === 'ios-requires-install') return 'Install Journada to your Home Screen first to enable notifications.';
  if (reason === 'permission-denied') return 'Notifications were blocked. Enable them in Settings → Notifications → Journada.';
  if (reason === 'permission-default') return 'You\'ll need to allow notifications when prompted.';
  return 'Could not enable notifications.';
}
