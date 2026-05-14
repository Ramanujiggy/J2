import JournalEmptyState from './JournalEmptyState.tsx';

interface Props {
  onLogFirst: () => void;
}

export default function FirstVisitCard({ onLogFirst }: Props) {
  return (
    <JournalEmptyState
      inline
      heroLines={['Your training story', 'starts here.']}
      supporting="Track your sessions, set intentions, and watch your game evolve."
      affordance="Log your first session →"
      onAction={onLogFirst}
    />
  );
}
