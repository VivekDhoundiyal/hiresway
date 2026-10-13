import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RouteErrorBoundary] Route render error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-2xl mx-auto my-8 p-6 bg-white rounded-2xl border border-red-200 shadow-sm text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-gray-900">
              Unable to load this section
            </h2>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              An error occurred while loading this view. Your data and navigation are intact.
            </p>
            {this.state.error?.message && (
              <div className="p-2.5 mt-2 rounded-lg bg-gray-50 border border-gray-200 text-left text-xs font-mono text-gray-700 break-words max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Retry Section
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
