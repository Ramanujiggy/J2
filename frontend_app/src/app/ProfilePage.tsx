import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

import { api } from '../lib/api.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, SURFACE_2, SURFACE_2_BORDER, SURFACE_3, COPPER } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import CsvImportModal from '../components/CsvImportModal.tsx';
import { exportSessionsCsv, exportIntentionsCsv } from '../lib/csvExport.ts';
import type { SessionSummary, Intention } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';
import { type BeltRank } from '../components/BeltBar.tsx';
import { useProfile } from '../context/ProfileContext.tsx';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.tsx';
import { toast } from '../hooks/use-toast.ts';
import { getStorageEstimate, type StorageEstimate } from '../lib/videoStore.ts';
import { formatBytes } from '../lib/videoUtils.ts';
import { Library, ChevronRight } from 'lucide-react';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

const BELT_RANKS: { value: BeltRank; label: string }[] = [
  { value: 'white',  label: 'White'  },
  { value: 'blue',   label: 'Blue'   },
  { value: 'purple', label: 'Purple' },
  { value: 'brown',  label: 'Brown'  },
  { value: 'black',  label: 'Black'  },
];

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

const inputStyleDesktop: React.CSSProperties = {
  backgroundColor: SURFACE_3,
  border: '1px solid rgba(255,255,255,0.08)',
};

function focusCopper(el: HTMLInputElement) {
  el.style.borderColor = 'rgba(196,145,95,0.55)';
  el.style.backgroundColor = 'rgba(255,255,255,0.10)';
}
function blurCopper(el: HTMLInputElement) {
  el.style.borderColor = 'rgba(255,255,255,0.08)';
  el.style.backgroundColor = SURFACE_3;
}

