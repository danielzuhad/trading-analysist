"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  removeFromWatchlistAction,
  setWatchlistAiEnabledAction,
} from "@/lib/watchlist-actions";
import { cn } from "@/lib/utils";

type WatchlistCardActionsProps = {
  aiEnabled: boolean;
  assetId: string;
  symbol: string;
};

export function WatchlistCardActions({
  aiEnabled,
  assetId,
  symbol,
}: WatchlistCardActionsProps) {
  const router = useRouter();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  function handleToggleAi(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError(null);

    startTransition(async () => {
      const result = await setWatchlistAiEnabledAction(assetId, !aiEnabled);

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  function handleRemove(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError(null);

    if (!confirmingRemove) {
      setConfirmingRemove(true);
      confirmTimeoutRef.current = setTimeout(() => {
        setConfirmingRemove(false);
      }, 4000);
      return;
    }

    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }

    setConfirmingRemove(false);

    startTransition(async () => {
      const result = await removeFromWatchlistAction(assetId);

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={cn(
          "cursor-pointer rounded-full border border-input px-2.5 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap disabled:cursor-wait disabled:opacity-60",
          aiEnabled
            ? "bg-accent-soft text-accent"
            : "bg-secondary text-muted-foreground",
        )}
        disabled={isPending}
        onClick={handleToggleAi}
        title={
          aiEnabled
            ? "AI analysis is on. Click to pause and save AI cost."
            : "AI analysis is paused. Click to resume."
        }
      >
        AI {aiEnabled ? "on" : "off"}
      </button>
      <button
        type="button"
        className={cn(
          "min-h-5.5 min-w-5.5 cursor-pointer rounded-full border border-border bg-transparent px-1.5 py-0.5 text-[0.72rem] leading-none font-semibold whitespace-nowrap text-muted-foreground hover:border-down hover:bg-down-soft hover:text-down disabled:cursor-wait disabled:opacity-60",
          confirmingRemove && "border-down bg-down-soft text-down",
        )}
        disabled={isPending}
        onClick={handleRemove}
        aria-label={`Remove ${symbol} from watchlist`}
        title={`Remove ${symbol} from watchlist`}
      >
        {confirmingRemove ? "Remove?" : "✕"}
      </button>
      {error ? (
        <span className="text-[0.72rem] text-down">{error}</span>
      ) : null}
    </div>
  );
}
