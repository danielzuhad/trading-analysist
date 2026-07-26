import {
  buildCryptoAssetFromCoingecko,
  MAX_WATCHLIST_ASSETS,
  type Position,
  type WatchlistAssetEntry,
} from "@trading-analyst/shared-types";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { registerWatchlistRoutes } from "./watchlist.js";

function buildEntry(symbol: string): WatchlistAssetEntry {
  return {
    asset: buildCryptoAssetFromCoingecko({
      coingeckoCoinId: symbol.toLowerCase(),
      name: symbol,
      symbol,
    }),
    aiEnabled: true,
    source: "manual",
    addedAt: "2026-07-19T00:00:00.000Z",
    metadata: {},
  };
}

function buildEntries(count: number): WatchlistAssetEntry[] {
  return Array.from({ length: count }, (_, index) =>
    buildEntry(`COIN${index}`),
  );
}

const testUserId = "user-1";

async function buildTestApp(
  overrides: {
    activePosition?: Position | null;
    entries?: WatchlistAssetEntry[];
    setAssetAiEnabledStatus?: "updated" | "not_found";
  } = {},
) {
  const addAsset = vi.fn().mockResolvedValue({ status: "created" as const });
  const removeAsset = vi.fn().mockResolvedValue({ status: "removed" as const });
  const setAssetAiEnabled = vi.fn().mockResolvedValue({
    status: overrides.setAssetAiEnabledStatus ?? ("updated" as const),
  });

  const app = Fastify();
  app.addHook("onRequest", async (request) => {
    request.user = { role: "member", userId: testUserId };
  });
  await registerWatchlistRoutes(app, {
    addAsset,
    ensureDefaults: vi.fn().mockResolvedValue(undefined),
    getActivePositionForAsset: vi
      .fn()
      .mockResolvedValue(overrides.activePosition ?? null),
    listAssets: vi.fn().mockResolvedValue(overrides.entries ?? []),
    removeAsset,
    setAssetAiEnabled,
  });

  return { addAsset, app, removeAsset, setAssetAiEnabled };
}

describe("watchlist routes", () => {
  it("returns the watchlist limit in the overview payload", async () => {
    const { app } = await buildTestApp({ entries: buildEntries(2) });

    const response = await app.inject({ method: "GET", url: "/watchlist" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      count: 2,
      limit: MAX_WATCHLIST_ASSETS,
    });
  });

  it("adds a new asset while the watchlist is under the limit", async () => {
    const { addAsset, app } = await buildTestApp({
      entries: buildEntries(MAX_WATCHLIST_ASSETS - 1),
    });

    const response = await app.inject({
      body: { coingeckoCoinId: "ripple", name: "XRP", symbol: "XRP" },
      method: "POST",
      url: "/watchlist",
    });

    expect(response.statusCode).toBe(201);
    expect(addAsset).toHaveBeenCalledTimes(1);
  });

  it("rejects a new asset once the watchlist limit is reached", async () => {
    const { addAsset, app } = await buildTestApp({
      entries: buildEntries(MAX_WATCHLIST_ASSETS),
    });

    const response = await app.inject({
      body: { coingeckoCoinId: "ripple", name: "XRP", symbol: "XRP" },
      method: "POST",
      url: "/watchlist",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: "WATCHLIST_LIMIT_REACHED",
      limit: MAX_WATCHLIST_ASSETS,
    });
    expect(addAsset).not.toHaveBeenCalled();
  });

  it("still accepts an already-watched asset at the limit as a duplicate", async () => {
    const entries = buildEntries(MAX_WATCHLIST_ASSETS);
    const { addAsset, app } = await buildTestApp({ entries });
    addAsset.mockResolvedValue({ status: "duplicate" as const });

    const response = await app.inject({
      body: { coingeckoCoinId: "coin0", name: "COIN0", symbol: "COIN0" },
      method: "POST",
      url: "/watchlist",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "duplicate" });
  });

  it("updates aiEnabled for a watched asset", async () => {
    const { app, setAssetAiEnabled } = await buildTestApp();

    const response = await app.inject({
      body: { aiEnabled: false },
      method: "PATCH",
      url: "/watchlist/crypto:global:BTC-USD",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      aiEnabled: false,
      status: "updated",
    });
    expect(setAssetAiEnabled).toHaveBeenCalledWith(
      { assetId: "crypto:global:BTC-USD", userId: testUserId },
      false,
    );
  });

  it("returns 404 when toggling aiEnabled for an unknown asset", async () => {
    const { app } = await buildTestApp({
      setAssetAiEnabledStatus: "not_found",
    });

    const response = await app.inject({
      body: { aiEnabled: true },
      method: "PATCH",
      url: "/watchlist/crypto:global:UNKNOWN-USD",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: "WATCHLIST_ASSET_NOT_FOUND",
    });
  });

  it("rejects an invalid aiEnabled payload", async () => {
    const { app, setAssetAiEnabled } = await buildTestApp();

    const response = await app.inject({
      body: { aiEnabled: "yes" },
      method: "PATCH",
      url: "/watchlist/crypto:global:BTC-USD",
    });

    expect(response.statusCode).toBe(400);
    expect(setAssetAiEnabled).not.toHaveBeenCalled();
  });

  it("blocks removal while the asset has an active position", async () => {
    const { app, removeAsset } = await buildTestApp({
      activePosition: { id: "position-1" } as Position,
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/watchlist/crypto:global:BTC-USD",
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: "ASSET_HAS_ACTIVE_POSITION",
    });
    expect(removeAsset).not.toHaveBeenCalled();
  });

  it("removes a watched asset without an active position", async () => {
    const { app } = await buildTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/watchlist/crypto:global:BTC-USD",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "removed" });
  });
});
