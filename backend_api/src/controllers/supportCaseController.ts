// supportCaseController — backs POST /api/cases. Any authenticated user can
// submit a case; the admin queue lives under /api/admin/cases (separate
// controller, requireAdmin gated). The user only types subject + description;
// the client auto-attaches page_url, user_agent, app_version at submit time.

import type { Request, Response } from 'express';
import { z } from 'zod';
import { createCase } from '../models/supportCaseModel.js';

const NewCaseSchema = z.object({
    subject:     z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    page_url:    z.string().max(2000).nullable().optional(),
    user_agent:  z.string().max(500).nullable().optional(),
    app_version: z.string().max(40).nullable().optional(),
});

export const submitCase = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const parsed = NewCaseSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Invalid case data.', errors: parsed.error.flatten() });
            return;
        }
        const created = await createCase({
            user_id:     userId,
            subject:     parsed.data.subject.trim(),
            description: parsed.data.description.trim(),
            page_url:    parsed.data.page_url ?? null,
            user_agent:  parsed.data.user_agent ?? null,
            app_version: parsed.data.app_version ?? null,
        });
        res.status(201).json({ case: created });
    } catch (err) {
        console.error('❌ Error submitting support case:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};
