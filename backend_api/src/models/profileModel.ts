import { query } from '../config/db.js';

export interface Profile {
    name: string | null;
    belt_rank: string | null;
    stripes: number;
    home_gym_name: string | null;
    home_gym_address: string | null;
    home_gym_place_id: string | null;
    intentions_enabled: boolean;
    // mig 022 — NULL = needs to run the guided onboarding flow
    onboarding_completed_at: string | null;
    // mig 023 — admin flag. Granted manually via direct UPDATE; not editable via API.
    is_admin: boolean;
}

export const getProfile = async (userId: string): Promise<Profile | null> => {
    const result = await query(
        `SELECT name, belt_rank, stripes, home_gym_name, home_gym_address, home_gym_place_id, intentions_enabled, onboarding_completed_at, is_admin
         FROM users WHERE id = $1`,
        [userId]
    );
    return result.rows[0] ?? null;
};

// is_admin and onboarding_completed_at are NOT user-editable via this endpoint —
// is_admin is granted via direct DB UPDATE; onboarding_completed_at is set by
// its dedicated POST endpoint. Both are RETURNING'd so the response stays consistent.
export const updateProfile = async (userId: string, data: Omit<Profile, 'onboarding_completed_at' | 'is_admin'>): Promise<Profile> => {
    const result = await query(
        `UPDATE users
         SET name = $1, belt_rank = $2, stripes = $3,
             home_gym_name = $4, home_gym_address = $5, home_gym_place_id = $6,
             intentions_enabled = $7
         WHERE id = $8
         RETURNING name, belt_rank, stripes, home_gym_name, home_gym_address, home_gym_place_id, intentions_enabled, onboarding_completed_at, is_admin`,
        [data.name, data.belt_rank, data.stripes, data.home_gym_name, data.home_gym_address, data.home_gym_place_id, data.intentions_enabled, userId]
    );
    return result.rows[0];
};
