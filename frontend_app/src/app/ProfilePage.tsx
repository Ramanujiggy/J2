import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROFILE_ORIGIN } from '../lib/navOrigin.ts';

import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, SURFACE_2, SURFACE_2_BORDER, COPPER, STATUS_ERROR, STATUS_ERROR_BG, STATUS_ERROR_BORDER, TEXT_SECONDARY, TEXT_TERTIARY, TEXT_HINT } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import CsvImportModal from '../components/CsvImportModal.tsx';
import ReportProblemModal from '../components/ReportProblemModal.tsx';
import { exportSessionsCsv, exportIntentionsCsv } from '../lib/csvExport.ts';
import type { SessionSummary, Intention } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';
import { type BeltRank } from '../components/BeltBar.tsx';
import FlatBelt from '../components/belt/FlatBelt.tsx';
import PromotionSheet from '../components/belt/PromotionSheet.tsx';
import PromotionRevealSheet from '../components/belt/PromotionRevealSheet.tsx';
import PromotionList, { formatPromotionMonth } from '../components/belt/PromotionList.tsx';
import { isBeltRank } from '../lib/beltCloth.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { toast } from '../hooks/use-toast.ts';
import { useBeltHistory } from '../hooks/useBeltHistory.ts';
import { getStorageEstimate, type StorageEstimate } from '../lib/videoStore.ts';
import { formatBytes } from '../lib/videoUtils.ts';
import { Library, ChevronRight, Bell, Award } from 'lucide-react';
import PrismSkinToggle, { readPrismSkin, PRISM_SKIN_LABEL } from '../components/PrismSkinToggle.tsx';
import PrismSkinSheet from '../components/PrismSkinSheet.tsx';
import ProfileDesktop from '../components/ProfileDesktop.tsx';
import ProfileDetailsSheet, { type ProfileDetails } from '../components/ProfileDetailsSheet.tsx';
import { useGymAutocomplete, MAPS_KEY } from '../hooks/useGymAutocomplete.ts';
import { useStamps } from '../hooks/useStamps.ts';

interface ProfileData {
  name: string;
  belt_rank: BeltRank | null;
  stripes: number;
  home_gym_name: string;
  home_gym_address: string;
  home_gym_place_id: string;
}

interface ProfileResponse {
  profile: {
    email?: string | null;
    name: string | null;
    belt_rank: string | null;
    stripes: number;
    home_gym_name: string | null;
    home_gym_address: string | null;
    home_gym_place_id: string | null;
    intentions_enabled: boolean;
  } | null;
}

const inputClsMobile =
  'w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange';

const inputClsDesktop =
  'w-full rounded-xl px-4 py-3.5 text-[15px] text-white placeholder-white/25 outline-none transition-colors';

// Base + focus styles for desktop inputs now live in the `.j2-copper-focus`
// CSS class (index.css). Apply that className alongside inputClsDesktop
// instead of the old inline onFocus/onBlur handlers.

