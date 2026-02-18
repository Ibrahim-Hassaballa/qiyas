import { Component } from 'react';
import { AlertTriangle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false, retryKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('[AdminErrorBoundary]', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      showDetails: false,
      retryKey: prev.retryKey + 1,
    }));
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      const { showDetails, error } = this.state;
      const t = this.props.t;

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center" aria-live="assertive">
          <div className="p-3 rounded-xl status-danger mb-4">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-sm font-semibold app-title mb-1">
            {t?.('admin.somethingWentWrong') || 'Something went wrong'}
          </h3>
          <p className="text-xs app-muted mb-4 max-w-xs">
            {t?.('admin.sectionError') || 'This section encountered an error. Other sections are unaffected.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-lg btn-primary text-sm font-medium focus-ring"
            >
              <RotateCcw size={14} />
              {t?.('admin.tryAgain') || 'Try again'}
            </button>
            <button
              onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
              className="flex items-center gap-2 px-4 py-2 rounded-lg btn-secondary text-sm font-medium focus-ring"
              aria-expanded={showDetails}
            >
              {t?.('admin.errorDetails') || 'Error details'}
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
          {showDetails && error && (
            <pre className="mt-4 p-4 rounded-lg app-surface-subtle text-xs text-start app-muted overflow-auto max-w-full max-h-40 w-full">
              {error.toString()}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          )}
        </div>
      );
    }

    return <div key={this.state.retryKey} className={this.props.className}>{this.props.children}</div>;
  }
}

export default AdminErrorBoundary;
