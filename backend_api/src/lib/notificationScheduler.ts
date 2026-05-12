// Notification scheduler — single in-process cron tick (every minute) that
// converts UTC → user-local-timezone for every active class schedule and
// fires the three notifications (pre-class T-30, intention-check T+0, drive-
// home T+8) when "now in user-local" lands within the fire window.
//
// Ordering of concerns:
//   1. Read all active schedules joined with users.timezone (one DB hit).
//   2. For each schedule, compute the three target instants on today's local
//      day-of-week, in the user's tz, then convert back to UTC.
//   3. Compare against the current minute. We only fire when "this minute" ==
//      "the target minute" — so each ping fires once per occurrence.
//   4. A small in-memory dedup set keyed by (schedule_id, kind, fire_iso_min)
//      protects against double-fires within the same minute (e.g. if two
//      ticks land in the window because of clock skew).
//
// Restart resilience: dedup is in-memory. After a restart we may double-fire
// a ping that already shipped this minute — acceptable for v1. Promote to a
// Postgres `notification_sends` ledger if it ever becomes a problem.

import cron from 'node-cron';
import { DateTime } from 'luxon';
import {
    listAllActiveSchedulesWithTimezone,
    type ScheduleWithTimezone,
} from '../models/classScheduleModel.js';
import {
    listSubscriptionsForUserByKind,
    deleteSubscriptionByEndpoint,
    type NotificationKind,
} from '../models/pushSubscriptionModel.js';
import { getActiveIntention } from '../models/intentionModel.js';
import { recordSend, type SendStatus } from '../models/notificationSendModel.js';
import { sendPush, configureWebPush, type PushSendResult } from './webPushClient.js';

// Per-kind offset from start_time (in minutes). Pre-class fires before, the
// other two after the class's natural end (start + duration).
const PRE_CLASS_LEAD_MIN = 30;
const DRIVE_HOME_TRAIL_MIN = 8;

const dedup = new Set<string>();
const DEDUP_TTL_MS = 1000 * 60 * 60 * 24; // 24h — way more than enough

function pruneDedup() {
    // Cheap timestamp-prefix prune: keys are "yyyy-mm-ddThh:mm:..."; if today
    // shifted past one in the set, drop it.
    const today = DateTime.utc().toFormat('yyyy-LL-dd');
    for (const key of dedup) {
        if (!key.startsWith(today)) {
            // Either yesterday or earlier — drop.
            const day = key.slice(0, 10);
            if (day !== today) dedup.delete(key);
        }
    }
}

function dedupKey(scheduleId: string, kind: NotificationKind, fireUtcMinute: string): string {
    return `${fireUtcMinute}|${scheduleId}|${kind}`;
}

interface FireSpec {
    kind: NotificationKind;
    targetUtcMinute: string;  // "yyyy-LL-dd'T'HH:mm" (UTC)
}

// Compute the three fire instants for a schedule on the user's *current* local
// day-of-week. If today's day-of-week doesn't match the schedule's, returns [].
function computeFireSpecs(now: DateTime, schedule: ScheduleWithTimezone): FireSpec[] {
    const local = now.setZone(schedule.timezone);
    if (!local.isValid) return [];

    // Luxon weekday: 1=Mon … 7=Sun. Our DB stores 0=Sun … 6=Sat. Convert.
    const todayDow = local.weekday === 7 ? 0 : local.weekday;
    if (todayDow !== schedule.day_of_week) return [];

    // start_time is "HH:MM:SS" in user-local; build a local DateTime today.
    const [hh, mm] = schedule.start_time.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return [];
    const start = local.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });

    const preClass = start.minus({ minutes: PRE_CLASS_LEAD_MIN });
    const intentionCheck = start.plus({ minutes: schedule.duration_min });
    const driveHome = intentionCheck.plus({ minutes: DRIVE_HOME_TRAIL_MIN });

    return [
        { kind: 'pre_class',       targetUtcMinute: preClass.toUTC().toFormat("yyyy-LL-dd'T'HH:mm") },
        { kind: 'intention_check', targetUtcMinute: intentionCheck.toUTC().toFormat("yyyy-LL-dd'T'HH:mm") },
        { kind: 'drive_home_log',  targetUtcMinute: driveHome.toUTC().toFormat("yyyy-LL-dd'T'HH:mm") },
    ];
}

interface NotificationCopy {
    title: string;
    body: string;
    url: string;
}

