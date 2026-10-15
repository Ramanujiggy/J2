// IntentionsMobileView — the mobile (single-column) layout for the
// Intentions page. Search + filter chips + Timeline-or-Eras toggle, plus
// the timeline cards (no week-level grid) or stacked compact EraCards.
//
// Owns its own search/filter state (`mobileQuery`, `mobileFilter`); the
// parent owns the layout-toggle preference and the create/edit modal
// state. Renders the same `<Coachmark>` the parent's desktop branch
// renders, so the hook output is passed in.
//
// Extracted from IntentionsPage.tsx during the 2026-05-09 refactor pass.

import { useMemo, useState } from 'react';
import JournalEmptyState from '../JournalEmptyState.tsx';
import { Pencil } from 'lucide-react';
import { COPPER, COPPER_BORDER, GLOW_SOFT, PALE_YELLOW, SURFACE_2, TEXT_PRIMARY, TEXT_TERTIARY, TEXT_HINT, TEXT_DISABLED, CATEGORY_PILL_STYLE } from '../../lib/theme.ts';
import { SKILL_TAGS } from '../../lib/constants.ts';
import { computeAlignment, tagHoursInRange, topTagInRange } from '../../lib/analyticsUtils.ts';
import type { Intention, SessionSummary } from '../../types/api.ts';
import PageContent from '../PageContent.tsx';
import SetIntentionModal from '../SetIntentionModal.tsx';
import SegmentedToggle from '../SegmentedToggle.tsx';
import Coachmark from '../Coachmark.tsx';
import {
  type IntentionsLayout, type IntentionStats,
} from './intentionsTypes.ts';
import { computeEras } from './computeEras.ts';
import { EraCard } from './IntentionsEras.tsx';

interface CoachmarkHandle {
  isOpen: boolean;
  dismiss: () => void;
}

interface MobileViewProps {
  intentions: Intention[];
  sessions: SessionSummary[];
  loading: boolean;
  intentionsEnabled: boolean;
  editTarget: Intention | null;
  createOpen: boolean;
  layout: IntentionsLayout;
  onLayoutChange: (next: IntentionsLayout) => void;
  statsMap: Map<string, IntentionStats>;
  onOpenCreate: () => void;
  onOpenEdit: (intention: Intention) => void;
  onCloseModal: () => void;
  onSaved: () => void;
  onNavigate: (path: string, opts?: { replace?: boolean; state?: Record<string, unknown> }) => void;
  intentionsCoachmark: CoachmarkHandle;
}

type MobileFilter = 'All' | string; // 'All' or a SKILL_TAGS heading

