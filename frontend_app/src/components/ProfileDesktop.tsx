// ProfileDesktop — the account screen, and the only screen with counts.
//
// Left: who you are, the belt (click it to record a promotion), the
// promotions you've recorded, the collection, and a door to Atlas.
// Right: housekeeping — the settings that are chores, kept as quiet rows
// so they never compete with the belt.
//
// All analytics live on Atlas. What's here is identity, not measurement.
//
// Undiscovered dies render as dashed empty circles and are NEVER named:
// naming them turns the collection into a checklist, which is the feeling
// removing the streak was meant to eliminate.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FlatBelt from './belt/FlatBelt.tsx';
import PromotionSheet from './belt/PromotionSheet.tsx';
import SealStamp from './seal/SealStamp.tsx';
import HomePortrait from './HomePortrait.tsx';
import { STAMP_DIES, bandDate } from '../lib/stampDies.ts';
import { beltDisplayName, isBeltRank, type BeltRankKey } from '../lib/beltCloth.ts';
import { PALE_YELLOW, FONT_EDITORIAL } from '../lib/theme.ts';
import type { BeltHistoryEntry, EarnedStamp, PillarDistribution } from '../types/api.ts';

const TEXT_SECONDARY = 'rgba(255,255,255,0.66)';
const TEXT_TERTIARY  = 'rgba(255,255,255,0.46)';
const TEXT_HINT      = 'rgba(255,255,255,0.26)';
const HAIRLINE       = '1px solid rgba(255,255,255,0.06)';

/** How many slots the shelf shows. Enough to imply there is more without
 *  suggesting a finite checklist to complete. */
const SHELF_SLOTS = 4;

const LABEL: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700,
  letterSpacing: '0.15em', textTransform: 'uppercase',
  color: TEXT_TERTIARY,
};

export interface HousekeepingRow {
  title: string;
  subtitle: string;
  onClick: () => void;
}

interface Props {
  name: string | null;
  beltRank: string | null;
  stripes: number;
  academy?: string | null;
  /** Year the practitioner started, when we know it. */
  trainingSince?: string | null;
  beltEntries: BeltHistoryEntry[];
  stamps: Map<string, EarnedStamp>;
  portraitShapes: PillarDistribution[];
  sessionCount: number;
  savingPromotion?: boolean;
  onRecordPromotion: (next: { rank: BeltRankKey; stripes: number; promotedAt: string }) => void;
  housekeeping: { heading: string; rows: HousekeepingRow[] }[];
}

