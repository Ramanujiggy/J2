import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from '@googlemaps/js-api-loader';
import { api } from '../lib/api.ts';
import BeltBar, { type BeltRank } from '../components/BeltBar.tsx';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

const BELT_RANKS: { value: BeltRank; label: string; color: string }[] = [
  { value: 'white',  label: 'White',  color: '#C8C4BF' },
  { value: 'blue',   label: 'Blue',   color: '#1E4D8C' },
  { value: 'purple', label: 'Purple', color: '#6B2D8B' },
  { value: 'brown',  label: 'Brown',  color: '#7B4A2D' },
  { value: 'black',  label: 'Black',  color: '#2A2828' },
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
  } | null;
}

const inputCls =
  'w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange';

export default function ProfilePage() {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

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
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Initialise Google Places Autocomplete for the gym input
  const initAutocomplete = useCallback(async () => {
    if (!MAPS_KEY || !gymInputRef.current) return;

    const loader = new Loader({
      apiKey: MAPS_KEY,
      version: 'weekly',
      libraries: ['places'],
    });

    await loader.load();

    autocompleteRef.current = new google.maps.places.Autocomplete(gymInputRef.current, {
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
      await api.post('/api/profile', {
        name: form.name || null,
        belt_rank: form.belt_rank,
        stripes: form.stripes,
        home_gym_name: form.home_gym_name || null,
        home_gym_address: form.home_gym_address || null,
        home_gym_place_id: form.home_gym_place_id || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const btnBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer';

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">

      {/* Nav */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="w-fit">
          <h1 className="text-xl font-bold tracking-tight text-white">Journada</h1>
          <BeltBar rank={form.belt_rank} stripes={form.stripes} />
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          ← Dashboard
        </button>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-10">
        <h2 className="text-lg font-semibold text-white mb-6">Your Profile</h2>

        {loading ? (
          <p className="text-white/40 text-sm">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">

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
              <label className="block text-sm text-white/70 mb-2">Belt Rank</label>
              <div className="flex gap-2 flex-wrap">
                {BELT_RANKS.map(({ value, label, color }) => {
                  const isActive = form.belt_rank === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, belt_rank: value }))}
                      className={`${btnBase} border-2 font-semibold`}
                      style={{
                        borderColor: color,
                        backgroundColor: isActive ? color : 'transparent',
                        color: isActive
                          ? value === 'white' ? '#1a1a1a' : '#ffffff'
                          : color,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
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

            {/* Belt preview */}
            {form.belt_rank && (
              <div>
                <label className="block text-sm text-white/70 mb-2">Belt Preview</label>
                <div className="w-48">
                  <BeltBar rank={form.belt_rank} stripes={form.stripes} />
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

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
              {saved && (
                <p className="text-brand-green text-sm">Profile saved!</p>
              )}
            </div>

          </form>
        )}
      </main>
    </div>
  );
}