export default function IntentionsMobileView({
  intentions, sessions, loading, intentionsEnabled,
  editTarget, createOpen,
  layout, onLayoutChange, statsMap,
  onOpenCreate, onCloseModal, onSaved, onNavigate,
  intentionsCoachmark,
  // onOpenEdit is part of the prop contract for parity with the desktop view
  // (which keeps it for the same reason). Mobile doesn't render an inline edit
  // button right now; reintroduce if product asks.
}: MobileViewProps) {
  // ── Mobile-only search + filter (parallels JournalIndexPage's pattern) ──
  // Search matches against intent_label + the intention's own journal_entry
  // text + heading label. Filter chip narrows by pillar (heading). Both
  // apply to the source list before eras / timeline render so the user's
  // filter persists across layout-toggle flips.
  const [mobileQuery, setMobileQuery] = useState('');
  const [mobileFilter, setMobileFilter] = useState<MobileFilter>('All');

  const mobileFilteredIntentions = useMemo(() => {
    return intentions
      .filter(i => mobileFilter === 'All' || i.heading === mobileFilter)
      .filter(i => {
        if (!mobileQuery.trim()) return true;
        const q = mobileQuery.toLowerCase();
        const headingLabel = i.heading
          ? (SKILL_TAGS.find(s => s.value === i.heading)?.label ?? i.heading)
          : '';
        return [i.intent_label, i.journal_entry, headingLabel]
          .some(v => v?.toLowerCase().includes(q));
      });
  }, [intentions, mobileFilter, mobileQuery]);

  const mobileEras = computeEras(mobileFilteredIntentions);

  return (
    <PageContent ready={!loading} loadingMessages={['Loading your intentions...']}>
    <div className="mx-auto space-y-5 max-w-5xl px-4 sm:px-6 py-6">

      {/* Title row — title left, surface toggle inline-right. Synced with
          the matching toggle on JournalIndexPage so users can swap views
          without round-tripping through the bottom nav. */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2
            style={{
              fontFamily: 'var(--font-editorial)',
              fontWeight: 500,
              color: PALE_YELLOW,
              textShadow: GLOW_SOFT,
              fontSize: 28,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Journal
          </h2>
          <SegmentedToggle<'entries' | 'intentions' | 'notes' | 'techniques'>
            size="compact"
            options={[
              { value: 'entries',    label: 'Entries' },
              { value: 'intentions', label: 'Intentions' },
              { value: 'notes',      label: 'Notes' },
              { value: 'techniques', label: 'Techs' },
            ]}
            value="intentions"
            onChange={(v) => {
              if (v === 'entries') onNavigate('/journal', { replace: true });
              if (v === 'notes') onNavigate('/notes', { replace: true });
              if (v === 'techniques') onNavigate('/library', { replace: true });
            }}
          />
        </div>
        <p style={{ color: TEXT_TERTIARY, fontSize: 13, marginTop: 4 }}>
          {intentions.length} {intentions.length === 1 ? 'intention' : 'intentions'}
        </p>
      </div>

      {!intentionsEnabled && (
        <div
          className="rounded-xl px-4 py-2.5 text-sm"
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)', color: TEXT_HINT }}
        >
          Intentions are currently disabled — viewing history only.
        </div>
      )}

      {/* Search + filter chips — parallels JournalIndexPage's mobile pattern.
          Hidden on the empty-source state (no intentions exist at all) since
          there's nothing to search. Applies to both Timeline and Eras layouts
          (eras computed from `mobileFilteredIntentions`). */}
      {intentions.length > 0 && (
        <>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Search intentions…"
            value={mobileQuery}
            onChange={e => setMobileQuery(e.target.value)}
            className="w-full rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              padding: '12px 16px',
              color: TEXT_PRIMARY,
              fontSize: 16,
              fontFamily: 'var(--font-editorial)',
              fontStyle: 'italic',
              outline: 'none',
            }}
          />

          <div
            className="flex gap-2 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none' }}
          >
            {(['All', ...SKILL_TAGS.map(t => t.value)] as MobileFilter[]).map(v => {
              const label = v === 'All' ? 'All' : (SKILL_TAGS.find(t => t.value === v)?.label ?? v);
              const active = mobileFilter === v;
              return (
                <button
                  key={v}
                  onClick={() => setMobileFilter(v)}
                  className="touch-manipulation"
                  style={{
                    flexShrink: 0,
                    height: 32, padding: '0 14px',
                    fontSize: 12, fontWeight: 600,
                    background: active ? 'rgba(196,145,95,0.16)' : 'var(--j2-surface-2)',
                    border: `1px solid ${active ? COPPER : 'var(--j2-border-1)'}`,
                    borderRadius: 999,
                    color: active ? PALE_YELLOW : 'rgba(255,255,255,0.55)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Layout toggle — same Timeline ↔ Eras choice the desktop view offers.
          Hidden on the empty state since there's nothing to switch between. */}
      {intentions.length > 0 && (
        <SegmentedToggle<IntentionsLayout>
          size="compact"
          options={[
            { value: 'timeline', label: 'Timeline' },
            { value: 'eras',     label: 'Eras' },
          ]}
          value={layout}
          onChange={v => v && onLayoutChange(v)}
        />
      )}

      {intentions.length === 0 ? (
        <JournalEmptyState
          heroLines={['A focus to return to.']}
          supporting="Declare what you're working on, and your sessions will tell you whether you're following through."
          affordance="Declare your first intention →"
          onAction={onOpenCreate}
        />
      ) : mobileFilteredIntentions.length === 0 ? (
        /* ── No-matches state (filter or search yields zero) ── */
        <div
          className="rounded-xl px-6 py-8 text-center"
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="text-sm" style={{ color: TEXT_TERTIARY }}>
            No intentions match.
          </p>
          <p className="text-xs mt-1" style={{ color: TEXT_HINT }}>
            Adjust the search or filter.
          </p>
        </div>
      ) : layout === 'eras' ? (
        /* ── Eras layout (mobile) ───────────────────────────── */
        <div className="space-y-0">
          {mobileEras.map((era, idx) => (
            <EraCard
              key={`${era.firstWk}-${era.focus}-${idx}`}
              era={era}
              statsMap={statsMap}
              compact
              onOpen={() => onNavigate(`/intentions/${era.weeks[0]!.id}/journal`, { state: { from: '/intentions' } })}
            />
          ))}
        </div>
      ) : (
        /* ── Timeline cards (mobile) ────────────────────────── */
        <div className="space-y-3">
          {mobileFilteredIntentions.map(intention => {
            const headingLabel = intention.heading
              ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
              : null;
            const topTag        = topTagInRange(sessions, intention.week_start, intention.duration_days);
            const ambient       = topTag?.label ?? null;
            const hours         = tagHoursInRange(sessions, intention.week_start, intention.duration_days);
            const alignment     = computeAlignment(intention, topTag, hours);
            const hasJournal    = !!intention.journal_entry;
            const journalSnippet = hasJournal
              ? intention.journal_entry!.slice(0, 40) + (intention.journal_entry!.length > 40 ? '...' : '')
              : null;

            return (
              <button
                key={intention.id}
                onClick={() => onNavigate(`/intentions/${intention.id}/journal`, { state: { from: '/intentions' } })}
                className="w-full text-left touch-manipulation"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '14px 0',
                  borderBottom: '1px solid rgba(196,145,95,0.08)',
                  background: 'none', border: 'none',
                  borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: 'rgba(196,145,95,0.08)',
                  cursor: 'pointer',
                }}
              >
                {/* Left column — date + duration */}
                <div style={{ flexShrink: 0, width: 52, textAlign: 'right', paddingTop: 2 }}>
                  <div style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 16, color: 'rgba(242,228,168,0.50)', lineHeight: 1 }}>
                    {new Date(intention.week_start + 'T00:00:00').getDate()}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: TEXT_HINT, marginTop: 2 }}>
                    {new Date(intention.week_start + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                  </div>
                  <div style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 10, color: 'rgba(196,145,95,0.35)', marginTop: 3 }}>
                    {intention.duration_days}d
                  </div>
                </div>

                {/* Right column — dot + heading + alignment */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    {intention.intent_category && <span style={{ ...CATEGORY_PILL_STYLE, flexShrink: 0 }}>{intention.intent_category}</span>}
                    <span style={{ fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>
                      {headingLabel ?? intention.intent_label}
                    </span>
                  </div>
                  {headingLabel && intention.intent_label && intention.intent_label.toLowerCase() !== (headingLabel ?? '').toLowerCase() && (
                    <p style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 13, color: TEXT_TERTIARY, margin: '0 0 4px' }}>
                      {intention.intent_label}
                    </p>
                  )}
                  {/* Alignment + trained */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <div style={{ width: 24, height: 2, borderRadius: 2, backgroundColor: alignment.status === 'aligned' ? 'rgba(82,181,108,0.70)' : alignment.status === 'diverged' ? 'rgba(218,116,34,0.50)' : 'rgba(255,255,255,0.06)' }} />
                    {ambient ? (
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-editorial)', fontStyle: 'italic', color: 'rgba(196,145,95,0.50)' }}>
                        Trained: {ambient}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontStyle: 'italic', color: TEXT_DISABLED }}>No sessions</span>
                    )}
                  </div>
                  {/* Journal snippet */}
                  {hasJournal && (
                    <p style={{ fontSize: 12, fontFamily: 'var(--font-editorial)', fontStyle: 'italic', color: 'rgba(242,228,168,0.35)', margin: '6px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {journalSnippet}
                    </p>
                  )}
                  {/* Technique count badge */}
                  {(intention.user_tag_ids?.length ?? 0) > 0 && (
                    <span style={{ fontSize: 10, color: COPPER_BORDER, fontWeight: 600, letterSpacing: '0.08em', marginTop: 4, display: 'inline-block' }}>
                      {intention.user_tag_ids!.length} tech{intention.user_tag_ids!.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Right affordance */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, paddingTop: 2 }}>
                  <button
                    onClick={e => { e.stopPropagation(); onNavigate(`/intentions/${intention.id}/journal`, { state: { from: '/intentions' } }); }}
                    className="touch-manipulation"
                    style={{ color: TEXT_DISABLED, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  >
                    <Pencil size={12} />
                  </button>
                  {!hasJournal && (
                    <span style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 12, color: COPPER, opacity: 0.5 }}>
                      + Write
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Edit / create modal */}
      {(editTarget || createOpen) && (
        <SetIntentionModal
          editIntention={editTarget ?? undefined}
          onSaved={() => { onSaved(); onCloseModal(); }}
          onClose={onCloseModal}
        />
      )}

      <Coachmark
        open={intentionsCoachmark.isOpen}
        onDismiss={intentionsCoachmark.dismiss}
        eyebrow="◇ Intentions"
        title="Set what you're working on this week."
        body="We'll surface it on every session you log — and look back on whether you trained it."
      />
    </div>
    </PageContent>
  );
}
