import type { Request, Response } from 'express';
import * as intentionModel from '../models/intentionModel.js';

const VALID_CATEGORIES = new Set([
  'technical', 'physical', 'mental', 'positional', 'competitive',
]);

// Returns the ISO Monday (YYYY-MM-DD) for a given Date.
// getUTCDay(): 0=Sun, 1=Mon … 6=Sat
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ---- POST /api/intentions ------------------------------------------------
// Body: { intent_label, intent_category?, week_start?, duration_days? }
// Creates an intention for the specified week (defaults to current week).
// Returns 409 if an intention already exists for that week.

export const createIntention = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { intent_label, intent_category, week_start, duration_days } = req.body;

    if (!intent_label || typeof intent_label !== 'string' || intent_label.trim() === '') {
      return res.status(400).json({ message: 'intent_label is required.' });
    }
    if (intent_label.trim().length > 20) {
      return res.status(400).json({ message: 'intent_label must be 20 characters or fewer.' });
    }
    if (intent_category !== undefined && intent_category !== null && !VALID_CATEGORIES.has(intent_category)) {
      return res.status(400).json({ message: 'Invalid intent_category.' });
    }

    const durationDays = duration_days !== undefined ? Math.round(Number(duration_days)) : 7;
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 30) {
      return res.status(400).json({ message: 'duration_days must be an integer between 1 and 30.' });
    }

    // Use client-supplied week_start (handles timezone) or compute server-side
    const weekStart = week_start ?? getWeekStart(new Date());

    const existing = await intentionModel.getIntentionByWeek(userId, weekStart);
    if (existing) {
      return res.status(409).json({ message: 'An intention already exists for this week. Delete it first to set a new one.' });
    }

    const intention = await intentionModel.createIntention(
      userId,
      weekStart,
      intent_label.trim(),
      intent_category ?? null,
      durationDays,
    );

    res.status(201).json({ message: 'Intention set.', intention });
  } catch (error) {
    console.error('❌ Error creating intention:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---- GET /api/intentions --------------------------------------------------
// Returns all intentions for the user, ordered newest first.
// Used by the Intentions aggregate page.

export const getIntentions = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const intentions = await intentionModel.getAllIntentions(userId);
    res.status(200).json({ intentions });
  } catch (error) {
    console.error('❌ Error fetching intentions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---- GET /api/intentions/current -----------------------------------------
// Returns the intention for the current ISO week, or null if none is set.
// Used by LogSessionForm to show the active intent reminder.
// Client passes ?week_start=YYYY-MM-DD to handle timezone correctly.

export const getCurrentIntention = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const weekStart = (req.query.week_start as string) ?? getWeekStart(new Date());
    const intention = await intentionModel.getIntentionByWeek(userId, weekStart);
    res.status(200).json({ intention }); // null if not set — that's fine
  } catch (error) {
    console.error('❌ Error fetching current intention:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---- PATCH /api/intentions/:id/journal -----------------------------------
// Body: { journal_entry: string }
// Saves (or overwrites) the journal entry for an intention.

export const patchJournalEntry = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { journal_entry } = req.body;

    if (typeof journal_entry !== 'string') {
      return res.status(400).json({ message: 'journal_entry must be a string.' });
    }

    const updated = await intentionModel.updateJournalEntry(userId, id!, journal_entry);
    if (!updated) {
      return res.status(404).json({ message: 'Intention not found or not owned by user.' });
    }

    res.status(200).json({ message: 'Journal entry saved.', intention: updated });
  } catch (error) {
    console.error('❌ Error saving journal entry:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---- DELETE /api/intentions/:id ------------------------------------------
// Deletes an intention. Only the owning user can delete.

export const deleteIntention = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const deleted = await intentionModel.deleteIntention(userId, id!);
    if (!deleted) {
      return res.status(404).json({ message: 'Intention not found or not owned by user.' });
    }

    res.status(200).json({ message: 'Intention deleted.' });
  } catch (error) {
    console.error('❌ Error deleting intention:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
