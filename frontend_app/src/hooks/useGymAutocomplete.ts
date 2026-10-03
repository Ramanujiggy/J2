// useGymAutocomplete — Google Places autocomplete on a gym input.
//
// Shared by the mobile profile form and the desktop "Your details" sheet.
// Attaches once the input exists and `enabled` is true; `onPlace` receives
// the chosen establishment. Without VITE_GOOGLE_MAPS_API_KEY it does
// nothing and `hasMaps` is false, so the caller can fall back to a plain
// text field.

import { useEffect, useRef, type RefObject } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export interface GymPlace {
  home_gym_name: string | null;
  home_gym_address: string;
  home_gym_place_id: string;
}

export function useGymAutocomplete(
  inputRef: RefObject<HTMLInputElement | null>,
  enabled: boolean,
  onPlace: (place: GymPlace) => void,
): { hasMaps: boolean } {
  // Keep the latest callback without re-attaching the widget.
  const onPlaceRef = useRef(onPlace);
  useEffect(() => { onPlaceRef.current = onPlace; }, [onPlace]);

  useEffect(() => {
    if (!MAPS_KEY || !enabled || !inputRef.current) return;
    let cancelled = false;
    let listener: google.maps.MapsEventListener | null = null;

    (async () => {
      setOptions({ key: MAPS_KEY, v: 'weekly' });
      const { Autocomplete } = await importLibrary('places') as google.maps.PlacesLibrary;
      if (cancelled || !inputRef.current) return;
      const ac = new Autocomplete(inputRef.current, {
        types: ['establishment'],
        fields: ['name', 'formatted_address', 'place_id'],
      });
      listener = ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        onPlaceRef.current({
          home_gym_name: place.name ?? null,
          home_gym_address: place.formatted_address ?? '',
          home_gym_place_id: place.place_id ?? '',
        });
      });
    })();

    return () => { cancelled = true; listener?.remove(); };
  }, [inputRef, enabled]);

  return { hasMaps: !!MAPS_KEY };
}
