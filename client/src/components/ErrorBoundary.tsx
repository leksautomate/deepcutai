import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors
 * Prevents entire app from crashing due to component errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(_: Error): Partial<ErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }

        // Call optional error callback
        this.props.onError?.(error, errorInfo);

        // Update state with error details
        this.setState({
            error,
            errorInfo,
        });

        // TODO: Send to error tracking service (e.g., Sentry)
        // logError('ErrorBoundary', error.message, error);
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="flex items-center justify-center min-h-screen bg-background p-4">
                    <div className="max-w-md w-full space-y-4 text-center">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-destructive" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-semibold">Something went wrong</h2>
                            <p className="text-muted-foreground">
                                We encountered an unexpected error. Please try refreshing the page.
                            </p>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mt-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg text-left">
                                <p className="text-sm font-mono text-destructive break-words">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <details className="mt-2">
                                        <summary className="text-xs text-muted-foreground cursor-pointer">
                                            Stack trace
                                        </summary>
                                        <pre className="mt-2 text-xs overflow-auto max-h-48 text-muted-foreground">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 justify-center">
                            <Button onClick={this.handleReset} variant="default">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Try Again
                            </Button>
                            <Button onClick={() => window.location.href = '/'} variant="outline">
                                Go Home
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook-based wrapper for functional components
 */
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
): React.FC<P> {
    return function WithErrorBoundaryWrapper(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
