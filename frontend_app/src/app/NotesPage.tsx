import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { useTrainingNotes } from '../hooks/useTrainingNotes.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import SegmentedToggle from '../components/SegmentedToggle.tsx';
import PageContent from '../components/PageContent.tsx';
import { PALE_YELLOW, GLOW_SOFT, COPPER, FONT_EDITORIAL, SURFACE_3 } from '../lib/theme.ts';
import { toast } from '../hooks/use-toast.ts';
import type { TrainingNote } from '../types/api.ts';

export default function NotesPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { notes, loading, refetch, search } = useTrainingNotes();
  const [searchText, setSearchText] = useState('');
  const [composing, setComposing] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingNote, setEditingNote] = useState<TrainingNote | null>(null);
  const [editText, setEditText] = useState('');

  const handleSearch = useCallback((value: string) => {
    setSearchText(value);
    search(value);
  }, [search]);

  const handleCreate = async () => {
    if (!composeText.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/notes', { text: composeText.trim() });
      refetch();
      setComposeText('');
      setComposing(false);
      toast({ title: 'Note saved.' });
    } catch {
      toast({ title: 'Failed to save note.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (note: TrainingNote) => {
    try {
      await api.put(`/api/notes/${note.id}`, { pinned: !note.pinned });
      refetch();
    } catch {
      toast({ title: 'Failed to update note.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/notes/${id}`);
      refetch();
      setEditingNote(null);
      toast({ title: 'Note deleted.' });
    } catch {
      toast({ title: 'Failed to delete note.', variant: 'destructive' });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingNote || !editText.trim()) return;
    try {
      await api.put(`/api/notes/${editingNote.id}`, { text: editText.trim() });
      refetch();
      setEditingNote(null);
      toast({ title: 'Note updated.' });
    } catch {
      toast({ title: 'Failed to update note.', variant: 'destructive' });
    }
  };

  const pinned = notes.filter(n => n.pinned);
  const recent = notes.filter(n => !n.pinned);

  return (
    <PageContent ready={!loading} loadingMessages={['Loading reflections...']}>
    <div className={isDesktop ? 'j2-page-container' : 'mx-auto max-w-5xl px-4 sm:px-6'} style={{ paddingTop: 24, paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1
          style={{
            fontFamily: FONT_EDITORIAL,
            fontWeight: 500,
            color: PALE_YELLOW,
            textShadow: GLOW_SOFT,
            fontSize: 28,
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          Journal
        </h1>
        <SegmentedToggle<'entries' | 'intentions' | 'notes'>
          size="compact"
          options={[
            { value: 'entries', label: 'Entries' },
            { value: 'intentions', label: 'Intentions' },
            { value: 'notes', label: 'Notes' },
          ]}
          value="notes"
          onChange={(v) => {
            if (v === 'entries') navigate('/journal', { replace: true });
            if (v === 'intentions') navigate('/intentions', { replace: true });
          }}
        />
      </div>

      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </p>

      {/* Search */}
      <input
        type="search"
        inputMode="search"
        placeholder="Search your reflections…"
        value={searchText}
        onChange={e => handleSearch(e.target.value)}
        style={{
          width: '100%',
          fontSize: 15,
          padding: '12px 14px',
          borderRadius: 12,
          backgroundColor: SURFACE_3,
          border: '1px solid rgba(255,255,255,0.04)',
          color: 'white',
          marginBottom: 16,
          outline: 'none',
        }}
      />

      {/* Compose / Add — hidden when editing */}
      {!editingNote && (composing ? (
        <div style={{ marginBottom: 20 }}>
          <textarea
            autoFocus
            placeholder="What's on your mind about training?"
            value={composeText}
            onChange={e => setComposeText(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              fontSize: 14,
              padding: '12px 14px',
              borderRadius: 12,
              backgroundColor: SURFACE_3,
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'white',
              resize: 'vertical',
              outline: 'none',
              marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={saving || !composeText.trim()}
              style={{
                flex: 1, fontSize: 13, fontWeight: 600, padding: '10px 0', borderRadius: 10,
                border: `1px solid ${COPPER}`, color: COPPER,
                backgroundColor: 'rgba(196,145,95,0.06)', cursor: 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save Note'}
            </button>
            <button
              onClick={() => { setComposing(false); setComposeText(''); }}
              style={{
                fontSize: 13, padding: '10px 14px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)',
                backgroundColor: 'transparent', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setComposing(true)}
          style={{
            fontSize: 13, fontWeight: 600, color: COPPER, background: 'none',
            border: 'none', borderBottom: `1px solid rgba(196,145,95,0.3)`,
            padding: 0, cursor: 'pointer', marginBottom: 16, display: 'block',
          }}
        >
          + New note →
        </button>
      ))}

      {/* Inline edit — replaces the note row */}
      {editingNote && (
        <div style={{
          marginBottom: 16, padding: 14, borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(196,145,95,0.2)',
        }}>
          {/* Edit header — date + pin toggle + close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
              {new Date(editingNote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => handleTogglePin(editingNote)}
                className="touch-manipulation"
                title={editingNote.pinned ? 'Unpin' : 'Pin'}
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: editingNote.pinned ? 'rgba(242,228,168,0.12)' : 'transparent',
                  border: `1px solid ${editingNote.pinned ? 'rgba(242,228,168,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  color: editingNote.pinned ? PALE_YELLOW : 'rgba(255,255,255,0.30)',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                ◈
              </button>
              <button
                onClick={() => setEditingNote(null)}
                className="touch-manipulation"
                style={{ fontSize: 16, color: 'rgba(255,255,255,0.30)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >
                ×
              </button>
            </div>
          </div>

          <textarea
            autoFocus
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={4}
            style={{
              width: '100%', fontSize: 14, padding: '10px 12px', borderRadius: 10,
              backgroundColor: SURFACE_3, border: '1px solid rgba(255,255,255,0.08)',
              color: 'white', resize: 'vertical', outline: 'none', marginBottom: 10,
            }}
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleSaveEdit}
              style={{
                flex: 1, fontSize: 13, fontWeight: 600, padding: '9px 0', borderRadius: 8,
                border: `1px solid ${COPPER}`, color: COPPER,
                backgroundColor: 'rgba(196,145,95,0.06)', cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={() => { if (confirm('Delete this note?')) handleDelete(editingNote.id); }}
              style={{
                fontSize: 12, padding: '9px 12px', borderRadius: 8,
                border: 'none', color: 'rgba(255,255,255,0.25)',
                backgroundColor: 'transparent', cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {notes.length === 0 && !loading && !searchText && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 16, color: 'rgba(255,255,255,0.40)', marginBottom: 6 }}>
            Your training reflections live here.
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
            Ideas, concepts, and insights that don't belong to a single session.
          </p>
        </div>
      )}

      {/* No search results */}
      {notes.length === 0 && !loading && searchText && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
          No notes matching "{searchText}"
        </p>
      )}

      {/* Pinned section */}
      {pinned.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Pinned</span>
            <span style={{ flex: 1, height: 1, backgroundColor: 'rgba(196,145,95,0.2)', borderRadius: 1 }} />
          </div>
          {pinned.filter(n => n.id !== editingNote?.id).map(note => (
            <NoteRow key={note.id} note={note} onTap={() => { setEditingNote(note); setEditText(note.text); }} />
          ))}
        </>
      )}

      {/* Recent section */}
      {recent.length > 0 && (
        <>
          {pinned.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Recent</span>
              <span style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
            </div>
          )}
          {recent.filter(n => n.id !== editingNote?.id).map(note => (
            <NoteRow key={note.id} note={note} onTap={() => { setEditingNote(note); setEditText(note.text); }} />
          ))}
        </>
      )}
    </div>
    </PageContent>
  );
}

function NoteRow({ note, onTap }: { note: TrainingNote; onTap: () => void }) {
  const date = new Date(note.created_at);
  return (
    <button
      onClick={onTap}
      className="w-full text-left touch-manipulation"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'none', border: 'none', borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
      }}
    >
      {note.pinned && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: PALE_YELLOW, flexShrink: 0, marginTop: 6 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, color: 'rgba(255,255,255,0.80)', margin: 0,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          lineHeight: 1.5,
        }}>
          {note.text}
        </p>
        {note.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {note.tags.map(tag => (
              <span key={tag} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
    </button>
  );
}
