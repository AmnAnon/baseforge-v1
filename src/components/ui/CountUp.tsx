"use client";

import { useEffect, useState } from "react";
import { animate, MotionValue, useMotionValue } from "framer-motion";

interface CountUpProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function CountUp({ value, decimals = 0, prefix = "", suffix = "", duration = 1.5, className = "" }: CountUpProps) {
  const count = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: "easeOut" });
    const unsub = (count as MotionValue<number>).on("change", (latest: number) => setDisplay(latest));
    return () => { controls.stop(); unsub(); };
  }, [value, duration, count]);

  const formatted = display.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
