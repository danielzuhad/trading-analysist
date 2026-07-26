"use client";

import type { CryptoSearchResult } from "@trading-analyst/shared-types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CoinLogo } from "@/components/dashboard/coin-logo";
import {
  addToWatchlistAction,
  searchCryptoAction,
} from "@/lib/watchlist-actions";

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
    <div className="watchlist-search" ref={containerRef}>
      <div className="watchlist-search__bar">
        <input
          className="watchlist-search__input"
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
            className={`watchlist-search__slots ${limitReached ? "watchlist-search__slots--full" : ""}`}
            title={`The watchlist is capped at ${watchlistLimit} assets to keep AI analysis cost and market-data rate limits under control.`}
          >
            {watchlistCount}/{watchlistLimit}
          </span>
        ) : null}
      </div>

      {showPopover ? (
        <div
          className="watchlist-search__popover"
          id="watchlist-search-results"
        >
          {limitReached ? (
            <p className="watchlist-search__hint watchlist-search__hint--warn">
              Watchlist is full ({watchlistLimit} assets). Remove an asset
              before adding a new one.
            </p>
          ) : null}

          {isPending ? (
            <p className="watchlist-search__hint">Searching…</p>
          ) : message ? (
            <p className="watchlist-search__hint">{message}</p>
          ) : null}

          {results.length > 0 ? (
            <ul className="watchlist-search__results">
              {results.map((result, index) => (
                <li
                  key={result.coingeckoCoinId}
                  className={
                    index === activeIndex
                      ? "watchlist-search__result--active"
                      : ""
                  }
                  onPointerEnter={() => setActiveIndex(index)}
                >
                  <span className="watchlist-search__coin">
                    <CoinLogo
                      imageUrl={result.thumb}
                      size={22}
                      symbol={result.symbol}
                    />
                    <strong>{result.symbol}</strong>
                    <span>{result.name}</span>
                    {result.marketCapRank ? (
                      <span className="watchlist-search__rank">
                        #{result.marketCapRank}
                      </span>
                    ) : null}
                  </span>
                  {result.inWatchlist ? (
                    <span className="inline-chip">In watchlist</span>
                  ) : (
                    <button
                      type="button"
                      className="watchlist-search__add"
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
