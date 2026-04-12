// src/components/DemoBanner.tsx
// Prominent banner shown in demo mode — explains the project and links to key features.
// Shown when NEXT_PUBLIC_DEMO_MODE=true or on vercel preview deployments.

"use client";

import { useState } from "react";
import { X, Bot, Zap, ShieldCheck, ExternalLink } from "lucide-react";

export default function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-emerald-950/90 via-blue-950/80 to-emerald-950/90 border-b border-emerald-500/30 px-4 py-3">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              Live Demo
            </span>
            <span className="text-sm font-semibold text-white">
              BaseForge — AI-Ready Intelligence Layer for Base
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-emerald-400" />
              Real-time data from 500+ protocols
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-blue-400" />
              Risk scoring + whale tracking
            </span>
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3 text-purple-400" />
              <a
                href="/api/agents/context?include=all&top=5"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
              >
                AI Agent API
              </a>
            </span>
            <a
              href="https://github.com/AmnAnon/baseforge"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              GitHub
            </a>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-gray-500 hover:text-white transition-colors flex-shrink-0"
          aria-label="Dismiss demo banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
