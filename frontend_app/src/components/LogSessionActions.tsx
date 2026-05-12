// LogSessionActions — error message + Cancel/Save action row.
//
// The bottom of LogSessionForm. On desktop sits in the grid as a full-width
// row with a copper hairline above; on mobile is a flat flex row (the parent
// renders its own hairline divider above this component on mobile).
//
// Pure presentation — all state lives in the parent LogSessionForm.
// Extracted from LogSessionForm.tsx during the 2026-05-08 refactor.

interface ActionsProps {
  loading: boolean;
  error: string;
  onCancel?: () => void;
  isDesktop: boolean;
}

export default function LogSessionActions({
  loading,
  error,
  onCancel,
  isDesktop,
}: ActionsProps) {
  return (
    <>
      {error && (
        <p
          className="text-red-400 text-sm"
          style={isDesktop ? { gridColumn: '1 / -1', margin: 0 } : undefined}
        >
          {error}
        </p>
      )}

      <div
        className={isDesktop ? 'flex items-center gap-3 pt-2' : 'flex items-center gap-3'}
        style={isDesktop
          ? { borderTop: '1px solid rgba(196,145,95,0.12)', gridColumn: '1 / -1', marginTop: 4 }
          : undefined}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 text-sm font-medium transition-colors touch-manipulation"
            style={{ color: 'rgba(255,255,255,0.40)' }}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 text-white font-semibold rounded-xl transition-all touch-manipulation disabled:opacity-50"
          style={{
            height: 52,
            backgroundColor: '#DA7422',
            boxShadow: '0 2px 12px rgba(218,116,34,0.25)',
            fontSize: 16,
          }}
        >
          {loading ? 'Saving...' : 'Save Session'}
        </button>
      </div>
    </>
  );
}