async function buildPayload(
    kind: NotificationKind,
    schedule: ScheduleWithTimezone,
): Promise<NotificationCopy> {
    const className = schedule.name;
    if (kind === 'pre_class') {
        const todayLocal = DateTime.utc().setZone(schedule.timezone).toFormat('yyyy-LL-dd');
        const intention = await getActiveIntention(schedule.user_id, todayLocal).catch(() => null);
        const intentionLabel = intention?.intent_label ?? null;
        return {
            title: `${className} starts in ${PRE_CLASS_LEAD_MIN} minutes.`,
            body: intentionLabel
                ? `Carry your ${intentionLabel} focus with you.`
                : `What will you bring to the mat tonight?`,
            url: '/home',
        };
    }
    if (kind === 'intention_check') {
        return {
            title: `How did the round feel?`,
            body: `A quick mark on whether you trained your focus.`,
            url: `/quick-log?from=class&class=${schedule.id}&kind=intention_check`,
        };
    }
    return {
        title: `A few quiet minutes.`,
        body: `What stayed with you from ${className}?`,
        url: `/quick-log?from=class&class=${schedule.id}&kind=drive_home`,
    };
}

// Map a webPushClient result to the notification_sends ledger status enum.
// Exported for unit tests — keep the mapping covered so a future webpush
// behaviour change (new status codes etc.) doesn't silently miscategorise.
export function classifySendResult(result: PushSendResult): SendStatus {
    if (result.ok) return 'sent';
    if (result.expired) return 'gone';
    if (!result.statusCode && result.error?.toLowerCase().includes('not configured')) {
        return 'no_vapid';
    }
    const code = result.statusCode ?? 0;
    if (code >= 500) return 'server_error';
    return 'client_error';
}

// Pull the host out of a push endpoint URL for low-cardinality grouping (e.g.
// "fcm.googleapis.com" vs "web.push.apple.com"). Failures degrade to null —
// the host is observability-only, never load-bearing. Exported for tests.
export function endpointHost(endpoint: string): string | null {
    try {
        return new URL(endpoint).host;
    } catch {
        return null;
    }
}

async function fireOne(schedule: ScheduleWithTimezone, kind: NotificationKind): Promise<void> {
    const subs = await listSubscriptionsForUserByKind(schedule.user_id, kind);
    if (subs.length === 0) return;

    const copy = await buildPayload(kind, schedule);
    const payload = {
        kind,
        title: copy.title,
        body: copy.body,
        url: copy.url,
        scheduleId: schedule.id,
    };

    await Promise.allSettled(subs.map(async (sub) => {
        const result = await sendPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
        );

        // Ledger write — fire-and-forget, recordSend swallows its own errors.
        // We log BEFORE deleting an expired subscription so the row's
        // subscription_id FK still resolves at insert time.
        await recordSend({
            user_id: schedule.user_id,
            subscription_id: sub.id,
            category: kind,
            status: classifySendResult(result),
            status_code: result.statusCode ?? null,
            error_message: result.ok ? null : (result.error ?? null),
            endpoint_host: endpointHost(sub.endpoint),
            schedule_id: schedule.id,
        });

        if (result.expired) {
            await deleteSubscriptionByEndpoint(sub.endpoint).catch(() => {/* swallow */});
        } else if (!result.ok) {
            console.warn(`⚠️  Push failed [${kind}] for sub ${sub.id}:`, result.statusCode, result.error);
        }
    }));
}

export async function tick(nowUtc: DateTime = DateTime.utc()): Promise<void> {
    const currentMinute = nowUtc.toFormat("yyyy-LL-dd'T'HH:mm");
    pruneDedup();
    let schedules: ScheduleWithTimezone[];
    try {
        schedules = await listAllActiveSchedulesWithTimezone();
    } catch (err) {
        console.error('❌ Notification scheduler: failed to load schedules:', err);
        return;
    }
    if (schedules.length === 0) return;

    for (const schedule of schedules) {
        const specs = computeFireSpecs(nowUtc, schedule);
        for (const spec of specs) {
            if (spec.targetUtcMinute !== currentMinute) continue;
            const key = dedupKey(schedule.id, spec.kind, spec.targetUtcMinute);
            if (dedup.has(key)) continue;
            dedup.add(key);
            try {
                await fireOne(schedule, spec.kind);
            } catch (err) {
                console.error(`❌ fireOne failed [${spec.kind}, ${schedule.id}]:`, err);
            }
        }
    }
}

export function startNotificationScheduler(): void {
    if (!configureWebPush()) {
        console.warn('⚠️  Notification scheduler: NOT started (Web Push not configured).');
        return;
    }
    cron.schedule('* * * * *', () => {
        void tick();
    });
    console.log('🔔 Notification scheduler started (1-min tick).');
}

// In-memory cleanup helper for tests
export function _resetDedupForTests(): void {
    dedup.clear();
}

// Set TTL constant referenced in dedup eventual cleanup tests
export const _DEDUP_TTL_MS = DEDUP_TTL_MS;
