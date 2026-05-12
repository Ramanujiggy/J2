import type { Request, Response } from 'express';
import { z } from 'zod';
import { getProfile, updateProfile } from '../models/profileModel.js';
import { updateUserTimezone, markOnboardingComplete, setOnboardingStep } from '../models/userModel.js';

const BELT_RANKS = ['white', 'blue', 'purple', 'brown', 'black'] as const;

const ProfileSchema = z.object({
    name: z.string().max(100).nullable().optional(),
    belt_rank: z.enum(BELT_RANKS).nullable().optional(),
    stripes: z.number().int().min(0).max(4).optional(),
    home_gym_name: z.string().max(200).nullable().optional(),
    home_gym_address: z.string().max(500).nullable().optional(),
    home_gym_place_id: z.string().max(200).nullable().optional(),
    intentions_enabled: z.boolean().optional(),
});

export const fetchProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const profile = await getProfile(userId);
        res.json({ profile });
    } catch (err) {
        console.error('❌ Error fetching profile:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const saveProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const parsed = ProfileSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Invalid profile data.', errors: parsed.error.flatten() });
            return;
        }

        const current = await getProfile(userId);

        const updated = await updateProfile(userId, {
            name: parsed.data.name ?? current?.name ?? null,
            belt_rank: parsed.data.belt_rank ?? current?.belt_rank ?? null,
            stripes: parsed.data.stripes ?? current?.stripes ?? 0,
            home_gym_name: parsed.data.home_gym_name ?? current?.home_gym_name ?? null,
            home_gym_address: parsed.data.home_gym_address ?? current?.home_gym_address ?? null,
            home_gym_place_id: parsed.data.home_gym_place_id ?? current?.home_gym_place_id ?? null,
            intentions_enabled: parsed.data.intentions_enabled ?? current?.intentions_enabled ?? true,
        });

        res.json({ message: 'Profile saved.', profile: updated });
    } catch (err) {
        console.error('❌ Error saving profile:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// Validates an IANA timezone string. Falls back to a length+character check if
// `Intl.supportedValuesOf` is unavailable (older Node versions).
function isValidTimezone(tz: string): boolean {
    if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
    try {
        new Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

export const completeOnboarding = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }
        await markOnboardingComplete(userId);
        const profile = await getProfile(userId);
        res.json({ profile });
    } catch (err) {
        console.error('❌ Error completing onboarding:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// mig 026 — record onboarding funnel progress. Per-step capture so we can
// see drop-off in the guided flow. The model layer enforces the
// never-go-backward invariant; this just validates and forwards.
const OnboardingStepSchema = z.object({
    step: z.number().int().min(0).max(5),
});

export const updateOnboardingStep = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }
        const parsed = OnboardingStepSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Invalid step.', errors: parsed.error.flatten() });
            return;
        }
        await setOnboardingStep(userId, parsed.data.step);
        res.json({ ok: true });
    } catch (err) {
        console.error('❌ Error updating onboarding step:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const saveTimezone = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }
        const tz = (req.body ?? {}).timezone;
        if (!isValidTimezone(tz)) { res.status(400).json({ message: 'Invalid timezone.' }); return; }
        await updateUserTimezone(userId, tz);
        res.json({ timezone: tz });
    } catch (err) {
        console.error('❌ Error saving timezone:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};
