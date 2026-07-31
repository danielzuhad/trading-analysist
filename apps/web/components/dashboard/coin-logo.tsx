"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function symbolHue(symbol: string) {
  let hash = 0;

  for (const char of symbol) {
    hash = (hash * 37 + char.charCodeAt(0)) % 360;
  }

  return hash;
}

export function CoinLogo({
  imageUrl,
  size = 28,
  symbol,
}: {
  imageUrl?: string | undefined;
  size?: number;
  symbol: string;
}) {
  const [failed, setFailed] = useState(false);
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!imageUrl || failed) {
    const hue = symbolHue(normalizedSymbol);

    return (
      <span
        className={cn(
          "shrink-0 rounded-full border border-input bg-secondary bg-cover",
          "inline-flex items-center justify-center font-bold tracking-[0.02em] text-white/92",
          "shadow-[inset_0_1px_2px_rgba(255,255,255,0.25)] [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]",
        )}
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 55% 45%), hsl(${(hue + 45) % 360} 55% 28%))`,
          fontSize: `${Math.max(9, Math.round(size * 0.34))}px`,
          height: size,
          width: size,
        }}
        aria-hidden="true"
      >
        {normalizedSymbol.slice(0, 3)}
      </span>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: external CoinGecko thumbnails don't need next/image optimization
    <img
      className="shrink-0 rounded-full border border-input bg-secondary object-cover"
      src={imageUrl}
      width={size}
      height={size}
      alt={`${normalizedSymbol} logo`}
      onError={() => setFailed(true)}
    />
  );
}
