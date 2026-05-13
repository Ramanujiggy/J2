import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { useTrainingNotes } from '../hooks/useTrainingNotes.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useUserTags } from '../hooks/useUserTags.ts';
import SegmentedToggle from '../components/SegmentedToggle.tsx';
import PageContent from '../components/PageContent.tsx';
import { PALE_YELLOW, GLOW_SOFT, COPPER, FONT_EDITORIAL, SURFACE_3 } from '../lib/theme.ts';
import { toast } from '../hooks/use-toast.ts';
import { formatDuration } from '../lib/sessionUtils.ts';
import type { TrainingNote, SessionSummary } from '../types/api.ts';

export default function NotesPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { notes, loading, refetch, search } = useTrainingNotes();
  const [searchText, setSearchText] = useState('');

  // Editor state — null = list view, 'new' = composing, TrainingNote = editing
  const [editorNote, setEditorNote] = useState<TrainingNote | 'new' | null>(null);
  const [editorText, setEditorText] = useState('');
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [editorLinkedTagIds, setEditorLinkedTagIds] = useState<string[]>([]);
  const [editorLinkedSessionId, setEditorLinkedSessionId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showTechniquePicker, setShowTechniquePicker] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [techSearch, setTechSearch] = useState('');
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedText = useRef('');
  const createdIdRef = useRef<string | null>(null);

  const { tags: allUserTags } = useUserTags();

  const handleSearch = useCallback((value: string) => {
    setSearchText(value);
    search(value);
  }, [search]);

  // Open editor
  // Load recent sessions when session picker opens
  useEffect(() => {
    if (!showSessionPicker || recentSessions.length > 0) return;
    api.get<{ sessions: SessionSummary[] }>('/api/sessions?limit=30')
      .then(res => setRecentSessions(res.sessions ?? []))
      .catch(() => {});
  }, [showSessionPicker]);

  const openEditor = (note: TrainingNote | 'new') => {
    setEditorNote(note);
    setEditorText(note === 'new' ? '' : note.text);
    setEditorTags(note === 'new' ? [] : (note.tags ?? []));
    setEditorLinkedTagIds(note === 'new' ? [] : (note.linked_tag_ids ?? []));
    setEditorLinkedSessionId(note === 'new' ? null : (note.linked_session_id ?? null));
    setShowTagInput(false);
    setShowTechniquePicker(false);
    setShowSessionPicker(false);
    setTagInput('');
    setTechSearch('');
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

  const getNoteId = () => editorNote !== 'new' && typeof editorNote === 'object' ? editorNote.id : createdIdRef.current;

  const linkTechnique = async (tagId: string) => {
    if (editorLinkedTagIds.includes(tagId)) return;
    const newIds = [...editorLinkedTagIds, tagId];
    setEditorLinkedTagIds(newIds);
    setShowTechniquePicker(false);
    const noteId = getNoteId();
    if (noteId) { try { await api.put(`/api/notes/${noteId}`, { linked_tag_ids: newIds }); } catch {} }
  };

  const unlinkTechnique = async (tagId: string) => {
    const newIds = editorLinkedTagIds.filter(id => id !== tagId);
    setEditorLinkedTagIds(newIds);
    const noteId = getNoteId();
    if (noteId) { try { await api.put(`/api/notes/${noteId}`, { linked_tag_ids: newIds }); } catch {} }
  };

  const linkSession = async (sessionId: string) => {
    setEditorLinkedSessionId(sessionId);
    setShowSessionPicker(false);
    const noteId = getNoteId();
    if (noteId) { try { await api.put(`/api/notes/${noteId}`, { linked_session_id: sessionId }); } catch {} }
  };

  const unlinkSession = async () => {
    setEditorLinkedSessionId(null);
    const noteId = getNoteId();
    if (noteId) { try { await api.put(`/api/notes/${noteId}`, { linked_session_id: null }); } catch {} }
  };

  const addTag = async (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed || editorTags.includes(trimmed)) return;
    const newTags = [...editorTags, trimmed];
    setEditorTags(newTags);
    setTagInput('');
    setShowTagInput(false);
    const noteId = editorNote !== 'new' && typeof editorNote === 'object' ? editorNote.id : createdIdRef.current;
    if (noteId) {
      try { await api.put(`/api/notes/${noteId}`, { tags: newTags }); } catch {}
    }
  };

  const removeTag = async (tag: string) => {
    const newTags = editorTags.filter(t => t !== tag);
    setEditorTags(newTags);
    const noteId = editorNote !== 'new' && typeof editorNote === 'object' ? editorNote.id : createdIdRef.current;
    if (noteId) {
      try { await api.put(`/api/notes/${noteId}`, { tags: newTags }); } catch {}
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
            minHeight: 'calc(100vh - 260px)',
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

        {/* Metadata — tags displayed as copper pills */}
        {editorTags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16, marginBottom: 8 }}>
            {editorTags.map(tag => (
              <span
                key={tag}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: COPPER,
                  backgroundColor: 'rgba(196,145,95,0.12)',
                  border: '1px solid rgba(196,145,95,0.30)',
                  borderRadius: 999,
                  padding: '3px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  style={{ fontSize: 14, color: 'rgba(196,145,95,0.50)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tag input — appears when "Add tag" is tapped */}
        {showTagInput && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8 }}>
            <input
              autoFocus
              type="text"
              placeholder="Tag name…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
              style={{
                flex: 1, fontSize: 13, padding: '8px 12px', borderRadius: 8,
                backgroundColor: SURFACE_3, border: '1px solid rgba(255,255,255,0.08)',
                color: 'white', outline: 'none',
              }}
            />
            <button
              onClick={() => addTag(tagInput)}
              style={{ fontSize: 13, fontWeight: 600, color: COPPER, background: 'none', border: `1px solid rgba(196,145,95,0.3)`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}
            >
              Add
            </button>
            <button
              onClick={() => { setShowTagInput(false); setTagInput(''); }}
              style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Linked techniques — copper-bordered mini-cards */}
        {editorLinkedTagIds.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            {editorLinkedTagIds.map(tagId => {
              const tag = allUserTags.find(t => t.id === tagId);
              if (!tag) return null;
              return (
                <div key={tagId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  backgroundColor: '#152E22', border: '1px solid rgba(196,145,95,0.35)',
                }}>
                  <div>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.90)' }}>{tag.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(196,145,95,0.60)', marginLeft: 8 }}>
                      {tag.parent_pillar}
                    </span>
                  </div>
                  <button onClick={() => unlinkTechnique(tagId)} style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>×</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Linked session — copper-bordered mini-card */}
        {editorLinkedSessionId && (() => {
          const session = recentSessions.find(s => s.id === editorLinkedSessionId);
          return (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 8, marginTop: 8,
              backgroundColor: '#152E22', border: '1px solid rgba(196,145,95,0.35)',
            }}>
              <div>
                <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 14, color: PALE_YELLOW }}>
                  {session ? new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Linked session'}
                </span>
                {session && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginLeft: 8 }}>
                    {session.heading ?? ''} · {formatDuration(session.duration)}
                  </span>
                )}
              </div>
              <button onClick={unlinkSession} style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>
          );
        })()}

        {/* Technique picker overlay */}
        {showTechniquePicker && (
          <div style={{
            marginTop: 10, maxHeight: 200, overflowY: 'auto',
            borderRadius: 10, border: '1px solid rgba(196,145,95,0.25)',
            backgroundColor: 'rgba(21,46,34,0.95)', padding: 10,
          }}>
            <input
              autoFocus
              type="search"
              placeholder="Search techniques…"
              value={techSearch}
              onChange={e => setTechSearch(e.target.value)}
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, backgroundColor: SURFACE_3, border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none', marginBottom: 8 }}
            />
            {allUserTags
              .filter(t => !editorLinkedTagIds.includes(t.id))
              .filter(t => !techSearch.trim() || t.name.toLowerCase().includes(techSearch.toLowerCase()))
              .slice(0, 15)
              .map(tag => (
                <button
                  key={tag.id}
                  onClick={() => linkTechnique(tag.id)}
                  className="w-full text-left touch-manipulation"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)' }}>{tag.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(196,145,95,0.50)' }}>{tag.parent_pillar}</span>
                  {tag.affinity && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{tag.affinity === 'go_to' ? '★' : tag.affinity === 'learning' ? '◐' : '◌'}</span>}
                </button>
              ))
            }
            {allUserTags.filter(t => !editorLinkedTagIds.includes(t.id)).filter(t => !techSearch.trim() || t.name.toLowerCase().includes(techSearch.toLowerCase())).length === 0 && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', fontStyle: 'italic', padding: '8px 0', textAlign: 'center' }}>
                {techSearch ? 'No matching techniques' : 'No techniques in library yet'}
              </p>
            )}
          </div>
        )}

        {/* Session picker overlay */}
        {showSessionPicker && (
          <div style={{
            marginTop: 10, maxHeight: 220, overflowY: 'auto',
            borderRadius: 10, border: '1px solid rgba(196,145,95,0.25)',
            backgroundColor: 'rgba(21,46,34,0.95)', padding: 10,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 8 }}>Recent sessions</p>
            {recentSessions.slice(0, 20).map(s => (
              <button
                key={s.id}
                onClick={() => linkSession(s.id)}
                className="w-full text-left touch-manipulation"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 13, color: PALE_YELLOW }}>
                  {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                  {s.heading ?? ''} · {formatDuration(s.duration)}
                </span>
              </button>
            ))}
            {recentSessions.length === 0 && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', fontStyle: 'italic', textAlign: 'center' }}>No sessions yet</p>
            )}
          </div>
        )}

        {/* Bottom toolbar — quiet affordances */}
        <div style={{
          borderTop: '1px solid rgba(196,145,95,0.10)',
          paddingTop: 14,
          marginTop: 12,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => { setShowTechniquePicker(v => !v); setShowSessionPicker(false); }}
            style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 14, color: COPPER, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Link technique
          </button>
          <span style={{ color: 'rgba(196,145,95,0.30)', fontSize: 12 }}>·</span>
          <button
            onClick={() => setShowTagInput(true)}
            style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 14, color: COPPER, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Add tag
          </button>
          <span style={{ color: 'rgba(196,145,95,0.30)', fontSize: 12 }}>·</span>
          <button
            onClick={() => { setShowSessionPicker(v => !v); setShowTechniquePicker(false); }}
            style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 14, color: COPPER, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Link session
          </button>
        </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: FONT_EDITORIAL, fontStyle: 'italic',
              fontSize: 12, color: 'rgba(255,255,255,0.25)',
            }}
          >
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          {note.tags.length > 0 && note.tags.map(tag => (
            <span
              key={tag}
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(196,145,95,0.60)',
                backgroundColor: 'rgba(196,145,95,0.08)',
                borderRadius: 4, padding: '1px 5px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
