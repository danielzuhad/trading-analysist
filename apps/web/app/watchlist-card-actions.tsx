"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  removeFromWatchlistAction,
  setWatchlistAiEnabledAction,
} from "./watchlist-actions";

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
    <div className="card-actions">
      <button
        type="button"
        className={`card-actions__ai ${aiEnabled ? "card-actions__ai--on" : "card-actions__ai--off"}`}
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
        className={`card-actions__remove ${confirmingRemove ? "card-actions__remove--confirm" : ""}`}
        disabled={isPending}
        onClick={handleRemove}
        aria-label={`Remove ${symbol} from watchlist`}
        title={`Remove ${symbol} from watchlist`}
      >
        {confirmingRemove ? "Remove?" : "✕"}
      </button>
      {error ? <span className="card-actions__error">{error}</span> : null}
    </div>
  );
}
