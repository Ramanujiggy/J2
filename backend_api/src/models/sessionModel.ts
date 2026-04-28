import { query } from '../config/db.js';
import pool from '../config/db.js';

/** Map of pillar value → weight in [0, 1]. Weights sum to ~1.0 (±0.01). */
export type PillarDistribution = Partial<Record<'standup' | 'passing' | 'pins' | 'submissions' | 'guard', number>>;

export interface Session {
    id?: string;
    user_id: string;
    date: string;
    duration: number;
    notes?: string;
    gi_nogi: 'gi' | 'no_gi';
    intensity: number;
    session_type: 'drilling' | 'class' | 'competition_training';
    tags: string[];
    heading?: string | null;
    polarity?: 'offense' | 'defense' | 'neutral' | null;
    sub_skill_tag?: string | null;
    script_source?: 'directed' | 'organic' | null;
    resonance?: number | null;
    user_tag_ids?: string[] | null;
    canonical_position_ids?: string[] | null;  // migration 012 — shared library refs
    pillar_distribution?: PillarDistribution | null;
    // migration 013 — input telemetry. NULL on rows that predate the chip flow.
    had_primary?: boolean | null;
    had_deep_work?: boolean | null;
    selection_count?: number | null;
    // migration 014 — per-pillar deep_work set so the post-save Prism shape can
    // be reconstructed with halo rings on re-open. NULL on pre-014 rows.
    deep_work_pillars?: string[] | null;
    // migration 015 — constraint linkage for CLA sessions. NULL on non-CLA rows.
    canonical_constraint_ids?: string[] | null;
    user_constraint_ids?: string[] | null;
    created_at?: Date;
}

export const createSession = async (
    userId: string,
    date: string,
    duration: number,
    notes: string,
    gi_nogi: 'gi' | 'no_gi',
    intensity: number,
    session_type: 'drilling' | 'class' | 'competition_training',
    tags: string[],
    heading: string | null,
    polarity: string | null,
    sub_skill_tag: string | null,
    script_source: string | null,
    resonance: number | null,
    user_tag_ids: string[] | null,
    pillar_distribution: PillarDistribution | null,
    canonical_position_ids: string[] | null,
    had_primary: boolean | null,
    had_deep_work: boolean | null,
    selection_count: number | null,
    deep_work_pillars: string[] | null,
    canonical_constraint_ids: string[] | null,
    user_constraint_ids: string[] | null,
): Promise<Session & { session_count: number }> => {
    const result = await query(
        `WITH new_session AS (
           INSERT INTO training_sessions
           (user_id, date, duration, notes, gi_nogi, intensity, session_type, tags,
            heading, polarity, sub_skill_tag, script_source, resonance, user_tag_ids, pillar_distribution,
            canonical_position_ids, had_primary, had_deep_work, selection_count, deep_work_pillars,
            canonical_constraint_ids, user_constraint_ids)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
           RETURNING *
         )
         SELECT ns.*, (SELECT COUNT(*)::int FROM training_sessions WHERE user_id = $1) AS session_count
         FROM new_session ns`,
        [userId, date, duration, notes || null, gi_nogi, intensity, session_type, tags,
         heading, polarity, sub_skill_tag, script_source, resonance, user_tag_ids, pillar_distribution,
         canonical_position_ids, had_primary, had_deep_work, selection_count, deep_work_pillars,
         canonical_constraint_ids, user_constraint_ids],
    );
    return result.rows[0];
};

export const getSessionsByUser = async (userId: string, from?: string, to?: string): Promise<Session[]> => {
    const params: unknown[] = [userId];
    let whereExtra = '';
    if (from) { params.push(from); whereExtra += ` AND date >= $${params.length}`; }
    if (to)   { params.push(to);   whereExtra += ` AND date <= $${params.length}`; }
    const result = await query(
        `SELECT * FROM training_sessions WHERE user_id = $1${whereExtra} ORDER BY date DESC`,
        params,
    );
    return result.rows;
};

export interface SessionFilter {
    from?: string;
    to?: string;
    q?: string;
    gi_nogi?: 'gi' | 'no_gi';
    session_type?: string;
    heading?: string;
    polarity?: string;
    intensity_min?: number;
    intensity_max?: number;
    user_tag_id?: string;
    limit?: number;
    offset?: number;
}

