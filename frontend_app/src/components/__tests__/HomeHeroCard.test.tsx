import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import HomeHeroCard from '../HomeHeroCard';
import type { PromotionAnniversary } from '@/lib/homeViewModel';
import type { SessionSummary } from '@/types/api';

const session: SessionSummary = {
  id: 's1', date: '2023-07-25', duration: 60, intensity: 3, gi_nogi: 'gi',
  session_type: 'class', tags: [], notes: 'Tied on after class.',
};

function renderDeck(anniversary: PromotionAnniversary | null, onReadEntry = vi.fn(), onLog = vi.fn()) {
  render(
    <HomeHeroCard
      unfinishedEntry={null}
      memoryEntry={null}
      anniversary={anniversary}
      activeIntention={null}
      intentionWeeksIn={0}
      intentionTouchedCount={0}
      techniqueCards={[]}
      pastIntentions={[]}
      techniquesForIntention={() => []}
      hasAnySessions
      onKeepWriting={vi.fn()}
      onReadEntry={onReadEntry}
      onOpenIntention={vi.fn()}
      onOpenPastIntention={vi.fn()}
      onOpenTechnique={vi.fn()}
      onLog={onLog}
    />,
  );
  return { onReadEntry, onLog };
}

describe('HomeHeroCard — promotion anniversary', () => {
  it('leads with the belt and opens the linked entry', async () => {
    const { onReadEntry } = renderDeck({
      promotion: { id: 'p', belt_rank: 'blue', stripes: 0, promoted_at: '2023-07-25', notes: null, session_id: 's1' },
      years: 3, label: '3 years ago today', session,
    });
    expect(screen.getByText('3 years ago today')).toBeInTheDocument();
    expect(screen.getByText('Blue belt')).toBeInTheDocument();
    expect(screen.getByText('Tied on after class.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /read it/i }));
    expect(onReadEntry).toHaveBeenCalledWith(session);
  });

  it('offers logging today when no entry is linked', async () => {
    const { onLog } = renderDeck({
      promotion: { id: 'p', belt_rank: 'purple', stripes: 1, promoted_at: '2025-07-25', notes: 'Worth every round.', session_id: null },
      years: 1, label: 'A year ago today', session: null,
    });
    expect(screen.getByText('Purple belt, first stripe')).toBeInTheDocument();
    expect(screen.getByText('Worth every round.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /read it/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /log today/i }));
    expect(onLog).toHaveBeenCalled();
  });
});
