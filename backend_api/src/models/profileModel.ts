import { query } from '../config/db.js';

export interface Profile {
    name: string | null;
    belt_rank: string | null;
    stripes: number;
    home_gym_name: string | null;
    home_gym_address: string | null;
    home_gym_place_id: string | null;
    intentions_enabled: boolean;
}

export const getProfile = async (userId: string): Promise<Profile | null> => {
    const result = await query(
        `SELECT name, belt_rank, stripes, home_gym_name, home_gym_address, home_gym_place_id, intentions_enabled
         FROM users WHERE id = $1`,
        [userId]
    );
    return result.rows[0] ?? null;
};

export const updateProfile = async (userId: string, data: Profile): Promise<Profile> => {
    const result = await query(
        `UPDATE users
         SET name = $1, belt_rank = $2, stripes = $3,
             home_gym_name = $4, home_gym_address = $5, home_gym_place_id = $6,
             intentions_enabled = $7
         WHERE id = $8
         RETURNING name, belt_rank, stripes, home_gym_name, home_gym_address, home_gym_place_id, intentions_enabled`,
        [data.name, data.belt_rank, data.stripes, data.home_gym_name, data.home_gym_address, data.home_gym_place_id, data.intentions_enabled, userId]
    );
    return result.rows[0];
};
