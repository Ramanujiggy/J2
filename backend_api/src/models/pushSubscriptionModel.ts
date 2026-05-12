// Push subscriptions — Web Push subscription objects keyed by endpoint.
// One row per browser-device install. Per-category opt-in flags follow the
// Headspace pre-permission UX: user picks which kinds of pings they want
// before the OS dialog fires, can flip them off later without losing the
// subscription itself.

import { query } from '../config/db.js';

export interface PushSubscription {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent: string | null;
    pre_class: boolean;
    intention_check: boolean;
    drive_home_log: boolean;
    last_seen: string;
    created_at: string;
}

export type NotificationKind = 'pre_class' | 'intention_check' | 'drive_home_log';

export interface UpsertInput {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent: string | null;
}

// Idempotent insert keyed on the unique `endpoint` column. If the same
// browser re-subscribes, we reuse the row and reset last_seen.
export const upsertSubscription = async (input: UpsertInput): Promise<PushSubscription> => {
    const result = await query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE
           SET user_id    = EXCLUDED.user_id,
               p256dh     = EXCLUDED.p256dh,
               auth       = EXCLUDED.auth,
               user_agent = EXCLUDED.user_agent,
               last_seen  = NOW()
         RETURNING *`,
        [input.user_id, input.endpoint, input.p256dh, input.auth, input.user_agent],
    );
    return result.rows[0] as PushSubscription;
};

export const listSubscriptionsForUser = async (userId: string): Promise<PushSubscription[]> => {
    const result = await query(
        'SELECT * FROM push_subscriptions WHERE user_id = $1',
        [userId],
    );
    return result.rows as PushSubscription[];
};

// Used by the scheduler — only return subs that have opted in to the given kind.
export const listSubscriptionsForUserByKind = async (
    userId: string,
    kind: NotificationKind,
): Promise<PushSubscription[]> => {
    const column = kind; // safe: NotificationKind is a literal union, used directly as a column name below
    const result = await query(
        `SELECT * FROM push_subscriptions WHERE user_id = $1 AND ${column} = true`,
        [userId],
    );
    return result.rows as PushSubscription[];
};

export const deleteSubscriptionByEndpoint = async (endpoint: string): Promise<boolean> => {
    const result = await query(
        'DELETE FROM push_subscriptions WHERE endpoint = $1',
        [endpoint],
    );
    return (result.rowCount ?? 0) > 0;
};

export interface CategoryFlags {
    pre_class?: boolean;
    intention_check?: boolean;
    drive_home_log?: boolean;
}

// Apply per-category flags across ALL of a user's subscriptions (mobile + tablet
// behave as a single preference). Empty input is a no-op.
export const updateCategoryFlagsForUser = async (
    userId: string,
    flags: CategoryFlags,
): Promise<void> => {
    const sets: string[] = [];
    const params: unknown[] = [userId];
    if (flags.pre_class !== undefined)       { params.push(flags.pre_class);       sets.push(`pre_class       = $${params.length}`); }
    if (flags.intention_check !== undefined) { params.push(flags.intention_check); sets.push(`intention_check = $${params.length}`); }
    if (flags.drive_home_log !== undefined)  { params.push(flags.drive_home_log);  sets.push(`drive_home_log  = $${params.length}`); }
    if (sets.length === 0) return;
    await query(
        `UPDATE push_subscriptions SET ${sets.join(', ')} WHERE user_id = $1`,
        params,
    );
};
