import type { Request, Response } from 'express';
import { z } from 'zod';
import { listNotes, createNote, updateNote, deleteNote } from '../models/trainingNoteModel.js';

const CreateSchema = z.object({
  text: z.string().min(1).max(5000),
  tags: z.array(z.string().max(50)).max(10).optional(),
  linked_session_id: z.string().uuid().nullable().optional(),
  pinned: z.boolean().optional(),
});

const UpdateSchema = z.object({
  text: z.string().min(1).max(5000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  pinned: z.boolean().optional(),
  linked_session_id: z.string().uuid().nullable().optional(),
  linked_tag_ids: z.array(z.string().uuid()).max(10).optional(),
});

export async function list(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const notes = await listNotes(req.user!.id, q);
    res.json({ notes });
  } catch (err) {
    console.error('listNotes error:', err);
    res.status(500).json({ error: 'Failed to load notes.' });
  }
}

export async function create(req: Request, res: Response) {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    // Strip undefined keys so optional model params accept the payload under
    // exactOptionalPropertyTypes: true.
    const payload: Parameters<typeof createNote>[1] = { text: parsed.data.text };
    if (parsed.data.tags              !== undefined) payload.tags              = parsed.data.tags;
    if (parsed.data.linked_session_id !== undefined) payload.linked_session_id = parsed.data.linked_session_id;
    if (parsed.data.pinned            !== undefined) payload.pinned            = parsed.data.pinned;
    const note = await createNote(req.user!.id, payload);
    res.status(201).json({ note });
  } catch (err) {
    console.error('createNote error:', err);
    res.status(500).json({ error: 'Failed to save note.' });
  }
}

export async function update(req: Request, res: Response) {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Missing note id.' });
      return;
    }
    const payload: Parameters<typeof updateNote>[2] = {};
    if (parsed.data.text   !== undefined) payload.text   = parsed.data.text;
    if (parsed.data.tags   !== undefined) payload.tags   = parsed.data.tags;
    if (parsed.data.pinned !== undefined) payload.pinned = parsed.data.pinned;
    const note = await updateNote(req.user!.id, id, payload);
    if (!note) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    res.json({ note });
  } catch (err) {
    console.error('updateNote error:', err);
    res.status(500).json({ error: 'Failed to update note.' });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Missing note id.' });
      return;
    }
    const deleted = await deleteNote(req.user!.id, id);
    if (!deleted) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('deleteNote error:', err);
    res.status(500).json({ error: 'Failed to delete note.' });
  }
}
