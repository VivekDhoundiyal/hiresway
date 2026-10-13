import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackType?: 'page' | 'card';
  companyName?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class TargetCompanyErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[TargetCompanyErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackType === 'card') {
        return (
          <div className="bg-white rounded-xl border border-red-200 p-4 shadow-3xs flex flex-col justify-between h-full space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {this.props.companyName || 'Company Record'}
                </p>
                <p className="text-[11px] text-red-600 leading-normal">
                  Rendering error. Card recovered safely.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end pt-2 border-t border-red-100">
              <button
                type="button"
                onClick={this.handleRetry}
                className="text-[11px] font-semibold text-red-700 hover:text-red-800 inline-flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          </div>
        );
      }

      // Page-level fallback
      return (
        <div className="p-8 max-w-2xl mx-auto my-8 bg-white rounded-2xl border border-red-200 shadow-sm text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-gray-900">
              Failed to display Target Companies
            </h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              A rendering issue occurred while displaying your monitored company list. Your persisted records are safe in storage.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Reload Page
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={this.handleRetry}
              className="text-xs font-semibold"
            >
              Recover View
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
