import type { Request, Response } from 'express';
import {
    upsertSubscription,
    deleteSubscriptionByEndpoint,
    updateCategoryFlagsForUser,
    listSubscriptionsForUser,
    type CategoryFlags,
} from '../models/pushSubscriptionModel.js';
import { getVapidPublicKey } from '../lib/webPushClient.js';

// Public endpoint — clients fetch the VAPID public key to use as
// `applicationServerKey` when calling pushManager.subscribe().
export const getPublicKey = async (_req: Request, res: Response): Promise<void> => {
    const key = getVapidPublicKey();
    if (!key) { res.status(503).json({ message: 'Push not configured.' }); return; }
    res.json({ vapidPublicKey: key });
};

export const subscribe = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;

        const { endpoint, keys, user_agent } = req.body ?? {};
        if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
            res.status(400).json({ message: 'Invalid endpoint.' });
            return;
        }
        if (!keys || typeof keys !== 'object' || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
            res.status(400).json({ message: 'Invalid keys.' });
            return;
        }

        const sub = await upsertSubscription({
            user_id: userId,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_agent: typeof user_agent === 'string' ? user_agent.slice(0, 240) : null,
        });

        res.status(201).json({
            subscription: {
                id: sub.id,
                pre_class: sub.pre_class,
                intention_check: sub.intention_check,
                drive_home_log: sub.drive_home_log,
            },
        });
    } catch (err) {
        console.error('Error upserting push subscription:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const unsubscribe = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;

        const { endpoint } = req.body ?? {};
        if (typeof endpoint !== 'string') {
            res.status(400).json({ message: 'endpoint is required.' });
            return;
        }
        await deleteSubscriptionByEndpoint(endpoint);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting push subscription:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const updateCategories = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;

        const body = (req.body ?? {}) as Record<string, unknown>;
        const flags: CategoryFlags = {};
        if (typeof body.pre_class === 'boolean') flags.pre_class = body.pre_class;
        if (typeof body.intention_check === 'boolean') flags.intention_check = body.intention_check;
        if (typeof body.drive_home_log === 'boolean') flags.drive_home_log = body.drive_home_log;

        await updateCategoryFlagsForUser(userId, flags);
        const subs = await listSubscriptionsForUser(userId);
        const first = subs[0];
        const merged = first
            ? { pre_class: first.pre_class, intention_check: first.intention_check, drive_home_log: first.drive_home_log }
            : { pre_class: true, intention_check: true, drive_home_log: true };
        res.json({ categories: merged });
    } catch (err) {
        console.error('Error updating push categories:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const getMySubscriptionState = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const subs = await listSubscriptionsForUser(userId);
        const first = subs[0];
        res.json({
            subscribed: subs.length > 0,
            categories: first
                ? { pre_class: first.pre_class, intention_check: first.intention_check, drive_home_log: first.drive_home_log }
                : { pre_class: true, intention_check: true, drive_home_log: true },
        });
    } catch (err) {
        console.error('Error fetching push subscription state:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};
