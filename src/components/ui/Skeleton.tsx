// src/components/ui/Skeleton.tsx
// Unified skeleton system — Tremor-aware, emerald-accented, layout-shift-free.
// Three primitive variants + four semantic composites that mirror real section layouts.

import { cn } from "@/lib/utils";

// ─── Primitives ──────────────────────────────────────────────────────

type SkeletonVariant = "metric" | "line" | "card";

const variantStyles: Record<SkeletonVariant, string> = {
  // Matches MetricCard value: text-xl sm:text-2xl h-7 line
  metric: "h-7 w-3/4 rounded-lg bg-gradient-to-r from-gray-700/50 to-gray-800/50",
  // Matches table cell / label text: h-3 or h-4
  line: "h-4 rounded bg-gray-700/50",
  // Matches Card section placeholders: h-32 matches stacked content blocks
  card: "h-32 w-full rounded-xl bg-gray-800/50",
};

function Skeleton({
  variant = "line",
  className,
  ...props
}: {
  variant?: SkeletonVariant;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse", variantStyles[variant], className)}
      {...props}
    />
  );
}

// ─── Semantic composites ─────────────────────────────────────────────

/** Matches the MetricCard layout: title bar + value + subtitle */
function MetricSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton variant="line" className="w-1/3 h-3" />
      <Skeleton variant="metric" />
      <Skeleton variant="line" className="w-1/2 h-3" />
    </div>
  );
}

/** Matches table rows: rank + name + numeric columns.
 *  @param cols defaults to 5 (rank, name, col3, col4, col5) */
function TableRowSkeleton({
  cols = 5,
  className,
}: {
  cols?: number;
  className?: string;
}) {
  const widths = ["w-6", "flex-1", "w-24", "w-20", "w-24"];
  return (
    <div className={cn("flex items-center gap-4", className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          variant="line"
          className={widths[i] || "flex-1"}
        />
      ))}
    </div>
  );
}

/** Matches a full section heading + content blocks */
function SectionSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <Skeleton variant="line" className="w-1/4 h-5" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    </div>
  );
}

/** Matches the risk/whale row with avatar circle + text + badge */
function CircleRowSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-gray-700/50 to-gray-800/50" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-800 rounded w-32" />
            <div className="h-3 bg-gray-800 rounded w-24" />
          </div>
          <div className="h-6 bg-gray-800 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, MetricSkeleton, TableRowSkeleton, SectionSkeleton, CircleRowSkeleton };