export const searchSessions = async (
    userId: string,
    filters: SessionFilter,
): Promise<{ sessions: Session[]; total: number }> => {
    const params: unknown[] = [userId];
    const conditions: string[] = ['user_id = $1'];

    if (filters.from)         { params.push(filters.from);         conditions.push(`date >= $${params.length}`); }
    if (filters.to)           { params.push(filters.to);           conditions.push(`date <= $${params.length}`); }
    if (filters.gi_nogi)      { params.push(filters.gi_nogi);      conditions.push(`gi_nogi = $${params.length}`); }
    if (filters.session_type) { params.push(filters.session_type); conditions.push(`session_type = $${params.length}`); }
    if (filters.heading)      { params.push(filters.heading);      conditions.push(`heading = $${params.length}`); }
    if (filters.polarity)     { params.push(filters.polarity);     conditions.push(`polarity = $${params.length}`); }
    if (filters.intensity_min != null) { params.push(filters.intensity_min); conditions.push(`intensity >= $${params.length}`); }
    if (filters.intensity_max != null) { params.push(filters.intensity_max); conditions.push(`intensity <= $${params.length}`); }
    if (filters.user_tag_id) { params.push(filters.user_tag_id); conditions.push(`$${params.length}::uuid = ANY(user_tag_ids)`); }
    if (filters.q) {
        params.push(`%${filters.q}%`);
        const idx = params.length;
        conditions.push(`(notes ILIKE $${idx} OR sub_skill_tag ILIKE $${idx} OR heading ILIKE $${idx})`);
    }

    const where = conditions.join(' AND ');

    const countResult = await query(
        `SELECT COUNT(*)::int AS total FROM training_sessions WHERE ${where}`,
        params,
    );
    const total: number = countResult.rows[0].total;

    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    params.push(limit, offset);

    const result = await query(
        `SELECT * FROM training_sessions WHERE ${where} ORDER BY date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
    );

    return { sessions: result.rows, total };
};

export const deleteSession = async (id: string, userId: string): Promise<boolean> => {
    const result = await query(
        'DELETE FROM training_sessions WHERE id = $1 AND user_id = $2',
        [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
};

export interface BulkSessionInput {
    date: string;
    duration: number;
    gi_nogi: 'gi' | 'no_gi';
    intensity: number;
    session_type: 'drilling' | 'class' | 'competition_training';
    tags: string[];
    notes: string;
    heading?: string | null;
    polarity?: string | null;
    sub_skill_tag?: string | null;
    script_source?: string | null;
    resonance?: number | null;
}

export const bulkInsertSessions = async (userId: string, sessions: BulkSessionInput[]): Promise<number> => {
    if (sessions.length === 0) return 0;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Build multi-row parameterized INSERT
        const valuePlaceholders: string[] = [];
        const flatParams: unknown[] = [];
        let paramIdx = 1;

        for (const s of sessions) {
            valuePlaceholders.push(
                `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
            );
            flatParams.push(
                userId, s.date, s.duration, s.notes || null, s.gi_nogi, s.intensity, s.session_type, s.tags,
                s.heading ?? null, s.polarity ?? null, s.sub_skill_tag ?? null, s.script_source ?? null, s.resonance ?? null,
            );
        }

        await client.query(
            `INSERT INTO training_sessions (user_id, date, duration, notes, gi_nogi, intensity, session_type, tags,
                                            heading, polarity, sub_skill_tag, script_source, resonance)
             VALUES ${valuePlaceholders.join(', ')}`,
            flatParams,
        );

        await client.query('COMMIT');
        return sessions.length;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const updateSession = async (
    id: string,
    userId: string,
    duration: number,
    gi_nogi: 'gi' | 'no_gi',
    intensity: number,
    session_type: 'drilling' | 'class' | 'competition_training',
    notes: string,
    tags: string[],
    heading: string | null,
    polarity: string | null,
    sub_skill_tag: string | null,
    script_source: string | null,
    resonance: number | null,
    user_tag_ids: string[] | null,
    pillar_distribution: PillarDistribution | null,
    canonical_position_ids: string[] | null,
    had_primary: boolean | null,
    had_deep_work: boolean | null,
    selection_count: number | null,
    deep_work_pillars: string[] | null,
    canonical_constraint_ids: string[] | null,
    user_constraint_ids: string[] | null,
): Promise<Session | null> => {
    const result = await query(
        `UPDATE training_sessions
         SET duration = $3, gi_nogi = $4, intensity = $5, session_type = $6, notes = $7, tags = $8,
             heading = $9, polarity = $10, sub_skill_tag = $11, script_source = $12, resonance = $13,
             user_tag_ids = $14, pillar_distribution = $15, canonical_position_ids = $16,
             had_primary = $17, had_deep_work = $18, selection_count = $19, deep_work_pillars = $20,
             canonical_constraint_ids = $21, user_constraint_ids = $22
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, userId, duration, gi_nogi, intensity, session_type, notes || null, tags,
         heading, polarity, sub_skill_tag, script_source, resonance, user_tag_ids, pillar_distribution,
         canonical_position_ids, had_primary, had_deep_work, selection_count, deep_work_pillars,
         canonical_constraint_ids, user_constraint_ids],
    );
    return result.rows[0] ?? null;
};
