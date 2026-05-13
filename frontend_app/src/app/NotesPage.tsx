import { useState, useCallback, useRef, useEffect } from 'react';
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

  // Editor state — null = list view, 'new' = composing, TrainingNote = editing
  const [editorNote, setEditorNote] = useState<TrainingNote | 'new' | null>(null);
  const [editorText, setEditorText] = useState('');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedText = useRef('');
  const createdIdRef = useRef<string | null>(null);

  const handleSearch = useCallback((value: string) => {
    setSearchText(value);
    search(value);
  }, [search]);

  // Open editor
  const openEditor = (note: TrainingNote | 'new') => {
    setEditorNote(note);
    setEditorText(note === 'new' ? '' : note.text);
    lastSavedText.current = note === 'new' ? '' : note.text;
    createdIdRef.current = null;
  };

  // Autosave on text change (debounced 1.2s)
  const handleEditorChange = (text: string) => {
    setEditorText(text);
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      const trimmed = text.trim();
      if (!trimmed || trimmed === lastSavedText.current.trim()) return;
      try {
        if (editorNote === 'new') {
          if (!createdIdRef.current) {
            const res = await api.post<{ note: TrainingNote }>('/api/notes', { text: trimmed });
            createdIdRef.current = res.note.id;
          } else {
            await api.put(`/api/notes/${createdIdRef.current}`, { text: trimmed });
          }
        } else if (editorNote && typeof editorNote === 'object') {
          await api.put(`/api/notes/${editorNote.id}`, { text: trimmed });
        }
        lastSavedText.current = trimmed;
      } catch {
        // Silent fail — will retry on next change
      }
    }, 1200);
  };

  // Close editor — final save + refetch
  const closeEditor = async () => {
    clearTimeout(autosaveTimer.current);
    const trimmed = editorText.trim();
    if (trimmed && trimmed !== lastSavedText.current.trim()) {
      try {
        if (editorNote === 'new' && !createdIdRef.current) {
          await api.post('/api/notes', { text: trimmed });
        } else if (editorNote === 'new' && createdIdRef.current) {
          await api.put(`/api/notes/${createdIdRef.current}`, { text: trimmed });
        } else if (editorNote && typeof editorNote === 'object') {
          await api.put(`/api/notes/${editorNote.id}`, { text: trimmed });
        }
      } catch {
        toast({ title: 'Failed to save note.', variant: 'destructive' });
      }
    }
    setEditorNote(null);
    setEditorText('');
    createdIdRef.current = null;
    refetch();
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
      setEditorNote(null);
      toast({ title: 'Note deleted.' });
    } catch {
      toast({ title: 'Failed to delete note.', variant: 'destructive' });
    }
  };

  const pinned = notes.filter(n => n.pinned);
  const recent = notes.filter(n => !n.pinned);

  // ── Full-page editor ────────────────────────────────────────────
  if (editorNote !== null) {
    const isExisting = editorNote !== 'new' && typeof editorNote === 'object';
    const noteDate = isExisting
      ? new Date(editorNote.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: '#0D1A14', padding: '0 20px', paddingTop: 'env(safe-area-inset-top, 16px)' }}
      >
        {/* Top bar — date + Done */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 20px' }}>
          <span
            style={{
              fontFamily: FONT_EDITORIAL,
              fontStyle: 'italic',
              fontSize: 14,
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            {noteDate}
          </span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {isExisting && (
              <>
                <button
                  onClick={() => handleTogglePin(editorNote)}
                  className="touch-manipulation"
                  style={{
                    fontSize: 14,
                    color: editorNote.pinned ? PALE_YELLOW : 'rgba(255,255,255,0.25)',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  ◈
                </button>
                <button
                  onClick={() => { if (confirm('Delete this note?')) handleDelete(editorNote.id); }}
                  className="touch-manipulation"
                  style={{ fontSize: 12, color: 'rgba(255,255,255,0.20)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </>
            )}
            <button
              onClick={closeEditor}
              style={{
                fontFamily: FONT_EDITORIAL,
                fontStyle: 'italic',
                fontSize: 15,
                color: COPPER,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>

        {/* Writing surface — no chrome, just text on the page */}
        <textarea
          autoFocus
          placeholder="What's on your mind about training?"
          value={editorText}
          onChange={e => handleEditorChange(e.target.value)}
          style={{
            width: '100%',
            minHeight: 'calc(100vh - 120px)',
            fontSize: 16,
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.90)',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            padding: 0,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        />
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────
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

      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 14 }}>
        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </p>

      {/* Search + New note */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
        <input
          type="search"
          inputMode="search"
          placeholder="Search your reflections…"
          value={searchText}
          onChange={e => handleSearch(e.target.value)}
          style={{
            flex: 1,
            fontSize: 15,
            padding: '12px 14px',
            borderRadius: 12,
            backgroundColor: SURFACE_3,
            border: '1px solid rgba(255,255,255,0.04)',
            color: 'white',
            outline: 'none',
          }}
        />
        <button
          onClick={() => openEditor('new')}
          className="touch-manipulation"
          style={{
            flexShrink: 0,
            width: 40, height: 40, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(196,145,95,0.12)',
            border: '1px solid rgba(196,145,95,0.25)',
            color: COPPER, fontSize: 20, fontWeight: 300,
            cursor: 'pointer',
          }}
          aria-label="New note"
        >
          +
        </button>
      </div>

      {/* Empty state */}
      {notes.length === 0 && !loading && !searchText && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{
            fontFamily: FONT_EDITORIAL,
            fontStyle: 'italic',
            fontSize: 18,
            color: 'rgba(242,228,168,0.40)',
            marginBottom: 8,
            lineHeight: 1.4,
          }}>
            A space for thoughts<br />between sessions.
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.22)', marginBottom: 20 }}>
            Ideas, observations, and half-formed insights<br />that don't belong to a single session.
          </p>
          <button
            onClick={() => openEditor('new')}
            style={{
              fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 15,
              color: COPPER, background: 'none', border: 'none',
              borderBottom: `1px solid rgba(196,145,95,0.3)`,
              cursor: 'pointer', padding: 0,
            }}
          >
            Write your first note →
          </button>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Pinned</span>
            <span style={{ flex: 1, height: 1, backgroundColor: 'rgba(196,145,95,0.2)', borderRadius: 1 }} />
          </div>
          {pinned.map(note => (
            <NoteRow key={note.id} note={note} onTap={() => openEditor(note)} />
          ))}
        </>
      )}

      {/* Recent section */}
      {recent.length > 0 && (
        <>
          {pinned.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 10 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Recent</span>
              <span style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
            </div>
          )}
          {recent.map(note => (
            <NoteRow key={note.id} note={note} onTap={() => openEditor(note)} />
          ))}
        </>
      )}
    </div>
    </PageContent>
  );
}

function NoteRow({ note, onTap }: { note: TrainingNote; onTap: () => void }) {
  const date = new Date(note.created_at);
  const fullText = note.text.trim();
  const firstLine = fullText.split('\n')[0]?.trim() ?? '';
  const rest = fullText.slice(firstLine.length).trim();
  const bodyPreview = rest.length > 0 ? rest.replace(/\n+/g, ' ') : null;

  return (
    <button
      onClick={onTap}
      className="w-full text-left touch-manipulation"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '14px 0',
        borderBottom: '1px solid rgba(196,145,95,0.08)',
        background: 'none', border: 'none',
        borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: 'rgba(196,145,95,0.08)',
        cursor: 'pointer',
        minHeight: 72,
      }}
    >
      {note.pinned && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: PALE_YELLOW, flexShrink: 0, marginTop: 7 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}>
          {firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine}
        </p>
        {bodyPreview !== null && (
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '4px 0 0',
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            lineHeight: 1.5,
          }}>
            {bodyPreview}
          </p>
        )}
        <span
          style={{
            fontFamily: FONT_EDITORIAL, fontStyle: 'italic',
            fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 4, display: 'block',
          }}
        >
          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </button>
  );
}
