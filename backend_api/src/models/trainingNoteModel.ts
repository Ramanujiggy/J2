import { query } from '../config/db.js';

export interface TrainingNote {
  id: string;
  user_id: string;
  text: string;
  tags: string[];
  linked_session_id: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export async function listNotes(userId: string, searchQuery?: string): Promise<TrainingNote[]> {
  if (searchQuery?.trim()) {
    const result = await query(
      `SELECT *, ts_rank(to_tsvector('english', text), plainto_tsquery('english', $2)) AS rank
       FROM training_notes
       WHERE user_id = $1 AND to_tsvector('english', text) @@ plainto_tsquery('english', $2)
       ORDER BY pinned DESC, rank DESC, created_at DESC`,
      [userId, searchQuery.trim()],
    );
    return result.rows as TrainingNote[];
  }
  const result = await query(
    'SELECT * FROM training_notes WHERE user_id = $1 ORDER BY pinned DESC, created_at DESC',
    [userId],
  );
  return result.rows as TrainingNote[];
}

export async function createNote(
  userId: string,
  data: { text: string; tags?: string[]; linked_session_id?: string | null; pinned?: boolean },
): Promise<TrainingNote> {
  const result = await query(
    `INSERT INTO training_notes (user_id, text, tags, linked_session_id, pinned)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, data.text, data.tags ?? [], data.linked_session_id ?? null, data.pinned ?? false],
  );
  return result.rows[0] as TrainingNote;
}

export async function updateNote(
  userId: string,
  noteId: string,
  data: { text?: string; tags?: string[]; pinned?: boolean },
): Promise<TrainingNote | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (data.text !== undefined) { sets.push(`text = $${idx++}`); vals.push(data.text); }
  if (data.tags !== undefined) { sets.push(`tags = $${idx++}`); vals.push(data.tags); }
  if (data.pinned !== undefined) { sets.push(`pinned = $${idx++}`); vals.push(data.pinned); }

  if (sets.length === 0) return null;
  sets.push(`updated_at = NOW()`);

  vals.push(noteId, userId);
  const result = await query(
    `UPDATE training_notes SET ${sets.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
    vals,
  );
  return (result.rows[0] as TrainingNote) ?? null;
}

export async function deleteNote(userId: string, noteId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM training_notes WHERE id = $1 AND user_id = $2',
    [noteId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
