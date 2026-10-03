import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { useTrainingNotes } from '../hooks/useTrainingNotes.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useUserTags } from '../hooks/useUserTags.ts';
import SegmentedToggle from '../components/SegmentedToggle.tsx';
import PageContent from '../components/PageContent.tsx';
import JournalEmptyState from '../components/JournalEmptyState.tsx';
import { PAGE_BG, PALE_YELLOW, GLOW_SOFT, COPPER, COPPER_BORDER, FONT_EDITORIAL } from '../lib/theme.ts';
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

  // Track keyboard height via visualViewport for toolbar positioning
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    if (editorNote === null) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(Math.max(0, offset));
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, [editorNote]);

  // Listen for tab bar + to create a new note
  useEffect(() => {
    const handler = () => openEditor('new');
    window.addEventListener('journada:open-new-note', handler);
    return () => window.removeEventListener('journada:open-new-note', handler);
  }, []);

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
            // Include any tag/session links the user picked BEFORE the first
            // autosave fired — otherwise those selections vanish on create.
            const res = await api.post<{ note: TrainingNote }>('/api/notes', {
              text: trimmed,
              linked_tag_ids: editorLinkedTagIds,
              linked_session_id: editorLinkedSessionId,
            });
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
          // Same as autosave: pull in current tag/session selections so a
          // user who closes the editor before the autosave debounce fires
          // doesn't lose their picks.
          await api.post('/api/notes', {
            text: trimmed,
            linked_tag_ids: editorLinkedTagIds,
            linked_session_id: editorLinkedSessionId,
          });
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

  const getNoteId = () => editorNote && typeof editorNote === 'object' ? editorNote.id : createdIdRef.current;

  const linkTechnique = async (tagId: string) => {
    if (editorLinkedTagIds.includes(tagId)) return;
    const newIds = [...editorLinkedTagIds, tagId];
    setEditorLinkedTagIds(newIds);
    setShowTechniquePicker(false);
    const noteId = getNoteId();
    if (noteId) { try { await api.put(`/api/notes/${noteId}`, { linked_tag_ids: newIds }); refetch(); } catch {} }
  };

  const unlinkTechnique = async (tagId: string) => {
    const newIds = editorLinkedTagIds.filter(id => id !== tagId);
    setEditorLinkedTagIds(newIds);
    const noteId = getNoteId();
    if (noteId) { try { await api.put(`/api/notes/${noteId}`, { linked_tag_ids: newIds }); refetch(); } catch {} }
  };

  const linkSession = async (sessionId: string) => {
    setEditorLinkedSessionId(sessionId);
    setShowSessionPicker(false);
    const noteId = getNoteId();
    if (noteId) { try { await api.put(`/api/notes/${noteId}`, { linked_session_id: sessionId }); refetch(); } catch {} }
  };

  const unlinkSession = async () => {
    setEditorLinkedSessionId(null);
    const noteId = getNoteId();
    if (noteId) { try { await api.put(`/api/notes/${noteId}`, { linked_session_id: null }); refetch(); } catch {} }
  };

  const addTag = async (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed || editorTags.includes(trimmed)) return;
    const newTags = [...editorTags, trimmed];
    setEditorTags(newTags);
    setTagInput('');
    setShowTagInput(false);
    const noteId = editorNote && typeof editorNote === 'object' ? editorNote.id : createdIdRef.current;
    if (noteId) {
      try { await api.put(`/api/notes/${noteId}`, { tags: newTags }); refetch(); } catch {}
    }
  };

  const removeTag = async (tag: string) => {
    const newTags = editorTags.filter(t => t !== tag);
    setEditorTags(newTags);
    const noteId = editorNote && typeof editorNote === 'object' ? editorNote.id : createdIdRef.current;
    if (noteId) {
      try { await api.put(`/api/notes/${noteId}`, { tags: newTags }); refetch(); } catch {}
    }
  };

  // Pin toggle: the backend already accepts `{ pinned }` on PUT /api/notes/:id
  // and pinned notes render in their own group above recents. The UI gesture
  // for toggling isn't wired yet — when we pick one (long-press menu vs.
  // swipe-right counterpart to delete), re-add a handler here.

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
    const isExisting = editorNote && typeof editorNote === 'object';
    const noteDate = isExisting
      ? new Date(editorNote.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column',
          height: `calc(${window.innerHeight}px - ${keyboardOffset}px)`,
          backgroundColor: PAGE_BG,
          padding: '0 20px',
          paddingTop: 'env(safe-area-inset-top, 16px)',
          position: 'fixed', top: 0, left: 0, right: 0,
          zIndex: 50,
          overflow: 'hidden',
        }}
      >
        {/* Top bar — date + Done */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px', flexShrink: 0 }}>
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
          <button
            onClick={closeEditor}
            style={{
              fontFamily: FONT_EDITORIAL,
              fontWeight: 700,
              fontStyle: 'normal',
              fontSize: 16,
              color: PALE_YELLOW,
              textShadow: GLOW_SOFT,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>

        {/* Writing surface — fills available space, tappable everywhere */}
        <div
          style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}
          onClick={e => {
            const ta = (e.currentTarget as HTMLElement).querySelector('textarea');
            if (ta && e.target === e.currentTarget) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
          }}
        >
        <textarea
          autoFocus
          placeholder="What's on your mind about training?"
          value={editorText}
          onChange={e => handleEditorChange(e.target.value)}
          style={{
            width: '100%',
            flex: 1,
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

        {/* Metadata + toolbar — sticky at bottom */}
        <div style={{ flexShrink: 0, paddingBottom: keyboardOffset > 0 ? 4 : 'max(12px, env(safe-area-inset-bottom, 0px))' }}>

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
          <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              autoFocus
              type="text"
              placeholder="Tag name…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
              style={{
                flex: 1, fontSize: 13, fontFamily: FONT_EDITORIAL, fontStyle: 'italic',
                padding: '8px 0', borderRadius: 0,
                backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid rgba(196,145,95,0.20)',
                color: 'white', outline: 'none',
              }}
            />
            <button
              onClick={() => addTag(tagInput)}
              style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 13, color: 'rgba(196,145,95,0.55)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Add →
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
                  backgroundColor: 'rgba(255,255,255,0.025)', border: 'none',
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
              backgroundColor: 'rgba(255,255,255,0.025)', border: 'none',
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
            backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: '8px 10px',
          }}>
            <input
              autoFocus
              type="search"
              placeholder="Search techniques…"
              value={techSearch}
              onChange={e => setTechSearch(e.target.value)}
              style={{ width: '100%', fontSize: 13, fontFamily: FONT_EDITORIAL, fontStyle: 'italic', padding: '6px 0', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'white', outline: 'none', marginBottom: 8 }}
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
            backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: '8px 10px',
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

        {/* Bottom toolbar — anchored to content, quiet */}
        <div style={{
          borderTop: '1px solid rgba(196,145,95,0.08)',
          paddingTop: 12,
          marginTop: 16,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => { setShowTechniquePicker(v => !v); setShowSessionPicker(false); }}
            style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 14, color: COPPER_BORDER, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Link technique
          </button>
          <span style={{ color: 'rgba(196,145,95,0.20)', fontSize: 12 }}>·</span>
          <button
            onClick={() => setShowTagInput(true)}
            style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 14, color: COPPER_BORDER, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Add tag
          </button>
          <span style={{ color: 'rgba(196,145,95,0.20)', fontSize: 12 }}>·</span>
          <button
            onClick={() => { setShowSessionPicker(v => !v); setShowTechniquePicker(false); }}
            style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 14, color: COPPER_BORDER, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Link session
          </button>
        </div>
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
        <SegmentedToggle<'entries' | 'intentions' | 'notes' | 'techniques'>
          size="compact"
          options={[
            { value: 'entries', label: 'Entries' },
            { value: 'intentions', label: 'Intentions' },
            { value: 'notes', label: 'Notes' },
            { value: 'techniques', label: 'Techs' },
          ]}
          value="notes"
          onChange={(v) => {
            if (v === 'entries') navigate('/journal', { replace: true });
            if (v === 'intentions') navigate('/intentions', { replace: true });
            if (v === 'techniques') navigate('/library', { replace: true });
          }}
        />
      </div>

      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 14 }}>
        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </p>

      {/* Search */}
      <input
        type="search"
        inputMode="search"
        placeholder="Search your reflections…"
        value={searchText}
        onChange={e => handleSearch(e.target.value)}
        className="w-full rounded-xl"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          padding: '12px 16px',
          color: 'rgba(255,255,255,0.90)',
          fontSize: 16,
          fontFamily: FONT_EDITORIAL,
          fontStyle: 'italic',
          outline: 'none',
          marginBottom: 18,
        }}
      />
      {/* Empty state */}
      {notes.length === 0 && !loading && !searchText && (
        <JournalEmptyState
          heroLines={['A space for thoughts', 'between sessions.']}
          supporting="Ideas, observations, and half-formed insights that don't belong to a single session."
          affordance="Write your first note →"
          onAction={() => openEditor('new')}
        />
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
            <NoteRow key={note.id} note={note} onTap={() => openEditor(note)} onDelete={handleDelete} searchQuery={searchText} />
          ))}
        </>
      )}

      {/* Recent section — with month headers */}
      {recent.length > 0 && (
        <>
          {pinned.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 10 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>Recent</span>
              <span style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
            </div>
          )}
          {(() => {
            let lastMonth = '';
            return recent.map(note => {
              const d = new Date(note.created_at);
              const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
              const monthCount = recent.filter(n => {
                const nd = new Date(n.created_at);
                return `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}` === monthKey;
              }).length;
              const showHeader = monthKey !== lastMonth;
              if (showHeader) lastMonth = monthKey;
              return (
                <div key={note.id}>
                  {showHeader && recent.length > 3 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: COPPER, opacity: 0.5 }}>
                        {monthLabel} · {monthCount}
                      </span>
                    </div>
                  )}
                  <NoteRow note={note} onTap={() => openEditor(note)} onDelete={handleDelete} searchQuery={searchText} />
                </div>
              );
            });
          })()}
        </>
      )}
    </div>
    </PageContent>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: COPPER, fontWeight: 700 }}>{text.slice(idx, idx + query.trim().length)}</span>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

