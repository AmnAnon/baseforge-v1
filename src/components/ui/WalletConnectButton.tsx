// src/components/ui/WalletConnectButton.tsx
// Cyber-neon wallet connect button for BaseForge.
// Supports injected wallets, MetaMask, and Coinbase Wallet.
// Forces Base network (chainId 8453) on connect.
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { Wallet, ChevronDown, ExternalLink, LogOut, Copy, Check, AlertCircle } from "lucide-react";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface WalletConnectButtonProps {
  onAddressChange?: (address: string | null) => void;
}

export default function WalletConnectButton({ onAddressChange }: WalletConnectButtonProps) {
  const { address, isConnected, chain } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Notify parent when address changes
  useEffect(() => {
    onAddressChange?.(address ?? null);
  }, [address, onAddressChange]);

  // Auto-switch to Base on connect
  useEffect(() => {
    if (isConnected && chain?.id !== base.id) {
      switchChain({ chainId: base.id });
    }
  }, [isConnected, chain?.id, switchChain]);

  // Close menus on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCopy = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setMenuOpen(false);
    onAddressChange?.(null);
  }, [disconnect, onAddressChange]);

  const isWrongNetwork = isConnected && chain?.id !== base.id;

  // ── Connected state ──
  if (isConnected && address) {
    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-semibold
            border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500
            ${isWrongNetwork
              ? "border-red-500/60 text-red-400 bg-red-500/10 hover:bg-red-500/20"
              : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
            }
          `}
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${isWrongNetwork ? "bg-red-400" : "bg-emerald-400"}`}
            style={{ boxShadow: isWrongNetwork ? "0 0 6px #f87171" : "0 0 6px #34d399" }}
          />
          {isWrongNetwork ? "Wrong network" : shortAddr(address)}
          <ChevronDown className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-52 rounded-xl bg-gray-950 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)] z-50 overflow-hidden">
            {isWrongNetwork && (
              <div className="px-3 py-2 border-b border-red-500/20 bg-red-500/5">
                <button
                  onClick={() => switchChain({ chainId: base.id })}
                  className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors w-full"
                >
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  Switch to Base
                </button>
              </div>
            )}

            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Connected</p>
              <p className="text-xs font-mono text-white">{shortAddr(address)}</p>
            </div>

            <div className="py-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy address"}
              </button>

              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on Basescan
              </a>

              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Wallet picker ──
  if (pickerOpen) {
    return (
      <div ref={menuRef} className="relative">
        <div className="absolute right-0 mt-0 w-56 rounded-xl bg-gray-950 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)] z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Connect wallet</p>
          </div>
          <div className="py-1">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => {
                  connect({ connector, chainId: base.id });
                  setPickerOpen(false);
                }}
                disabled={isConnecting}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <Wallet className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                {connector.name}
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-white/5">
            <button
              onClick={() => setPickerOpen(false)}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Disconnected state ──
  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setPickerOpen(true)}
        disabled={isConnecting}
        className="
          flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
          border border-emerald-500/40 text-emerald-400
          bg-gradient-to-r from-emerald-500/10 to-cyan-500/10
          hover:from-emerald-500/20 hover:to-cyan-500/20
          hover:border-emerald-500/60
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-emerald-500
          disabled:opacity-60 disabled:cursor-not-allowed
          shadow-[0_0_12px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]
        "
        aria-label="Connect wallet"
      >
        <Wallet className="h-3.5 w-3.5" aria-hidden />
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>
    </div>
  );
}
