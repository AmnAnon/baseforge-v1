"use client";

// src/components/ui/ShareOnWarpcastButton.tsx
// 1-Click Warpcast & Farcaster Cast Composer with dynamic Frame & OG Alpha embed.

import { Share2 } from "lucide-react";

interface ShareOnWarpcastButtonProps {
  tokenSymbol: string;
  amountUSD: number;
  winRate?: number;
  signalType?: string;
  protocol?: string;
  className?: string;
}

export default function ShareOnWarpcastButton({
  tokenSymbol,
  amountUSD,
  winRate = 85.3,
  signalType = "ACCUMULATION",
  protocol = "Aerodrome",
  className = "",
}: ShareOnWarpcastButtonProps) {
  const handleShare = () => {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_BASE_URL || "https://baseforge-v1.vercel.app";

    const isGem = signalType === "GEM_SNIPE";
    const emoji = isGem ? "💎" : "📈";

    const text = `${emoji} Base Whale Alert on @baseforge!

Whale accumulated $${tokenSymbol} ($${amountUSD.toLocaleString()}) via ${protocol}
🎯 Win-Rate: ${winRate}%

⚡ 1-Click Copy Trade directly on Base:`;

    const embedUrl = `${baseUrl}/api/og/signal?token=${encodeURIComponent(
      tokenSymbol
    )}&amount=${amountUSD}&type=${encodeURIComponent(
      signalType
    )}&winRate=${winRate}&protocol=${encodeURIComponent(protocol)}`;

    const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(
      text
    )}&embeds[]=${encodeURIComponent(embedUrl)}`;

    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleShare}
      className={`px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(168,85,247,0.15)] ${className}`}
      title="Share Alpha to Warpcast"
    >
      <Share2 size={13} className="text-purple-400" />
      <span>Cast Alpha</span>
    </button>
  );
}