function NoteRow({ note, onTap, onDelete, searchQuery = '' }: { note: TrainingNote; onTap: () => void; onDelete?: (id: string) => void; searchQuery?: string }) {
  const date = new Date(note.created_at);

  // Swipe-to-delete state
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }
    if (!isHorizontal.current) return;
    setSwipeX(Math.min(0, dx));
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (swipeX < -60) {
      setShowDelete(true);
      setSwipeX(-80);
    } else {
      setSwipeX(0);
      setShowDelete(false);
    }
  };
  const fullText = note.text.trim();
  const firstLine = fullText.split('\n')[0]?.trim() ?? '';
  const rest = fullText.slice(firstLine.length).trim();
  const bodyPreview = rest.length > 0 ? rest.replace(/\n+/g, ' ') : null;

  const day = date.getDate();
  const dow = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Delete button behind the row */}
      {showDelete && onDelete && (
        <button
          onClick={() => onDelete(note.id)}
          className="touch-manipulation"
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(239,68,68,0.85)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer',
          }}
        >
          Delete
        </button>
      )}
    <button
      onClick={() => { if (showDelete) { setShowDelete(false); setSwipeX(0); } else { onTap(); } }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="w-full text-left touch-manipulation"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 0',
        borderBottom: '1px solid rgba(196,145,95,0.08)',
        background: PAGE_BG, border: 'none',
        borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: 'rgba(196,145,95,0.08)',
        cursor: 'pointer',
        minHeight: 72,
        position: 'relative', zIndex: 1,
        transform: `translateX(${swipeX}px)`,
        transition: swiping ? 'none' : 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)',
      }}
    >
      {/* Left column — date */}
      <div style={{ flexShrink: 0, width: 36, textAlign: 'right', paddingTop: 2 }}>
        <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 18, fontWeight: 500, color: 'rgba(242,228,168,0.50)', lineHeight: 1 }}>
          {day}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)', marginTop: 2 }}>
          {dow}
        </div>
      </div>

      {/* Pin indicator */}
      {note.pinned && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: PALE_YELLOW, flexShrink: 0, marginTop: 7 }} />
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}>
          {highlightMatch(firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine, searchQuery)}
        </p>
        {bodyPreview !== null && (
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '4px 0 0',
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            lineHeight: 1.5,
          }}>
            {highlightMatch(bodyPreview!, searchQuery)}
          </p>
        )}
        {note.tags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
            {note.tags.map(tag => (
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
        )}
      </div>
    </button>
    </div>
  );
}
