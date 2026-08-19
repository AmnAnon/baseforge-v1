// src/components/DemoBanner.tsx
// Preview / demo strip — explains the project for evaluators.
// Shown when NEXT_PUBLIC_DEMO_MODE=true or VERCEL_ENV=preview (not production).

"use client";

import { useState, useEffect } from "react";
import { X, Bot, Zap, ShieldCheck, ExternalLink } from "lucide-react";

const GITHUB_REPO = "https://github.com/AmnAnon/baseforge-v1";
const DISMISS_KEY = "baseforge-demo-banner-dismissed";

export default function DemoBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem(DISMISS_KEY) === "true";
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  if (dismissed) return null;

  return (
    <aside
      aria-label="Demo environment notice"
      className="relative bg-gradient-to-r from-emerald-950/90 via-blue-950/80 to-emerald-950/90 border-b border-emerald-500/30 px-3 py-1.5 text-xs text-gray-300 z-10"
    >
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider shrink-0">
            Preview
          </span>
          <span className="text-xs font-medium text-white truncate">
            AI-Ready Intelligence Layer for Base
          </span>
          <div className="hidden md:flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-emerald-400" />
              Live Signals
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-blue-400" />
              Envio Indexed
            </span>
            <a
              href="/api/agents/context?include=all&top=5"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-purple-400 hover:text-purple-300 underline"
            >
              <Bot className="h-3 w-3" />
              Agent API
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            GitHub
          </a>
          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            aria-label="Dismiss preview banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}