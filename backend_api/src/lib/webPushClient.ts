// Thin wrapper around the `web-push` library. Loads VAPID config from env at
// boot and exposes a typed sendPush() that maps WebPushError 410/404 to a
// "subscription is dead" signal so the scheduler can clean up stale rows.

import webPush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? '';

let configured = false;

export function configureWebPush(): boolean {
    if (configured) return true;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
        console.warn('⚠️  Web Push: VAPID env vars missing — notifications disabled.');
        return false;
    }
    try {
        webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        configured = true;
        return true;
    } catch (err) {
        console.error('❌ Web Push: failed to set VAPID details:', err);
        return false;
    }
}

export function getVapidPublicKey(): string | null {
    return VAPID_PUBLIC_KEY || null;
}

export interface PushTarget {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

export interface PushSendResult {
    ok: boolean;
    /** Subscription is permanently invalid (410 Gone / 404 Not Found). Caller should delete the row. */
    expired: boolean;
    statusCode?: number;
    error?: string;
}

export async function sendPush(target: PushTarget, payload: object): Promise<PushSendResult> {
    if (!configured && !configureWebPush()) {
        return { ok: false, expired: false, error: 'Web Push not configured.' };
    }
    try {
        await webPush.sendNotification(
            { endpoint: target.endpoint, keys: target.keys },
            JSON.stringify(payload),
            { TTL: 60 * 5 }, // 5 min: a reminder a couple ticks late is still useful; older is noise.
        );
        return { ok: true, expired: false };
    } catch (err: unknown) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        const code = e.statusCode;
        const expired = code === 404 || code === 410;
        const result: PushSendResult = {
            ok: false,
            expired,
            error: e.body ?? e.message ?? 'Unknown push error.',
        };
        if (code !== undefined) result.statusCode = code;
        return result;
    }
}
