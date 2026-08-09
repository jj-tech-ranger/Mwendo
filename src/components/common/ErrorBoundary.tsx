import { Component, ReactNode, ErrorInfo } from 'react';
import { EmptyState } from '../ui/EmptyState';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-md bg-background">
          <EmptyState
            icon="error_med"
            title="Something went wrong"
            description={this.state.error?.message || 'An unexpected runtime error occurred.'}
            primaryCtaLabel="Reload App"
            onPrimaryCta={() => window.location.reload()}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
