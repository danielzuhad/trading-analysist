"use client";

import type { CryptoSearchResult } from "@trading-analyst/shared-types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CoinLogo } from "@/components/dashboard/coin-logo";
import { Input } from "@/components/ui/input";
import {
  addToWatchlistAction,
  searchCryptoAction,
} from "@/lib/watchlist-actions";
import { cn } from "@/lib/utils";

type WatchlistSearchProps = {
  watchlistCount: number;
  watchlistLimit: number | null;
};

export function WatchlistSearch({
  watchlistCount,
  watchlistLimit,
}: WatchlistSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CryptoSearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limitReached =
    watchlistLimit !== null && watchlistCount >= watchlistLimit;

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setMessage(null);
      setActiveIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const response = await searchCryptoAction(query);

        if (response.status === "ok") {
          setResults(response.results);
          setMessage(response.results.length === 0 ? "No coins found." : null);
        } else {
          setResults([]);
          setMessage(response.message);
        }

        setActiveIndex(-1);
        setIsOpen(true);
      });
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  function handleAdd(result: CryptoSearchResult) {
    if (result.inWatchlist || limitReached) {
      return;
    }

    startTransition(async () => {
      const response = await addToWatchlistAction({
        coingeckoCoinId: result.coingeckoCoinId,
        ...(result.thumb ? { imageUrl: result.thumb } : {}),
        name: result.name,
        symbol: result.symbol,
      });

      setMessage(response.message);

      if (response.status === "ok") {
        setResults((current) =>
          current.map((entry) =>
            entry.coingeckoCoinId === result.coingeckoCoinId
              ? { ...entry, inWatchlist: true }
              : entry,
          ),
        );
        router.refresh();
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!isOpen || results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + results.length) % results.length,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const active = results[activeIndex];

      if (active) {
        handleAdd(active);
      }
    }
  }

  const showPopover = isOpen && (results.length > 0 || message !== null);

  return (
    <div className="relative grid gap-2" ref={containerRef}>
      <div className="relative flex items-center">
        <Input
          className="min-h-10 rounded-sm border-input pr-16 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
          type="search"
          placeholder="Search a coin to add (e.g. XRP, doge)…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search crypto"
          aria-expanded={showPopover}
          role="combobox"
          aria-controls="watchlist-search-results"
          aria-autocomplete="list"
        />
        {watchlistLimit !== null ? (
          <span
            className={cn(
              "pointer-events-auto absolute right-3 text-[0.8rem] tabular-nums text-muted-foreground",
              limitReached && "font-semibold text-warn",
            )}
            title={`The watchlist is capped at ${watchlistLimit} assets to keep AI analysis cost and market-data rate limits under control.`}
          >
            {watchlistCount}/{watchlistLimit}
          </span>
        ) : null}
      </div>

      {showPopover ? (
        <div
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 grid max-h-85 gap-1.5 overflow-y-auto rounded-sm border border-input bg-card p-2 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
          id="watchlist-search-results"
        >
          {limitReached ? (
            <p className="m-0 px-1.5 py-0.5 text-[0.85rem] text-warn">
              Watchlist is full ({watchlistLimit} assets). Remove an asset
              before adding a new one.
            </p>
          ) : null}

          {isPending ? (
            <p className="m-0 px-1.5 py-0.5 text-[0.85rem] text-muted-foreground">
              Searching…
            </p>
          ) : message ? (
            <p className="m-0 px-1.5 py-0.5 text-[0.85rem] text-muted-foreground">
              {message}
            </p>
          ) : null}

          {results.length > 0 ? (
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {results.map((result, index) => (
                <li
                  key={result.coingeckoCoinId}
                  className={cn(
                    "flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 hover:bg-secondary",
                    index === activeIndex && "bg-secondary",
                  )}
                  onPointerEnter={() => setActiveIndex(index)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CoinLogo
                      imageUrl={result.thumb}
                      size={22}
                      symbol={result.symbol}
                    />
                    <strong className="text-[0.9rem]">{result.symbol}</strong>
                    <span className="overflow-hidden text-[0.84rem] text-ellipsis whitespace-nowrap text-muted-foreground">
                      {result.name}
                    </span>
                    {result.marketCapRank ? (
                      <span className="tabular-nums text-muted-foreground">
                        #{result.marketCapRank}
                      </span>
                    ) : null}
                  </span>
                  {result.inWatchlist ? (
                    <span className="inline-flex min-h-6.5 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-[0.74rem] font-medium tracking-[0.02em] text-muted-foreground">
                      In watchlist
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="cursor-pointer rounded-full border border-input bg-accent-soft px-3 py-1 text-[0.8rem] font-semibold whitespace-nowrap text-accent hover:bg-primary hover:text-white disabled:cursor-wait disabled:opacity-60"
                      disabled={isPending || limitReached}
                      onClick={() => handleAdd(result)}
                    >
                      + Add
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