export default function ProfilePage() {
  const isDesktop = useIsDesktop();
  const { refreshProfile, isAdmin } = useProfile();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const gymInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileData>({
    name: '',
    belt_rank: null,
    stripes: 0,
    home_gym_name: '',
    home_gym_address: '',
    home_gym_place_id: '',
  });
  const [intentionsEnabled, setIntentionsEnabled] = useState(true);
  /** Sign-in email, shown read-only on "Your details". */
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Belt history
  const { entries: beltEntries, refetch: refetchBeltHistory } = useBeltHistory();

  // Desktop identity surface — the collection.
  const { stamps } = useStamps();
  const [beltSaving, setBeltSaving] = useState(false);
  /** The promotion sheet, opened by tapping the belt (mobile + desktop details). */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** The promotion just tied on — drives the ceremony sheet. */
  const [reveal, setReveal] = useState<{ rank: string; stripes: number; promotedAt: string } | null>(null);

  // Promotion flow — the sheet commits straight to belt_history and
  // syncs the profile's own rank/stripes, so the rail label and every other
  // belt surface follow. The new row also becomes a Promotion in the journal
  // stream (derived, see lib/journalStream.ts) — which is the point: the
  // promotion joins the corpus and can come back on its anniversary.
  const handleRecordPromotion = async (
    next: { rank: string; stripes: number; promotedAt: string },
  ) => {
    setBeltSaving(true);
    try {
      await api.post('/api/belt-history', {
        belt_rank: next.rank,
        stripes: next.stripes,
        promoted_at: next.promotedAt,
        notes: null,
      });
      await api.put('/api/profile', {
        ...form,
        belt_rank: next.rank,
        stripes: next.stripes,
      });
      setForm(f => ({ ...f, belt_rank: next.rank as BeltRank, stripes: next.stripes }));
      refetchBeltHistory();
      await refreshProfile();
    } catch {
      toast({ title: 'Could not record that promotion.', variant: 'destructive' });
    } finally {
      setBeltSaving(false);
    }
  };

  /** Removing a promotion. If it was the current position, the profile's
   *  own rank/stripes fall back to the next one on the ladder so every belt
   *  surface (rail label, identity screen, reveal) follows. */
  const [removingPromotionId, setRemovingPromotionId] = useState<string | null>(null);
  const handleRemovePromotion = async (id: string) => {
    if (removingPromotionId) return;
    setRemovingPromotionId(id);
    try {
      await api.delete(`/api/belt-history/${id}`);
      const wasCurrent = beltEntries[0]?.id === id;
      const next = beltEntries.find(e => e.id !== id) ?? null;
      if (wasCurrent && next) {
        await api.put('/api/profile', { ...form, belt_rank: next.belt_rank, stripes: next.stripes });
        setForm(f => ({ ...f, belt_rank: next.belt_rank as BeltRank, stripes: next.stripes }));
        await refreshProfile();
      }
      refetchBeltHistory();
    } catch {
      toast({ title: 'Could not remove that promotion.', variant: 'destructive' });
    } finally {
      setRemovingPromotionId(null);
    }
  };

  /** Housekeeping's one-tap export — both CSVs, your words are yours. */
  const handleExportAll = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const [sessionsRes, intentionsRes] = await Promise.all([
        api.get<{ sessions: SessionSummary[] }>('/api/sessions'),
        api.get<{ intentions: Intention[] }>('/api/intentions'),
      ]);
      await exportSessionsCsv(sessionsRes.sessions ?? []);
      exportIntentionsCsv(intentionsRes.intentions ?? []);
      toast({ title: 'Exported. Check your downloads.' });
    } catch {
      toast({ title: 'Could not export right now.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  /** Desktop only — the "Your details" sheet, opened from housekeeping or the name. */
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** Desktop only — the "Prism style" sheet; the row shows the current pick. */
  const [prismOpen, setPrismOpen] = useState(false);
  const [prismSkin, setPrismSkin] = useState(readPrismSkin);
  const [importOpen, setImportOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [existingDates, setExistingDates] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [storage, setStorage] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    void getStorageEstimate().then(setStorage);
  }, []);

  // Load existing profile
  const fetchProfile = useCallback(() => {
    api.get<ProfileResponse>('/api/profile')
      .then(data => {
        const p = data.profile;
        if (p) {
          setForm({
            name: p.name ?? '',
            belt_rank: (p.belt_rank as BeltRank) ?? null,
            stripes: p.stripes ?? 0,
            home_gym_name: p.home_gym_name ?? '',
            home_gym_address: p.home_gym_address ?? '',
            home_gym_place_id: p.home_gym_place_id ?? '',
          });
          setIntentionsEnabled(p.intentions_enabled ?? true);
          setEmail(p.email ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useOnlineRefetch(fetchProfile);

  // Google Places on the mobile form's gym input. Desktop edits the gym in
  // the details sheet, which attaches its own.
  useGymAutocomplete(gymInputRef, !loading && !isDesktop, place => {
    setForm(prev => ({
      ...prev,
      home_gym_name: place.home_gym_name ?? prev.home_gym_name,
      home_gym_address: place.home_gym_address,
      home_gym_place_id: place.home_gym_place_id,
    }));
  });

  /** The profile PUT is whole-object, so every save sends the full form. */
  const putProfile = (intentions: boolean) => api.put('/api/profile', {
    name: form.name || null,
    belt_rank: form.belt_rank,
    stripes: form.stripes,
    home_gym_name: form.home_gym_name || null,
    home_gym_address: form.home_gym_address || null,
    home_gym_place_id: form.home_gym_place_id || null,
    intentions_enabled: intentions,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await putProfile(intentionsEnabled);
      refreshProfile();
      toast({ variant: 'success', title: 'Profile saved.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Could not save profile.', description: msg });
    } finally {
      setSaving(false);
    }
  };

  /** "Your details" sheet (desktop) — name and gym, saved together. */
  const handleSaveDetails = async (next: ProfileDetails) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.put('/api/profile', {
        name: next.name || null,
        belt_rank: form.belt_rank,
        stripes: form.stripes,
        home_gym_name: next.home_gym_name || null,
        home_gym_address: next.home_gym_address || null,
        home_gym_place_id: next.home_gym_place_id || null,
        intentions_enabled: intentionsEnabled,
      });
      setForm(f => ({ ...f, ...next }));
      setDetailsOpen(false);
      refreshProfile();
      toast({ variant: 'success', title: 'Profile saved.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile.';
      toast({ variant: 'destructive', title: 'Could not save profile.', description: msg });
    } finally {
      setSaving(false);
    }
  };

  /** Desktop housekeeping toggle — there is no Save button on the identity
   *  screen, so the switch persists on its own and rolls back on failure. */
  const handleToggleIntentions = async () => {
    if (saving) return;
    const next = !intentionsEnabled;
    setIntentionsEnabled(next);
    setSaving(true);
    try {
      await putProfile(next);
      refreshProfile();
    } catch (err) {
      setIntentionsEnabled(!next);
      const msg = err instanceof Error ? err.message : 'Failed to save profile.';
      toast({ variant: 'destructive', title: 'Could not save setting.', description: msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Desktop: identity first, chores in the margin ───────────────────────
  // Name, gym and sign-in live in the "Your details" sheet; the belt has its
  // own sheet. The full form below is the mobile profile only.
  if (isDesktop) {
    return (
      <>
        <ProfileDesktop
          name={form.name || null}
          beltRank={form.belt_rank}
          stripes={form.stripes}
          academy={form.home_gym_name || null}
          beltEntries={beltEntries}
          stamps={stamps}
          savingPromotion={beltSaving}
          onRecordPromotion={handleRecordPromotion}
          onRemovePromotion={id => { void handleRemovePromotion(id); }}
          removingPromotionId={removingPromotionId}
          onEditDetails={() => setDetailsOpen(true)}
          housekeeping={[
            {
              heading: 'Housekeeping',
              rows: [
                { title: 'Your details', subtitle: 'Name, belt, home gym.', onClick: () => setDetailsOpen(true) },
                { title: 'Class times & notifications', subtitle: 'Three quiet pings around each class.', onClick: () => navigate('/profile/classes') },
                { title: 'Move library', subtitle: 'Your own clips and the techniques you keep.', onClick: () => navigate('/library', { state: PROFILE_ORIGIN }) },
              ],
            },
            {
              heading: 'Preferences',
              rows: [
                {
                  title: 'Training intentions',
                  subtitle: 'Track weekly focus and journal your intentions.',
                  onClick: () => { void handleToggleIntentions(); },
                  control: (
                    <span
                      role="switch"
                      aria-checked={intentionsEnabled}
                      aria-label="Training intentions"
                      className="rounded-full relative flex-shrink-0 w-12 h-6 transition-colors"
                      style={{ display: 'block', backgroundColor: intentionsEnabled ? 'rgba(218,116,34,0.85)' : 'rgba(255,255,255,0.10)' }}
                    >
                      <span
                        className="absolute top-0.5 rounded-full bg-white transition-transform w-5 h-5"
                        style={{ transform: intentionsEnabled ? 'translateX(26px)' : 'translateX(2px)' }}
                      />
                    </span>
                  ),
                },
                {
                  title: 'Prism style',
                  subtitle: `${PRISM_SKIN_LABEL[prismSkin]} · how the focus prism looks when you log a session.`,
                  onClick: () => setPrismOpen(true),
                },
              ],
            },
            {
              heading: 'Your data',
              rows: [
                { title: 'Import training history', subtitle: 'Upload a CSV of past sessions.', onClick: () => setImportOpen(true) },
                { title: 'Export everything', subtitle: 'Sessions and intentions as CSV — your words are yours.', onClick: () => { void handleExportAll(); } },
              ],
            },
            {
              heading: 'Account',
              rows: [
                ...(isAdmin ? [{ title: 'Admin dashboard', subtitle: 'Users, reports, and production design.', onClick: () => navigate('/admin') }] : []),
                { title: 'Report a problem', subtitle: 'Two fields; debug context attaches itself.', onClick: () => setReportOpen(true) },
                { title: 'Log out', subtitle: 'Sign out of Journada on this device.', onClick: () => { logout(); navigate('/'); }, tone: 'danger' as const },
              ],
            },
          ]}
        />
        {importOpen && (
          <CsvImportModal
            existingDates={existingDates}
            onClose={() => setImportOpen(false)}
            onImported={() => { setImportOpen(false); refreshProfile(); }}
          />
        )}
        {reportOpen && (
          <ReportProblemModal onClose={() => setReportOpen(false)} />
        )}
        <PrismSkinSheet
          open={prismOpen}
          onClose={() => setPrismOpen(false)}
          onChange={setPrismSkin}
        />
        <ProfileDetailsSheet
          open={detailsOpen}
          details={{
            name: form.name,
            home_gym_name: form.home_gym_name,
            home_gym_address: form.home_gym_address,
            home_gym_place_id: form.home_gym_place_id,
          }}
          email={email}
          saving={saving}
          onClose={() => setDetailsOpen(false)}
          onSave={next => { void handleSaveDetails(next); }}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col">

      <main className={`flex-1 ${isDesktop ? 'j2-page-container' : 'w-full mx-auto max-w-xl px-4 sm:px-6'}`} style={isDesktop ? { paddingTop: 48, paddingBottom: 48 } : { paddingTop: 24, paddingBottom: 24 }}>
        <h2 className="text-lg font-display font-semibold text-white mb-6">Your Profile</h2>

        <PageContent ready={!loading} loadingMessages={['Taping fingers...']}>
          <div className={isDesktop ? 'grid grid-cols-12 gap-8 items-start' : 'space-y-4'}>
            <div className={isDesktop ? 'col-span-7 space-y-4' : 'contents'}>
          {(() => {
            const labelCls = isDesktop
              ? 'block mb-2 text-[11px] font-bold uppercase tracking-[0.16em]'
              : 'block text-sm text-white/70 mb-1';
            const labelStyle: React.CSSProperties | undefined = isDesktop
              ? { color: TEXT_TERTIARY }
              : undefined;
            const inputCls = isDesktop
              ? `${inputClsDesktop} j2-copper-focus`
              : inputClsMobile;
            // The most recent promotion is what the belt was "tied on".
            const tiedOn = beltEntries[0]?.promoted_at ?? null;
            const tiedOnLabel = tiedOn ? formatPromotionMonth(tiedOn) : null;
            return (
          <form onSubmit={handleSubmit} className={`space-y-6 rounded-2xl ${isDesktop ? 'p-10' : 'p-6'}`} style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}>

            {/* Name */}
            <div>
              <label className={labelCls} style={labelStyle}>Name</label>
              <input
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
                className={inputCls}
              />
            </div>

            {/* The belt — the same flat belt as the desktop identity page.
                Tap it to open the promotion sheet; nothing here is part of
                the form's Save, the sheet commits on its own. */}
            <div>
              <label className={labelCls} style={labelStyle}>Belt</label>
              <FlatBelt
                rank={isBeltRank(form.belt_rank) ? form.belt_rank : 'white'}
                stripes={form.stripes}
                onClick={() => setSheetOpen(true)}
                title="Record a promotion"
              />
              <p style={{ fontSize: 11.5, color: TEXT_TERTIARY, marginTop: 10 }}>
                {tiedOnLabel ? `Tied on ${tiedOnLabel} · ` : ''}
                {isDesktop ? 'click' : 'tap'} the belt to record a promotion
              </p>

              {/* Promotions recorded so far — newest first, one row per
                  position, removable for corrections. */}
              <PromotionList
                entries={beltEntries}
                onRemove={id => { void handleRemovePromotion(id); }}
                removingId={removingPromotionId}
                style={{ marginTop: 12 }}
              />
            </div>

            {/* Home gym */}
            <div>
              <label className={labelCls} style={labelStyle}>Home Gym</label>
              {MAPS_KEY ? (
                <>
                  <input
                    ref={gymInputRef}
                    type="text"
                    autoCapitalize="words"
                    enterKeyHint="search"
                    defaultValue={form.home_gym_name}
                    placeholder="Search for your gym…"
                    className={inputCls}
                  />
                  {form.home_gym_address && (
                    <p className="mt-1.5 text-xs text-white/40">{form.home_gym_address}</p>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    autoCapitalize="words"
                    enterKeyHint="done"
                    value={form.home_gym_name}
                    onChange={e => setForm(prev => ({ ...prev, home_gym_name: e.target.value }))}
                    placeholder="Gym name"
                    className={inputCls}
                  />
                  {import.meta.env.DEV && (
                    <p className="mt-1 text-xs text-white/30">
                      Add <code className="text-white/40">VITE_GOOGLE_MAPS_API_KEY</code> to .env for address autocomplete.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Features — mobile only; desktop keeps this as a
                housekeeping toggle on the identity screen. */}
            {!isDesktop && (
            <div
              className={`rounded-xl ${isDesktop ? 'px-5 py-4 space-y-4' : 'px-4 py-3 space-y-3'}`}
              style={{ backgroundColor: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}` }}
            >
              <p
                className={isDesktop ? 'j2-label-copper' : 'text-xs text-white/30 uppercase tracking-wide'}
              >
                {isDesktop ? '◇ Features' : 'Features'}
              </p>
              <label className="flex items-center justify-between gap-4 cursor-pointer group">
                <div>
                  <p className={isDesktop ? 'text-[15px] text-white/85 font-medium' : 'text-sm text-white/80 font-medium'}>
                    Training Intentions
                  </p>
                  <p className={isDesktop ? 'text-[13px] text-white/40 mt-1' : 'text-xs text-white/35 mt-0.5'}>
                    Track weekly focus and journal your intentions
                  </p>
                </div>
                <div
                  onClick={() => setIntentionsEnabled(v => !v)}
                  className={`rounded-full relative transition-colors flex-shrink-0 ${isDesktop ? 'w-12 h-6' : 'w-10 h-5'}`}
                  style={{ backgroundColor: intentionsEnabled ? 'rgba(218,116,34,0.85)' : 'rgba(255,255,255,0.10)' }}
                >
                  <span
                    className={`absolute top-0.5 rounded-full bg-white transition-transform ${isDesktop ? 'w-5 h-5' : 'w-4 h-4'}`}
                    style={{
                      transform: intentionsEnabled
                        ? (isDesktop ? 'translateX(26px)' : 'translateX(22px)')
                        : 'translateX(2px)',
                    }}
                  />
                </div>
              </label>
            </div>
            )}

            {error && <p className="text-error text-sm">{error}</p>}

            {isDesktop ? (
              <button
                type="submit"
                disabled={saving}
                className="w-full text-white font-semibold rounded-xl transition-all touch-manipulation disabled:opacity-50 j2-press"
                style={{
                  height: 52,
                  backgroundColor: '#DA7422',
                  boxShadow: '0 2px 12px rgba(218,116,34,0.25)',
                  fontSize: 15,
                  marginTop: 8,
                }}
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold px-6 py-2.5 rounded-full transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            )}

          </form>
            );
          })()}
            </div>

            {/* Sidebar — mobile only. Desktop's identity screen already
                carries every one of these as a housekeeping row. */}
            {!isDesktop && (
            <div className="contents">

        {/* Class times & notifications */}
        <div
          className={`rounded-2xl ${isDesktop ? 'p-7' : 'mt-4 p-5'}`}
          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}
        >
          <button
            type="button"
            onClick={() => navigate('/profile/classes')}
            className="w-full flex items-center justify-between gap-3 touch-manipulation j2-press"
          >
            <div className="flex items-center gap-3 text-left">
              <Bell size={22} strokeWidth={1.5} style={{ color: 'rgba(196,145,95,0.85)', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold text-white">Class times &amp; notifications</p>
                <p className="text-xs text-white/40">
                  Three quiet pings around each class — pre, after, drive home.
                </p>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={2} style={{ color: TEXT_HINT, flexShrink: 0 }} />
          </button>
        </div>

        {/* Collection section */}
        <div
          className={`rounded-2xl ${isDesktop ? 'p-7' : 'mt-4 p-5'}`}
          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}
        >
          <button
            type="button"
            onClick={() => navigate('/profile/collection')}
            className="w-full flex items-center justify-between gap-3 touch-manipulation j2-press"
          >
            <div className="flex items-center gap-3 text-left">
              <Award size={22} strokeWidth={1.5} style={{ color: 'rgba(196,145,95,0.85)', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold text-white">Collection</p>
                <p className="text-xs text-white/40">
                  Keepsake stamps struck for the moments you marked.
                </p>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={2} style={{ color: TEXT_HINT, flexShrink: 0 }} />
          </button>
        </div>

        {/* Appearance — prism skin */}
        <div
          className={`rounded-2xl ${isDesktop ? 'p-7' : 'mt-4 p-5'}`}
          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}
        >
          <PrismSkinToggle />
        </div>

        {/* Move Library section */}
        <div
          className={`rounded-2xl ${isDesktop ? 'p-7' : 'mt-4 p-5'}`}
          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}
        >
          <button
            type="button"
            onClick={() => navigate('/library', { state: PROFILE_ORIGIN })}
            className="w-full flex items-center justify-between gap-3 touch-manipulation j2-press"
          >
            <div className="flex items-center gap-3 text-left">
              <Library size={22} strokeWidth={1.5} style={{ color: 'rgba(196,145,95,0.85)', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold text-white">Move Library</p>
                <p className="text-xs text-white/40">
                  Personal video clips of your techniques.
                </p>
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={2} style={{ color: TEXT_HINT, flexShrink: 0 }} />
          </button>

          {storage?.supported && storage.quotaBytes > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: TEXT_HINT }}>
                  Local storage
                </span>
                <span className="text-xs" style={{ color: TEXT_TERTIARY }}>
                  {formatBytes(storage.usageBytes)} of {formatBytes(storage.quotaBytes)}
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, storage.usagePercent)}%`,
                    backgroundColor: storage.usagePercent > 80 ? 'rgba(218,90,70,0.75)' : 'rgba(196,145,95,0.70)',
                    transition: 'width 600ms ease-out',
                  }}
                />
              </div>
              {storage.usagePercent > 80 && (
                <p className="text-[10px] mt-1.5" style={{ color: 'rgba(218,180,60,0.85)' }}>
                  Storage is filling up. Consider removing older clips.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Import section */}
        <div
          className={`rounded-2xl ${isDesktop ? 'p-7' : 'mt-4 p-5'}`}
          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}
        >
          {isDesktop ? (
            <p className="j2-label-copper" style={{ marginBottom: 10 }}>◇ Import Training History</p>
          ) : (
            <p className="text-sm font-semibold text-white mb-1">Import Training History</p>
          )}
          <p className={isDesktop ? 'text-[13px] text-white/45 mb-5 leading-relaxed' : 'text-xs text-white/40 mb-4'}>
            Upload a CSV spreadsheet to import your historical sessions.
            Duplicates are flagged so you can review before committing.
          </p>
          <button
            onClick={async () => {
              try {
                const data = await api.get<{ sessions: { date: string }[] }>('/api/sessions');
                setExistingDates(new Set(data.sessions.map((s: { date: string }) => s.date)));
              } catch {
                setExistingDates(new Set());
              }
              setImportOpen(true);
            }}
            className={
              isDesktop
                ? 'text-[14px] font-semibold rounded-xl transition-all w-full'
                : 'text-sm font-medium px-4 py-2 rounded-lg transition-colors'
            }
            style={
              isDesktop
                ? { height: 48, backgroundColor: 'rgba(196,145,95,0.12)', color: COPPER, border: `1px solid rgba(196,145,95,0.30)` }
                : { backgroundColor: 'rgba(196,145,95,0.15)', color: 'rgba(196,145,95,0.85)' }
            }
            onMouseEnter={isDesktop ? (e => { e.currentTarget.style.backgroundColor = 'rgba(196,145,95,0.20)'; e.currentTarget.style.borderColor = 'rgba(196,145,95,0.55)'; }) : undefined}
            onMouseLeave={isDesktop ? (e => { e.currentTarget.style.backgroundColor = 'rgba(196,145,95,0.12)'; e.currentTarget.style.borderColor = 'rgba(196,145,95,0.30)'; }) : undefined}
          >
            ↑ Upload CSV
          </button>
        </div>

        {/* Export section */}
        <div
          className={`rounded-2xl ${isDesktop ? 'p-7' : 'mt-4 p-5'}`}
          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}
        >
          {isDesktop ? (
            <p className="j2-label-copper" style={{ marginBottom: 10 }}>◇ Export Your Data</p>
          ) : (
            <p className="text-sm font-semibold text-white mb-1">Export Your Data</p>
          )}
          <p className={isDesktop ? 'text-[13px] text-white/45 mb-5 leading-relaxed' : 'text-xs text-white/40 mb-4'}>
            Download your training data as CSV files you can open in any spreadsheet app.
          </p>
          <div className={`flex ${isDesktop ? 'flex-col gap-2.5' : 'flex-wrap gap-3'}`}>
            <button
              onClick={async () => {
                setExporting(true);
                try {
                  const data = await api.get<{ sessions: SessionSummary[] }>('/api/sessions');
                  await exportSessionsCsv(data.sessions ?? []);
                  toast({ variant: 'success', title: 'Sessions exported.' });
                } catch {
                  toast({ variant: 'destructive', title: 'Export failed.', description: 'Please try again.' });
                } finally {
                  setExporting(false);
                }
              }}
              disabled={exporting}
              className={
                isDesktop
                  ? 'text-[14px] font-semibold rounded-xl transition-all w-full disabled:opacity-50'
                  : 'text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50'
              }
              style={
                isDesktop
                  ? { height: 48, backgroundColor: 'rgba(196,145,95,0.12)', color: COPPER, border: `1px solid rgba(196,145,95,0.30)` }
                  : { backgroundColor: 'rgba(196,145,95,0.15)', color: 'rgba(196,145,95,0.85)' }
              }
              onMouseEnter={isDesktop ? (e => { e.currentTarget.style.backgroundColor = 'rgba(196,145,95,0.20)'; e.currentTarget.style.borderColor = 'rgba(196,145,95,0.55)'; }) : undefined}
              onMouseLeave={isDesktop ? (e => { e.currentTarget.style.backgroundColor = 'rgba(196,145,95,0.12)'; e.currentTarget.style.borderColor = 'rgba(196,145,95,0.30)'; }) : undefined}
            >
              ↓ Export Sessions
            </button>
            {intentionsEnabled && (
              <button
                onClick={async () => {
                  setExporting(true);
                  try {
                    const data = await api.get<{ intentions: Intention[] }>('/api/intentions');
                    await exportIntentionsCsv(data.intentions ?? []);
                    toast({ variant: 'success', title: 'Intentions exported.' });
                  } catch {
                    toast({ variant: 'destructive', title: 'Export failed.', description: 'Please try again.' });
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
                className={
                  isDesktop
                    ? 'text-[14px] font-semibold rounded-xl transition-all w-full disabled:opacity-50'
                    : 'text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50'
                }
                style={
                  isDesktop
                    ? { height: 48, backgroundColor: 'rgba(196,145,95,0.12)', color: COPPER, border: `1px solid rgba(196,145,95,0.30)` }
                    : { backgroundColor: 'rgba(196,145,95,0.15)', color: 'rgba(196,145,95,0.85)' }
                }
                onMouseEnter={isDesktop ? (e => { e.currentTarget.style.backgroundColor = 'rgba(196,145,95,0.20)'; e.currentTarget.style.borderColor = 'rgba(196,145,95,0.55)'; }) : undefined}
                onMouseLeave={isDesktop ? (e => { e.currentTarget.style.backgroundColor = 'rgba(196,145,95,0.12)'; e.currentTarget.style.borderColor = 'rgba(196,145,95,0.30)'; }) : undefined}
              >
                ↓ Export Intentions
              </button>
            )}
          </div>
        </div>

            </div>
            )}
          </div>
        </PageContent>

        {/* ── Admin + support actions — mobile only ─────────────────────
            Desktop carries these as the "Account" housekeeping group on the
            identity screen. Admin Dashboard only renders for users with
            is_admin = true (mig 023). Report a Problem is visible for any
            authed user; the modal silently auto-attaches debug context so
            the admin gets full triage info from a 2-field form. */}
        {!isDesktop && (
          <>
            <div className="mt-6 flex flex-col items-center" style={{ gap: 12 }}>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="w-full rounded-xl transition-all touch-manipulation j2-press"
                  style={{
                    height: 48,
                    fontSize: 14,
                    fontWeight: 600,
                    color: COPPER,
                    backgroundColor: 'rgba(196,145,95,0.12)',
                    border: '1px solid rgba(196,145,95,0.30)',
                  }}
                >
                  ◇ Admin Dashboard
                </button>
              )}

              <button
                onClick={() => setReportOpen(true)}
                className="w-full text-sm rounded-xl transition-colors touch-manipulation j2-press"
                style={{
                  height: 44,
                  color: TEXT_SECONDARY,
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                Report a problem
              </button>
            </div>

            <div className="flex justify-center mt-6">
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="w-full text-sm font-semibold rounded-xl transition-all touch-manipulation j2-press"
                style={{
                  height: 48,
                  color: STATUS_ERROR,
                  backgroundColor: STATUS_ERROR_BG,
                  border: `1px solid ${STATUS_ERROR_BORDER}`,
                }}
              >
                Log out
              </button>
            </div>
          </>
        )}
      </main>

      {importOpen && (
        <CsvImportModal
          existingDates={existingDates}
          onClose={() => setImportOpen(false)}
          onImported={() => {}}
        />
      )}

      {reportOpen && (
        <ReportProblemModal onClose={() => setReportOpen(false)} />
      )}

      <PromotionSheet
        open={sheetOpen}
        rank={isBeltRank(form.belt_rank) ? form.belt_rank : 'white'}
        stripes={form.stripes}
        academy={form.home_gym_name || null}
        saving={beltSaving}
        onClose={() => setSheetOpen(false)}
        onCommit={next => { setSheetOpen(false); setReveal(next); void handleRecordPromotion(next); }}
      />
      <PromotionRevealSheet
        open={reveal !== null}
        rank={reveal && isBeltRank(reveal.rank) ? reveal.rank : 'white'}
        stripes={reveal?.stripes ?? 0}
        promotedAt={reveal?.promotedAt ?? null}
        academy={form.home_gym_name || null}
        onClose={() => setReveal(null)}
      />
    </div>
  );
}
