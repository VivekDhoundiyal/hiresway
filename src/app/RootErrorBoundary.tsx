import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Fatal application render error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-200 shadow-xl p-8 text-center space-y-6">
            <div className="h-14 w-14 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                CareerOS Encountered an Error
              </h1>
              <p className="text-xs text-gray-500 leading-relaxed">
                An unexpected issue interrupted the view, but your saved data, jobs, and target companies remain safely preserved in persistent storage.
              </p>
              {this.state.error?.message && (
                <div className="p-3 mt-3 rounded-lg bg-red-50/70 border border-red-200 text-left text-xs font-mono text-red-800 break-words max-h-32 overflow-y-auto">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                leftIcon={<Home className="h-3.5 w-3.5" />}
                className="text-xs"
              >
                Go to Dashboard
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={this.handleReload}
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                className="text-xs font-semibold"
              >
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
