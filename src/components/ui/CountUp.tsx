"use client";

import { useEffect, useState } from "react";
import { animate, MotionValue, useMotionValue } from "framer-motion";
import { formatUsdCompact } from "@/lib/utils";

interface CountUpProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  /** Format large USD values as $3.42B / $12.5M instead of raw digits */
  compact?: boolean;
}

function formatCompactValue(value: number, decimals: number, prefix: string, suffix: string): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${prefix}${(value / 1_000_000_000).toFixed(2)}B${suffix}`;
  if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(2)}M${suffix}`;
  if (abs >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K${suffix}`;
  return `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
}

export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.5,
  className = "",
  compact = false,
}: CountUpProps) {
  const count = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: "easeOut" });
    const unsub = (count as MotionValue<number>).on("change", (latest: number) => setDisplay(latest));
    return () => { controls.stop(); unsub(); };
  }, [value, duration, count]);

  const formatted = compact
    ? (prefix === "$" ? formatUsdCompact(display) : formatCompactValue(display, decimals, prefix, suffix))
    : display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <span className={`tabular-nums ${className}`}>
      {compact && prefix === "$" ? formatted : `${prefix}${formatted}${suffix}`}
    </span>
  );
}
