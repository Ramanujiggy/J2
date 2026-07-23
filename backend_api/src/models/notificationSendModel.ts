// Notification send ledger — one row per push attempt.
//
// Written by the scheduler after every sendPush() call (success or fail).
// Reads come from the scheduler-health view and any future "recent activity"
// endpoint. Inserts must never throw to the caller — a logging failure is
// not worth dropping a real ping on the floor.

import { query } from '../config/db.js';
import type { NotificationKind } from './pushSubscriptionModel.js';

export type SendStatus = 'sent' | 'gone' | 'client_error' | 'server_error' | 'no_vapid';

export interface RecordSendInput {
    user_id: string;
    subscription_id: string | null;
    category: NotificationKind;
    status: SendStatus;
    status_code?: number | null;
    error_message?: string | null;
    endpoint_host?: string | null;
    schedule_id?: string | null;
}

export async function recordSend(input: RecordSendInput): Promise<void> {
    try {
        await query(
            `INSERT INTO notification_sends
               (user_id, subscription_id, category, status, status_code, error_message, endpoint_host, schedule_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                input.user_id,
                input.subscription_id,
                input.category,
                input.status,
                input.status_code ?? null,
                // Cap error_message at 1000 chars — push provider error bodies can be HTML pages
                input.error_message ? input.error_message.slice(0, 1000) : null,
                input.endpoint_host ?? null,
                input.schedule_id ?? null,
            ],
        );
    } catch (err) {
        // Never let a ledger failure bubble up; just log it. The actual push
        // already happened (or didn't) — the caller's job is done.
        console.error('⚠️  notification_sends insert failed:', err);
    }
}

export interface RecentSendsRow {
    status: SendStatus;
    category: NotificationKind;
    count: string;
}

// 24h roll-up — used by the health endpoint / dashboard.
export async function recentSendsSummary(): Promise<RecentSendsRow[]> {
    const result = await query(
        `SELECT status, category, COUNT(*)::text AS count
           FROM notification_sends
          WHERE sent_at > NOW() - INTERVAL '24 hours'
          GROUP BY status, category
          ORDER BY status, category`,
    );
    return result.rows as RecentSendsRow[];
}
