// Error boundary — catches render errors in a subtree and shows a fallback
// instead of crashing the whole page.
//
// React requires error boundaries to be class components (hooks cannot catch
// render-phase errors). This is a minimal implementation.

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Defaults to a muted error caption. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <p className="text-sm py-4" style={{ color: 'rgba(255,100,100,0.6)' }}>
          Something went wrong loading this section.
        </p>
      );
    }
    return this.props.children;
  }
}
