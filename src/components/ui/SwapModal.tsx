"use client";

// src/components/ui/SwapModal.tsx
// Glassmorphic 1-Click Swap Modal triggered from Header, Smart Money Signals, or Memecoin Radar.

import { X } from "lucide-react";
import SwapHub, { type TargetTokenParam, type CopyTradeContext } from "@/components/hubs/SwapHub";
import { useEffect } from "react";

export interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetToken?: TargetTokenParam;
  copyTradeContext?: CopyTradeContext;
}

export default function SwapModal({ isOpen, onClose, targetToken, copyTradeContext }: SwapModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#0a0a0a] border border-[#00d4ff]/30 rounded-2xl shadow-[0_0_50px_rgba(0,212,255,0.2)] p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <SwapHub targetToken={targetToken} copyTradeContext={copyTradeContext} />
      </div>
    </div>
  );
}

