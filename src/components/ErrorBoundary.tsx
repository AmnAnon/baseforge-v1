// src/components/ErrorBoundary.tsx
// Client-side error boundary with fallback UI for dashboard sections.

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);

    // Report to Sentry in production
    if (process.env.NODE_ENV === "production") {
      try {
        import("@sentry/nextjs").then((Sentry) => {
          Sentry.captureException(error, {
            extra: { componentStack: info.componentStack },
          });
        });
      } catch {
        // Sentry not configured
      }
    } else {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-900/50 rounded-2xl border border-red-500/20">
          <p className="text-red-400 font-semibold mb-2">
            Something went wrong in this section
          </p>
          <p className="text-xs text-gray-500 mb-4 max-w-md text-center">
            {this.state.error?.message ?? "Unknown error"}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-sm bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 rounded-lg transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Suspense-compatible loading skeleton — reuse across sections
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
