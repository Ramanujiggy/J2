import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import pool from '../config/db.js';
import * as intentionModel from '../models/intentionModel.js';

const VALID_CATEGORIES = new Set([
  'technical', 'physical', 'mental', 'positional', 'competitive',
]);

const VALID_HEADINGS = new Set([
  'standup', 'passing', 'pins', 'submissions', 'guard',
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
// Body: { intent_label?, heading?, intent_category?, week_start?, duration_days? }
// Creates an intention. If an active intention exists, it is shortened to end
// yesterday (mid-week pivot) and the new intention starts from today.

export const createIntention = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { intent_label, heading, intent_category, week_start, duration_days } = req.body;

    // Heading is the primary focus selector (Prism vertex). Label is optional flavor text.
    if (heading !== undefined && heading !== null && !VALID_HEADINGS.has(heading)) {
      return res.status(400).json({ message: 'Invalid heading.' });
    }
    // Label validation: optional, but if provided must be ≤ 20 chars
    const label = (typeof intent_label === 'string' && intent_label.trim()) ? intent_label.trim() : '';
    if (label.length > 20) {
      return res.status(400).json({ message: 'intent_label must be 20 characters or fewer.' });
    }
    if (intent_category !== undefined && intent_category !== null && !VALID_CATEGORIES.has(intent_category)) {
      return res.status(400).json({ message: 'Invalid intent_category.' });
    }

    const durationDays = duration_days !== undefined ? Math.round(Number(duration_days)) : 7;
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 30) {
      return res.status(400).json({ message: 'duration_days must be an integer between 1 and 30.' });
    }

    // Use client-supplied start date or today
    const todayStr = new Date().toISOString().slice(0, 10);
    const startDate = week_start ?? todayStr;

    // Transaction: locks the active intention row (if any) with FOR UPDATE so that
    // concurrent POSTs serialise. Without this, two requests could both see the same
    // active intention, both try to shorten it, and both insert new rows — leaving
    // overlapping intentions in the database.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const active = await intentionModel.getActiveIntention(userId, todayStr, client, true);
      if (active && active.week_start.slice(0, 10) !== startDate) {
        const activeStart = new Date(active.week_start.slice(0, 10) + 'T00:00:00');
        const today = new Date(todayStr + 'T00:00:00');
        const daysSinceStart = Math.max(1, Math.round((today.getTime() - activeStart.getTime()) / 86_400_000));
        await intentionModel.shortenIntention(userId, active.id, daysSinceStart, client);
      }

      const intention = await intentionModel.createIntention(
        userId,
        startDate,
        label || (heading ?? 'Focus'),
        intent_category ?? null,
        heading ?? null,
        durationDays,
        client,
      );

      await client.query('COMMIT');
      res.status(201).json({ message: 'Intention set.', intention });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
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

    // Weak ETag over (id, week_start, journal_entry-presence). The journal_entry
    // is the most-mutated field; intent_label / heading / duration are write-once
    // for the lifetime of an intention. Hashing the journal-entry presence flag
    // (rather than full text) keeps the hash cheap while still invalidating when
    // a user edits their journal — which is the only realistic mutation path.
    const etag = 'W/"' + createHash('sha1')
      .update(intentions.map(i => `${i.id}:${i.week_start}:${i.journal_entry ? '1' : '0'}`).join('|'))
      .digest('base64')
      .slice(0, 20) + '"';

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=60');
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
    // Prefer date-range lookup (finds any active intention covering today).
    // Falls back to week_start match for backward compat with old clients.
    const todayStr = (req.query.week_start as string) ?? new Date().toISOString().slice(0, 10);
    const intention = await intentionModel.getActiveIntention(userId, todayStr)
      ?? await intentionModel.getIntentionByWeek(userId, todayStr);
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

// ---- PATCH /api/intentions/:id -------------------------------------------
// Body: { intent_label, intent_category?, duration_days? }
// Updates label, category, and duration. week_start is immutable.

export const patchIntention = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { intent_label, heading, intent_category, duration_days } = req.body;

    const label = (typeof intent_label === 'string' && intent_label.trim()) ? intent_label.trim() : '';
    if (label.length > 20) {
      return res.status(400).json({ message: 'intent_label must be 20 characters or fewer.' });
    }
    if (heading !== undefined && heading !== null && !VALID_HEADINGS.has(heading)) {
      return res.status(400).json({ message: 'Invalid heading.' });
    }
    if (intent_category !== undefined && intent_category !== null && !VALID_CATEGORIES.has(intent_category)) {
      return res.status(400).json({ message: 'Invalid intent_category.' });
    }

    const durationDays = duration_days !== undefined ? Math.round(Number(duration_days)) : 7;
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 30) {
      return res.status(400).json({ message: 'duration_days must be an integer between 1 and 30.' });
    }

    const updated = await intentionModel.updateIntention(
      userId,
      id!,
      label || (heading ?? 'Focus'),
      intent_category ?? null,
      heading ?? null,
      durationDays,
    );

    if (!updated) {
      return res.status(404).json({ message: 'Intention not found or not owned by user.' });
    }

    res.status(200).json({ message: 'Intention updated.', intention: updated });
  } catch (error) {
    console.error('❌ Error updating intention:', error);
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
