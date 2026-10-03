// Navigation-origin helpers.
//
// `/library` and `/techniques/:id` are top-level Journal surfaces, but the
// Profile page also links into them ("Move library"). When entered from
// Profile they should behave like a Profile sub-menu — back chevron to
// /profile, Profile tab highlighted — instead of dropping the user into the
// Journal section with no way back. The origin travels in router
// `location.state` so URLs stay stable and deep links are unaffected.

export const PROFILE_ORIGIN = { from: 'profile' } as const;

export function isFromProfile(state: unknown): boolean {
  return typeof state === 'object' && state !== null
    && (state as { from?: unknown }).from === 'profile';
}
