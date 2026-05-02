// Thin wrapper around the `web-push` library. Reads VAPID config from env
// LAZILY (inside the functions, not at module load) so we don't capture
// empty strings on machines where dotenv.config() runs after this module
// is imported.

import webPush from 'web-push';

let configured = false;

function readVapidEnv() {
    return {
        publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
        privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
        subject: process.env.VAPID_SUBJECT ?? '',
    };
}

export function configureWebPush(): boolean {
    if (configured) return true;
    const { publicKey, privateKey, subject } = readVapidEnv();
    if (!publicKey || !privateKey || !subject) {
        console.warn('⚠️  Web Push: VAPID env vars missing — notifications disabled.');
        return false;
    }
    try {
        webPush.setVapidDetails(subject, publicKey, privateKey);
        configured = true;
        return true;
    } catch (err) {
        console.error('❌ Web Push: failed to set VAPID details:', err);
        return false;
    }
}

export function getVapidPublicKey(): string | null {
    return readVapidEnv().publicKey || null;
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
