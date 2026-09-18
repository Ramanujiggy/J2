// ProfileDetailsSheet — "Your details" on desktop.
//
// The one place for who you are and how you sign in: name and home gym
// (editable, saved together), and the email you log in with (read-only,
// with a "Change password" action that sends the existing reset link).
// Opened from the housekeeping row or by clicking the name on the identity
// screen. Same modal register as PromotionSheet, so every editable thing on
// the identity screen opens the same way: click it, a sheet, commit, done.
//
// Not here, deliberately: changing email (needs a verification round trip)
// and deleting the account (needs a data decision). Both are features, not
// rows.

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import { useGymAutocomplete, type GymPlace } from '../hooks/useGymAutocomplete.ts';
import { COPPER, PALE_YELLOW, FONT_EDITORIAL } from '../lib/theme.ts';

const TEXT_SECONDARY = 'rgba(255,255,255,0.66)';
const TEXT_TERTIARY  = 'rgba(255,255,255,0.46)';
const HAIRLINE       = '1px solid rgba(255,255,255,0.06)';

const LABEL: React.CSSProperties = {
  display: 'block', marginBottom: 8,
  fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.40)',
};

const INPUT_CLS = 'w-full rounded-xl px-4 py-3.5 text-[15px] text-white placeholder-white/25 outline-none transition-colors j2-copper-focus';

export interface ProfileDetails {
  name: string;
  home_gym_name: string;
  home_gym_address: string;
  home_gym_place_id: string;
}

interface Props {
  open: boolean;
  details: ProfileDetails;
  email: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (next: ProfileDetails) => void;
}

type ResetState = 'idle' | 'sending' | 'sent' | 'failed';

export default function ProfileDetailsSheet({ open, details, email, saving, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<ProfileDetails>(details);
  const [reset, setReset] = useState<ResetState>('idle');
  const gymRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLFormElement>(open, onClose);

  // Reseed each time the sheet opens so a cancelled edit never leaks. Only
  // on open: the parent passes a fresh `details` object every render, and
  // reseeding on that would wipe typing mid-edit.
  const detailsRef = useRef(details);
  detailsRef.current = details;
  useEffect(() => {
    if (!open) return;
    setDraft(detailsRef.current);
    setReset('idle');
  }, [open]);

  const { hasMaps } = useGymAutocomplete(gymRef, open, (place: GymPlace) => {
    setDraft(d => ({
      ...d,
      home_gym_name: place.home_gym_name ?? d.home_gym_name,
      home_gym_address: place.home_gym_address,
      home_gym_place_id: place.home_gym_place_id,
    }));
  });

  if (!open) return null;

  const sendReset = async () => {
    if (!email || reset === 'sending') return;
    setReset('sending');
    try {
      await api.post('/auth/request-password-reset', { email });
      setReset('sent');
    } catch {
      setReset('failed');
    }
  };

  const resetLabel: Record<ResetState, string> = {
    idle: 'Change password',
    sending: 'Sending…',
    sent: 'Reset link sent',
    failed: 'Could not send — try again',
  };

  return (
    <div
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
      className="animate-j2-backdrop-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(5,10,7,0.74)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <form
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your details"
        className="animate-j2-modal-in"
        onSubmit={e => { e.preventDefault(); onSave(draft); }}
        style={{
          width: 520, maxWidth: '100%',
          background: '#17291F',
          border: '1px solid rgba(196,145,95,0.24)',
          borderRadius: 22,
          padding: '34px 38px 30px',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: COPPER }}>
          Your details
        </div>
        <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 30, fontWeight: 600, color: PALE_YELLOW, marginTop: 8 }}>
          {draft.name.trim() || 'Practitioner'}
        </div>

        {/* Name */}
        <div style={{ marginTop: 26 }}>
          <label style={LABEL} htmlFor="details-name">Name</label>
          <input
            id="details-name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="Your name"
            className={INPUT_CLS}
          />
        </div>

        {/* Home gym */}
        <div style={{ marginTop: 20 }}>
          <label style={LABEL} htmlFor="details-gym">Home gym</label>
          {hasMaps ? (
            <>
              <input
                id="details-gym"
                ref={gymRef}
                type="text"
                autoCapitalize="words"
                defaultValue={draft.home_gym_name}
                onChange={e => setDraft(d => ({ ...d, home_gym_name: e.target.value }))}
                placeholder="Search for your gym…"
                className={INPUT_CLS}
              />
              {draft.home_gym_address && (
                <p style={{ marginTop: 6, fontSize: 12, color: TEXT_TERTIARY }}>{draft.home_gym_address}</p>
              )}
            </>
          ) : (
            <input
              id="details-gym"
              type="text"
              autoCapitalize="words"
              value={draft.home_gym_name}
              onChange={e => setDraft(d => ({ ...d, home_gym_name: e.target.value }))}
              placeholder="Gym name"
              className={INPUT_CLS}
            />
          )}
        </div>

        {/* Sign-in */}
        <div style={{ marginTop: 26, paddingTop: 20, borderTop: HAIRLINE }}>
          <span style={LABEL}>Signing in</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ fontSize: 15, color: TEXT_SECONDARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email ?? '—'}
            </span>
            <button
              type="button"
              onClick={() => { void sendReset(); }}
              disabled={!email || reset === 'sending' || reset === 'sent'}
              style={{
                flexShrink: 0, fontSize: 12.5, fontWeight: 700,
                padding: '8px 14px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'none',
                color: reset === 'sent' ? COPPER : reset === 'failed' ? '#E07560' : TEXT_SECONDARY,
                cursor: !email || reset === 'sending' || reset === 'sent' ? 'default' : 'pointer',
              }}
            >
              {resetLabel[reset]}
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: 12, color: TEXT_TERTIARY, lineHeight: 1.5 }}>
            {reset === 'sent'
              ? 'Check your inbox for a link to set a new password.'
              : 'We’ll email you a link to set a new password.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1, height: 46, borderRadius: 13,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'none', color: TEXT_SECONDARY,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1, height: 46, borderRadius: 13,
              background: COPPER, color: '#12130e', border: 'none',
              fontSize: 14, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
