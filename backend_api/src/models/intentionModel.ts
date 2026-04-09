import { query } from '../config/db.js';

export interface Intention {
  id: string;
  user_id: string;
  week_start: string; // YYYY-MM-DD
  intent_label: string;
  intent_category: 'technical' | 'physical' | 'mental' | 'positional' | 'competitive' | null;
  duration_days: number;
  journal_entry: string | null;
  created_at: Date;
}

export const createIntention = async (
  userId: string,
  weekStart: string,
  intentLabel: string,
  intentCategory: string | null,
  durationDays: number,
): Promise<Intention> => {
  const result = await query(
    `INSERT INTO weekly_intentions (user_id, week_start, intent_label, intent_category, duration_days)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, weekStart, intentLabel, intentCategory, durationDays],
  );
  return result.rows[0];
};

export const getAllIntentions = async (userId: string): Promise<Intention[]> => {
  const result = await query(
    `SELECT * FROM weekly_intentions WHERE user_id = $1 ORDER BY week_start DESC`,
    [userId],
  );
  return result.rows;
};

export const getIntentionByWeek = async (
  userId: string,
  weekStart: string,
): Promise<Intention | null> => {
  const result = await query(
    `SELECT * FROM weekly_intentions WHERE user_id = $1 AND week_start = $2`,
    [userId, weekStart],
  );
  return result.rows[0] ?? null;
};

export const updateJournalEntry = async (
  userId: string,
  id: string,
  journalEntry: string,
): Promise<Intention | null> => {
  const result = await query(
    `UPDATE weekly_intentions SET journal_entry = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [journalEntry, id, userId],
  );
  return result.rows[0] ?? null;
};

export const updateIntention = async (
  userId: string,
  id: string,
  intentLabel: string,
  intentCategory: string | null,
  durationDays: number,
): Promise<Intention | null> => {
  const result = await query(
    `UPDATE weekly_intentions
     SET intent_label = $1, intent_category = $2, duration_days = $3
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [intentLabel, intentCategory, durationDays, id, userId],
  );
  return result.rows[0] ?? null;
};

export const deleteIntention = async (userId: string, id: string): Promise<boolean> => {
  const result = await query(
    `DELETE FROM weekly_intentions WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
};