export default function ProfilePage() {
  const isDesktop = useIsDesktop();
  const { refreshProfile } = useProfile();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const gymInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [form, setForm] = useState<ProfileData>({
    name: '',
    belt_rank: null,
    stripes: 0,
    home_gym_name: '',
    home_gym_address: '',
    home_gym_place_id: '',
  });
  const [intentionsEnabled, setIntentionsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
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
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useOnlineRefetch(fetchProfile);

  // Initialise Google Places Autocomplete for the gym input
  const initAutocomplete = useCallback(async () => {
    if (!MAPS_KEY || !gymInputRef.current) return;

    setOptions({ key: MAPS_KEY, v: 'weekly' });
    const { Autocomplete } = await importLibrary('places') as google.maps.PlacesLibrary;

    autocompleteRef.current = new Autocomplete(gymInputRef.current, {
      types: ['establishment'],
      fields: ['name', 'formatted_address', 'place_id'],
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current!.getPlace();
      setForm(prev => ({
        ...prev,
        home_gym_name: place.name ?? prev.home_gym_name,
        home_gym_address: place.formatted_address ?? '',
        home_gym_place_id: place.place_id ?? '',
      }));
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      initAutocomplete();
    }
  }, [loading, initAutocomplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.put('/api/profile', {
        name: form.name || null,
        belt_rank: form.belt_rank,
        stripes: form.stripes,
        home_gym_name: form.home_gym_name || null,
        home_gym_address: form.home_gym_address || null,
        home_gym_place_id: form.home_gym_place_id || null,
        intentions_enabled: intentionsEnabled,
      });
      refreshProfile();
      toast({ title: 'Profile saved!' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">

      <main className={`flex-1 ${isDesktop ? 'j2-page-container' : 'w-full mx-auto max-w-xl px-4 sm:px-6'}`} style={isDesktop ? { paddingTop: 48, paddingBottom: 48 } : { paddingTop: 24, paddingBottom: 24 }}>
        {/* Editorial header — desktop */}
        {isDesktop ? (
          <div className="mb-10">
            <p className="j2-label-copper" style={{ marginBottom: 12 }}>
              ◇ Your information
            </p>
            <h1
              className="j2-serif-display j2-heading-glow"
              style={{ fontSize: 84, lineHeight: 1, margin: 0, letterSpacing: '-0.01em' }}
            >
              Profile
            </h1>
            <p
              className="j2-serif-italic"
              style={{ marginTop: 18, fontSize: 20, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}
            >
              Identity, rank, and the data behind your journey.
            </p>
          </div>
        ) : (
          <h2 className="text-lg font-display font-semibold text-white mb-6">Your Profile</h2>
        )}

        <PageContent ready={!loading} loadingMessages={['Taping fingers...']}>
          <div className={isDesktop ? 'grid grid-cols-12 gap-8 items-start' : 'space-y-4'}>
            <div className={isDesktop ? 'col-span-7 space-y-4' : 'contents'}>
          {(() => {
            const labelCls = isDesktop
              ? 'block mb-2 text-[11px] font-bold uppercase tracking-[0.16em]'
              : 'block text-sm text-white/70 mb-1';
            const labelStyle: React.CSSProperties | undefined = isDesktop
              ? { color: 'rgba(255,255,255,0.40)' }
              : undefined;
            const inputCls = isDesktop ? inputClsDesktop : inputClsMobile;
            const inputStyle = isDesktop ? inputStyleDesktop : undefined;
            const inputFocusProps = isDesktop
              ? {
                  onFocus: (e: React.FocusEvent<HTMLInputElement>) => focusCopper(e.currentTarget),
                  onBlur:  (e: React.FocusEvent<HTMLInputElement>) => blurCopper(e.currentTarget),
                }
              : {};
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
                style={inputStyle}
                {...inputFocusProps}
              />
            </div>

            {/* Belt rank */}
            <div>
              <label className={labelCls} style={labelStyle}>Belt Rank</label>
              <Select
                value={form.belt_rank ?? ''}
                onValueChange={val => setForm(prev => ({
                  ...prev,
                  belt_rank: (val as BeltRank) || null,
                  stripes: val ? prev.stripes : 0,
                }))}
              >
                <SelectTrigger
                  className={
                    isDesktop
                      ? 'w-full text-[15px] text-white rounded-xl h-[52px] px-4'
                      : 'w-full bg-white/10 border-white/10 text-white focus:ring-brand-orange'
                  }
                  style={isDesktop ? inputStyleDesktop : undefined}
                >
                  <SelectValue placeholder="— Select belt rank —" />
                </SelectTrigger>
                <SelectContent>
                  {BELT_RANKS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stripes */}
            {form.belt_rank && (
              <div>
                <label className={labelCls} style={labelStyle}>Stripes</label>
                <div className={`flex ${isDesktop ? 'gap-3' : 'gap-2'}`}>
                  {[0, 1, 2, 3, 4].map(n => {
                    const active = form.stripes === n;
                    if (isDesktop) {
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, stripes: n }))}
                          className="rounded-xl text-[15px] font-semibold transition-all cursor-pointer flex-1"
                          style={{
                            height: 52,
                            backgroundColor: active ? 'rgba(218,116,34,0.18)' : SURFACE_3,
                            border: active ? `1px solid ${COPPER}` : '1px solid rgba(255,255,255,0.08)',
                            color: active ? COPPER : 'rgba(255,255,255,0.55)',
                            boxShadow: active ? `0 0 14px rgba(218,116,34,0.22)` : 'none',
                          }}
                        >
                          {n}
                        </button>
                      );
                    }
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, stripes: n }))}
                        className={`w-11 h-11 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-brand-orange text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                    style={inputStyle}
                    {...inputFocusProps}
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
                    style={inputStyle}
                    {...inputFocusProps}
                  />
                  <p className="mt-1 text-xs text-white/30">
                    Add <code className="text-white/40">VITE_GOOGLE_MAPS_API_KEY</code> to .env for address autocomplete.
                  </p>
                </>
              )}
            </div>

            {/* Features */}
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

            {error && <p className="text-red-400 text-sm">{error}</p>}

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

            {/* Sidebar column — Library, Import, Export */}
            <div className={isDesktop ? 'col-span-5 space-y-4' : 'contents'}>

        {/* Move Library section */}
        <div
          className={`rounded-2xl ${isDesktop ? 'p-7' : 'mt-4 p-5'}`}
          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}
        >
          <button
            type="button"
            onClick={() => navigate('/library')}
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
            <ChevronRight size={18} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.30)', flexShrink: 0 }} />
          </button>

          {storage?.supported && storage.quotaBytes > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.30)' }}>
                  Local storage
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
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
                  exportSessionsCsv(data.sessions ?? []);
                  toast({ title: 'Sessions exported!' });
                } catch {
                  toast({ title: 'Export failed. Please try again.' });
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
                    exportIntentionsCsv(data.intentions ?? []);
                    toast({ title: 'Intentions exported!' });
                  } catch {
                    toast({ title: 'Export failed. Please try again.' });
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
          </div>
        </PageContent>

        <div className={`flex justify-center ${isDesktop ? 'mt-12' : 'mt-8'}`}>
          {isDesktop ? (
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="text-sm font-semibold uppercase tracking-[0.14em] rounded-xl transition-all"
              style={{
                padding: '14px 32px',
                color: 'rgba(248,113,113,0.85)',
                backgroundColor: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.25)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.12)';
                e.currentTarget.style.borderColor = 'rgba(248,113,113,0.45)';
                e.currentTarget.style.color = 'rgba(248,113,113,1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.06)';
                e.currentTarget.style.borderColor = 'rgba(248,113,113,0.25)';
                e.currentTarget.style.color = 'rgba(248,113,113,0.85)';
              }}
            >
              Log out
            </button>
          ) : (
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="w-full text-sm font-semibold rounded-xl transition-all touch-manipulation j2-press"
              style={{
                height: 48,
                color: 'rgba(248,113,113,0.95)',
                backgroundColor: 'rgba(248,113,113,0.10)',
                border: '1px solid rgba(248,113,113,0.30)',
              }}
            >
              Log out
            </button>
          )}
        </div>
      </main>

      {importOpen && (
        <CsvImportModal
          existingDates={existingDates}
          onClose={() => setImportOpen(false)}
          onImported={() => {}}
        />
      )}
    </div>
  );
}
