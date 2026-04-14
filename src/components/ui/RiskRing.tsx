// src/components/ui/RiskRing.tsx
// Radial SVG ring showing risk score with color-coded glow.

"use client";

import { motion } from "framer-motion";

interface RiskRingProps {
  score: number; // 0-100 (higher = safer)
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

function riskColor(score: number): string {
  if (score >= 70) return "var(--bf-neon-secondary)"; // green
  if (score >= 40) return "var(--bf-status-warn)"; // yellow
  return "var(--bf-neon-magenta)"; // red
}

function riskGlow(score: number): string {
  if (score >= 70) return "rgba(0, 255, 136, 0.4)";
  if (score >= 40) return "rgba(255, 170, 0, 0.4)";
  return "rgba(255, 45, 123, 0.4)";
}

export function RiskRing({ score, size = 48, strokeWidth = 3, showLabel = true }: RiskRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = riskColor(score);
  const glow = riskGlow(score);

  return (
    <div className="risk-ring inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
        <motion.circle
          className="fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
        />
      </svg>
      {showLabel && (
        <span className="label absolute" style={{ color }}>{score}</span>
      )}
    </div>
  );
}
