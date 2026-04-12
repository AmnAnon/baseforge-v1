// src/components/ErrorBoundary.tsx
// Production-grade error boundary with Sentry integration, retry logic,
// and section-specific fallback UI.

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Custom fallback UI. If not provided, uses the default error card. */
  fallback?: ReactNode;
  /** Called when an error is caught — use for logging/analytics. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Section name shown in the error card. */
  section?: string;
  /** Whether to show a "try again" button (default: true). */
  retryable?: boolean;
  /** Max automatic retries before giving up (default: 2). */
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { section, onError } = this.props;

    // User callback
    onError?.(error, info);

    // Sentry reporting (production only)
    if (typeof window !== "undefined") {
      try {
        import("@sentry/nextjs").then((Sentry) => {
          Sentry.withScope((scope) => {
            scope.setTag("section", section || "unknown");
            scope.setTag("retryCount", String(this.state.retryCount));
            scope.setLevel("error");
            scope.setContext("component", {
              componentStack: info.componentStack,
              section,
            });
            Sentry.captureException(error);
          });
        }).catch(() => {});
      } catch {
        // Sentry not available
      }
    }

    // Structured log for server-side errors
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[ErrorBoundary${section ? `:${section}` : ""}]`,
        error.message,
        "\n",
        info.componentStack
      );
    }
  }

  handleRetry = () => {
    const maxRetries = this.props.maxRetries ?? 2;
    if (this.state.retryCount >= maxRetries) return;

    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  handleToggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { section, retryable = true, maxRetries = 2 } = this.props;
    const { error, retryCount, showDetails } = this.state;
    const canRetry = retryable && retryCount < maxRetries;

    return (
      <div
        className="flex flex-col items-center justify-center p-8 bg-gray-900/50 rounded-2xl border border-red-500/20"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden />
          <p className="text-red-400 font-semibold">
            {section ? `${section} failed to load` : "Something went wrong"}
          </p>
        </div>

        <p className="text-xs text-gray-500 mb-4 max-w-md text-center">
          This section encountered an error. The rest of the dashboard is unaffected.
          {retryCount > 0 && ` (Retry ${retryCount}/${maxRetries})`}
        </p>

        <div className="flex items-center gap-3">
          {canRetry && (
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 rounded-lg transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
          {!canRetry && retryCount > 0 && (
            <p className="text-xs text-gray-600">
              Max retries reached. Reload the page to try again.
            </p>
          )}
        </div>

        {/* Collapsible error details (dev + production) */}
        {error && (
          <div className="mt-4 w-full max-w-md">
            <button
              onClick={this.handleToggleDetails}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showDetails ? "Hide" : "Show"} error details
            </button>
            {showDetails && (
              <pre className="mt-2 p-3 bg-black/50 rounded-lg text-xs text-red-400/70 overflow-auto max-h-32 border border-gray-800">
                {error.message}
                {error.stack && `\n\n${error.stack.split("\n").slice(1, 5).join("\n")}`}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  }
}

// Re-export the skeleton for backward compatibility
export function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-label="Loading" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 bg-gray-800/50 rounded-lg" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
