// src/components/ui/ProtocolLogo.tsx
"use client";

import { useState } from "react";

// Color palette for initials fallback
const COLORS = [
  "from-emerald-600 to-teal-700",
  "from-blue-600 to-indigo-700",
  "from-purple-600 to-violet-700",
  "from-orange-500 to-red-600",
  "from-cyan-500 to-blue-600",
  "from-pink-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-lime-500 to-green-600",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

interface ProtocolLogoProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}

export default function ProtocolLogo({ src, name, size = 32, className = "" }: ProtocolLogoProps) {
  const [failed, setFailed] = useState(!src);

  if (failed || !src) {
    const grad = hashColor(name);
    const fontSize = Math.max(10, Math.round(size * 0.38));
    return (
      <div
        className={`rounded-full bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        aria-label={name}
      >
        <span className="font-bold text-white select-none" style={{ fontSize }}>
          {initials(name)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`rounded-full flex-shrink-0 object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
