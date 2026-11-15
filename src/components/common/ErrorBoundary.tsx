import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { repository } from '@/data/repository';
import { APP_NAME } from '@/constants/app';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleResetDatabase = async () => {
    if (
      window.confirm(
        'Warning: This will clear the local database and reload the default seed data. Proceed?'
      )
    ) {
      try {
        await repository.clearAll();
        window.location.reload();
      } catch (e) {
        console.error('Failed to clear database:', e);
        window.location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream-100 dark:bg-dark-bg p-6">
          <div className="max-w-lg w-full bg-white dark:bg-dark-surface rounded-card p-8 border border-cream-300 dark:border-dark-border shadow-modal text-center">
            <div className="w-16 h-16 rounded-full bg-status-danger/10 text-status-danger flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h1 className="text-2xl font-bold text-deep-blue-500 dark:text-cream-100 mb-2">
              Something went wrong
            </h1>
            
            <p className="text-sm text-deep-blue-700/80 dark:text-cream-300 mb-6 leading-relaxed">
              {APP_NAME} encountered an unexpected error. Your financial data is safely stored in local IndexedDB.
            </p>

            {this.state.error && (
              <div className="mb-6 p-4 rounded-lg bg-cream-50 dark:bg-dark-elevated text-left text-xs font-mono text-status-danger overflow-x-auto max-h-40 border border-cream-200 dark:border-dark-border">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-deep-blue-500 hover:bg-deep-blue-600 text-cream-100 font-medium text-sm transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>

              <button
                onClick={this.handleResetDatabase}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-status-danger/30 text-status-danger hover:bg-status-danger/10 font-medium text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Reset Corrupted Storage
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
