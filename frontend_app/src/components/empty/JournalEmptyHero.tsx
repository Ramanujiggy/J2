import JournalEmptyState from '../JournalEmptyState.tsx';

export default function JournalEmptyHero() {
  return (
    <JournalEmptyState
      heroLines={['Empty.', 'But full of possibilities.']}
      supporting="Each session you log adds a page."
      affordance="Log your first session →"
      onAction={() => {
        window.dispatchEvent(new CustomEvent('journada:open-log-form', { detail: {} }));
      }}
    />
  );
}
