// supportCaseModel — backs the admin dashboard's case queue + the user-side
// "Report a Problem" flow. Schema lives in migration 023.
//
// Auto-context fields (page_url, user_agent, app_version) are captured by
// the client at submit time so the user only types subject + description
// while the admin gets full debug context.

import { query } from '../config/db.js';

export type CaseStatus   = 'open' | 'in_progress' | 'closed';
export type CaseSeverity = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportCase {
    id: string;
    user_id: string;
    status: CaseStatus;
    severity: CaseSeverity;
    subject: string;
    description: string;
    page_url: string | null;
    user_agent: string | null;
    app_version: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
}

// Joined with user email — what the admin queue actually wants to display.
export interface SupportCaseWithUser extends SupportCase {
    user_email: string;
    user_name: string | null;
}

export interface CreateCaseInput {
    user_id: string;
    subject: string;
    description: string;
    page_url?: string | null;
    user_agent?: string | null;
    app_version?: string | null;
}

export const createCase = async (data: CreateCaseInput): Promise<SupportCase> => {
    const result = await query(
        `INSERT INTO support_cases (user_id, subject, description, page_url, user_agent, app_version)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [data.user_id, data.subject, data.description, data.page_url ?? null, data.user_agent ?? null, data.app_version ?? null]
    );
    return result.rows[0]!;
};

// Admin-side list. Optional status filter; ordered newest-first.
export const listCases = async (status?: CaseStatus): Promise<SupportCaseWithUser[]> => {
    const params: unknown[] = [];
    let where = '';
    if (status) {
        params.push(status);
        where = `WHERE c.status = $1`;
    }
    const result = await query(
        `SELECT c.*, u.email AS user_email, u.name AS user_name
         FROM support_cases c
         JOIN users u ON u.id = c.user_id
         ${where}
         ORDER BY c.created_at DESC`,
        params
    );
    return result.rows as SupportCaseWithUser[];
};

export interface UpdateCaseInput {
    status?: CaseStatus;
    severity?: CaseSeverity;
    admin_notes?: string | null;
}

export const updateCase = async (id: string, data: UpdateCaseInput): Promise<SupportCase | null> => {
    // Build dynamic SET clause from non-undefined fields.
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (data.status !== undefined) {
        sets.push(`status = $${i++}`);
        params.push(data.status);
        // Closing → stamp closed_at; reopening → clear it.
        sets.push(`closed_at = $${i++}`);
        params.push(data.status === 'closed' ? new Date().toISOString() : null);
    }
    if (data.severity !== undefined) {
        sets.push(`severity = $${i++}`);
        params.push(data.severity);
    }
    if (data.admin_notes !== undefined) {
        sets.push(`admin_notes = $${i++}`);
        params.push(data.admin_notes);
    }
    if (sets.length === 0) {
        // Nothing to update — return the existing row.
        const r = await query('SELECT * FROM support_cases WHERE id = $1', [id]);
        return (r.rows[0] as SupportCase | undefined) ?? null;
    }
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const result = await query(
        `UPDATE support_cases SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        params
    );
    return result.rows[0] ?? null;
};
