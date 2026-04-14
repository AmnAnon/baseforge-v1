// src/components/ui/NeonCard.tsx
// Glassmorphic card with neon hover glow.

"use client";

import { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";

interface NeonCardProps {
  children: React.ReactNode;
  glowColor?: string;
  className?: string;
  hoverScale?: number;
  style?: React.CSSProperties;
  id?: string;
}

export function NeonCard({
  children,
  glowColor = "rgba(0, 212, 255, 0.15)",
  className = "",
  hoverScale = 1.015,
  style,
  id,
}: NeonCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });
  const background = useMotionTemplate`radial-gradient(350px circle at ${springX}px ${springY}px, ${glowColor}, transparent 80%)`;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ scale: hoverScale, transition: { duration: 0.2 } }}
      onPointerMove={(e) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        x.set(e.clientX - rect.left);
        y.set(e.clientY - rect.top);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
      className={`glass-card relative overflow-hidden rounded-2xl p-5 ${className}`}
      style={style ? { ...style, background } : { background }}
      id={id}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/** Mini metric card for header ticker */
export function MiniMetric({
  label,
  value,
  icon,
  color = "var(--bf-neon-primary)",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
      {icon && <span style={{ color }}>{icon}</span>}
      <div>
        <div className="text-[10px] text-[var(--bf-text-secondary)] uppercase tracking-wider leading-none">{label}</div>
        <div className="text-sm font-mono font-semibold tabular-nums leading-tight" style={{ color }}>
          {value}
        </div>
      </div>
    </div>
  );
}