export default function ProfileDesktop({
  name, beltRank, stripes, academy, trainingSince,
  beltEntries, stamps, portraitShapes, sessionCount,
  savingPromotion, onRecordPromotion, housekeeping,
}: Props) {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const rank: BeltRankKey = isBeltRank(beltRank) ? beltRank : 'white';

  const earned = useMemo(
    () => [...stamps.values()].sort((a, b) => a.die_key.localeCompare(b.die_key)),
    [stamps],
  );
  const emptySlots = Math.max(0, SHELF_SLOTS - earned.length);

  // The most recent promotion is what the belt was "tied on".
  const tiedOn = beltEntries[0]?.promoted_at ?? null;
  const tiedOnLabel = tiedOn
    ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
        .format(new Date(tiedOn.slice(0, 10) + 'T00:00:00'))
    : null;

  const subtitle = [
    beltDisplayName(rank, stripes),
    academy,
    trainingSince ? `training since ${trainingSince}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="j2-desk-page">
      <div className="j2-profile-body">
        {/* ── Identity ─────────────────────────────────────────────── */}
        <div className="j2-profile-main">
          <div style={LABEL}>Profile</div>
          <h1
            style={{
              fontFamily: FONT_EDITORIAL, fontSize: 33, fontWeight: 600,
              color: PALE_YELLOW, letterSpacing: '-0.01em', margin: '8px 0 0',
            }}
          >
            {name ?? 'Practitioner'}
          </h1>
          <div
            style={{
              fontFamily: FONT_EDITORIAL, fontSize: 16, fontStyle: 'italic',
              color: TEXT_SECONDARY, marginTop: 8,
            }}
          >
            {subtitle}
          </div>

          {/* The belt */}
          <div style={{ marginTop: 24 }}>
            <FlatBelt
              rank={rank}
              stripes={stripes}
              maxWidth={420}
              onClick={() => setSheetOpen(true)}
              title="Record a promotion"
            />
          </div>
          <div style={{ fontSize: 11.5, color: TEXT_TERTIARY, marginTop: 10 }}>
            {tiedOnLabel ? `Tied on ${tiedOnLabel} · ` : ''}click the belt to record a promotion
          </div>

          {/* Promotions */}
          {beltEntries.length > 0 && (
            <div style={{ marginTop: 20, maxWidth: 420 }}>
              {beltEntries.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 16, padding: '10px 0', borderTop: HAIRLINE,
                  }}
                >
                  <span style={{ fontFamily: FONT_EDITORIAL, fontSize: 18, color: TEXT_SECONDARY }}>
                    {beltDisplayName(isBeltRank(entry.belt_rank) ? entry.belt_rank : 'white', entry.stripes)}
                  </span>
                  <span style={{ fontSize: 11, color: TEXT_TERTIARY, whiteSpace: 'nowrap' }}>
                    {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
                      .format(new Date(entry.promoted_at.slice(0, 10) + 'T00:00:00'))}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* The collection */}
          <div style={{ ...LABEL, marginTop: 34 }}>The collection</div>
          <div style={{ display: 'flex', gap: 26, alignItems: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            {earned.map(stamp => {
              const die = STAMP_DIES[stamp.die_key];
              if (!die) return null;
              return (
                <button
                  key={stamp.die_key}
                  type="button"
                  onClick={() => navigate('/profile/collection')}
                  aria-label={`${die.name} — open the collection`}
                  style={{ background: 'none', border: 'none', padding: 0, lineHeight: 0, cursor: 'pointer' }}
                >
                  <SealStamp
                    die={die}
                    top={bandDate(stamp.last_struck_at)}
                    size={96}
                    style={{ transform: 'rotate(-8deg)' }}
                  />
                </button>
              );
            })}
            {Array.from({ length: emptySlots }, (_, i) => (
              <span
                key={`empty-${i}`}
                aria-hidden
                style={{
                  width: 88, height: 88, borderRadius: '50%',
                  border: '2px dashed rgba(255,255,255,0.13)', flex: 'none',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 14 }}>
            {earned.length === 0
              ? 'Nothing struck yet. They arrive on the mat, not from a list.'
              : `${earned.map(s => STAMP_DIES[s.die_key]?.name ?? s.die_key).join(' · ')}. The others are not yet yours to know about.`}
          </div>

          {/* Door to Atlas */}
          {portraitShapes.length > 0 && (
            <div style={{ marginTop: 30, paddingTop: 20, borderTop: HAIRLINE }}>
              <HomePortrait shapes={portraitShapes} sessionCount={sessionCount} variant="desk" />
            </div>
          )}
        </div>

        {/* ── Housekeeping ─────────────────────────────────────────── */}
        <div className="j2-profile-side">
          {housekeeping.map((section, si) => (
            <div key={section.heading}>
              <div style={{ ...LABEL, margin: si === 0 ? '0 0 12px' : '26px 0 12px' }}>
                {section.heading}
              </div>
              {section.rows.map(row => (
                <button
                  key={row.title}
                  type="button"
                  onClick={row.onClick}
                  className="j2-hk-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 15, width: '100%',
                    border: HAIRLINE, borderRadius: 14, padding: '17px 19px',
                    marginBottom: 12, background: 'none', textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: TEXT_SECONDARY }}>
                      {row.title}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: TEXT_TERTIARY, marginTop: 3, lineHeight: 1.5 }}>
                      {row.subtitle}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: TEXT_HINT, fontSize: 17 }}>›</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <PromotionSheet
        open={sheetOpen}
        rank={rank}
        stripes={stripes}
        academy={academy}
        saving={savingPromotion}
        onClose={() => setSheetOpen(false)}
        onCommit={next => { setSheetOpen(false); onRecordPromotion(next); }}
      />
    </div>
  );
}
