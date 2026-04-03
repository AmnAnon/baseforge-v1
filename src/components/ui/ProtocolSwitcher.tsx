// src/components/ui/ProtocolSwitcher.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface Protocol {
  id: string;
  name: string;
  logo?: string;
  tvl: number;
}

interface ProtocolSwitcherProps {
  protocols: Protocol[];
  selectedProtocol: Protocol;
  onProtocolChange: (protocol: Protocol) => void;
  isLoading?: boolean;
}

export default function ProtocolSwitcher({
  protocols,
  selectedProtocol,
  onProtocolChange,
  isLoading = false,
}: ProtocolSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (protocol: Protocol) => {
    onProtocolChange(protocol);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="h-12 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-xl animate-pulse"></div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-br from-gray-900/90 to-gray-800/80 border border-emerald-500/30 rounded-xl hover:border-emerald-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] group"
        aria-label="Select protocol"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <img
            src={selectedProtocol.logo}
            alt={selectedProtocol.name}
            className="w-8 h-8 rounded-full border-2 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            onError={(e) => (e.currentTarget.src = "/default-token.svg")}
          />
          <div className="flex flex-col items-start min-w-0">
            <span className="font-bold text-white text-sm sm:text-base truncate max-w-full">
              {selectedProtocol.name}
            </span>
            <span className="text-xs text-gray-400">
              ${(selectedProtocol.tvl / 1e6).toFixed(2)}M TVL
            </span>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-emerald-400 transition-transform duration-300 flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/98 backdrop-blur-md border border-emerald-500/30 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.2)] z-50 max-h-[400px] overflow-y-auto">
          <div className="p-2">
            {protocols.map((protocol) => {
              const isSelected = protocol.id === selectedProtocol.id;
              return (
                <button
                  key={protocol.id}
                  onClick={() => handleSelect(protocol)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isSelected
                      ? "bg-emerald-900/40 border border-emerald-500/50"
                      : "hover:bg-gray-800/60 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <img
                      src={protocol.logo}
                      alt={protocol.name}
                      className="w-7 h-7 rounded-full border border-gray-700"
                      onError={(e) => (e.currentTarget.src = "/default-token.svg")}
                    />
                    <div className="flex flex-col items-start min-w-0">
                      <span className="font-semibold text-white text-sm truncate max-w-full">
                        {protocol.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        ${(protocol.tvl / 1e6).toFixed(2)}M
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
