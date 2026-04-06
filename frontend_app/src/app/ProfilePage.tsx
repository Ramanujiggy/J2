import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

import { api } from '../lib/api.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { CARD_BG, COPPER_BORDER, CARD_SHADOW, PALE_YELLOW } from '../lib/theme.ts';
import CsvImportModal from '../components/CsvImportModal.tsx';
import PageContent from '../components/PageContent.tsx';
import { type BeltRank } from '../components/BeltBar.tsx';
import { useProfile } from '../context/ProfileContext.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.tsx';
import { toast } from '../hooks/use-toast.ts';

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

const inputCls =
  'w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange';

export default function ProfilePage() {
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

  // Load existing profile
  useEffect(() => {
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

      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-lg font-semibold text-white mb-6">Your Profile</h2>

        <PageContent ready={!loading}>
          <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl p-6" style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}>

            {/* Name */}
            <div>
              <label className="block text-sm text-white/70 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
                className={inputCls}
              />
            </div>

            {/* Belt rank */}
            <div>
              <label className="block text-sm text-white/70 mb-1">Belt Rank</label>
              <Select
                value={form.belt_rank ?? ''}
                onValueChange={val => setForm(prev => ({
                  ...prev,
                  belt_rank: (val as BeltRank) || null,
                  stripes: val ? prev.stripes : 0,
                }))}
              >
                <SelectTrigger className="w-full bg-white/10 border-white/10 text-white focus:ring-brand-orange">
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
                <label className="block text-sm text-white/70 mb-2">Stripes</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, stripes: n }))}
                      className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                        form.stripes === n
                          ? 'bg-brand-orange text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Home gym */}
            <div>
              <label className="block text-sm text-white/70 mb-1">Home Gym</label>
              {MAPS_KEY ? (
                <>
                  <input
                    ref={gymInputRef}
                    type="text"
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
                    value={form.home_gym_name}
                    onChange={e => setForm(prev => ({ ...prev, home_gym_name: e.target.value }))}
                    placeholder="Gym name"
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-white/30">
                    Add <code className="text-white/40">VITE_GOOGLE_MAPS_API_KEY</code> to .env for address autocomplete.
                  </p>
                </>
              )}
            </div>

            {/* Features */}
            <div
              className="rounded-xl px-4 py-3 space-y-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-xs text-white/30 uppercase tracking-wide">Features</p>
              <label className="flex items-center justify-between gap-4 cursor-pointer group">
                <div>
                  <p className="text-sm text-white/80 font-medium">Training Intentions</p>
                  <p className="text-xs text-white/35 mt-0.5">Track weekly focus and journal your intentions</p>
                </div>
                <div
                  onClick={() => setIntentionsEnabled(v => !v)}
                  className="w-10 h-5 rounded-full relative transition-colors flex-shrink-0"
                  style={{ backgroundColor: intentionsEnabled ? 'rgba(218,116,34,0.8)' : 'rgba(255,255,255,0.1)' }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: intentionsEnabled ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </div>
              </label>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold px-6 py-2.5 rounded-full transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>

          </form>
        </PageContent>

        {/* Import section */}
        <div
          className="mt-4 rounded-2xl p-5"
          style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}` }}
        >
          <p className="text-sm font-semibold text-white mb-1">Import Training History</p>
          <p className="text-xs text-white/40 mb-4">
            Upload a CSV spreadsheet to import your historical sessions.
            Duplicates are flagged so you can review before committing.
          </p>
          <button
            onClick={async () => {
              // Load existing session dates for duplicate detection
              try {
                const data = await api.get<{ sessions: { date: string }[] }>('/api/sessions');
                setExistingDates(new Set(data.sessions.map((s: { date: string }) => s.date)));
              } catch {
                setExistingDates(new Set());
              }
              setImportOpen(true);
            }}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(196,145,95,0.15)', color: 'rgba(196,145,95,0.85)' }}
          >
            ↑ Upload CSV
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-sm transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >
            Log out
          </button>
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
