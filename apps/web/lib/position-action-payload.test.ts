import { describe, expect, it } from "vitest";

import {
  buildClosePositionPayload,
  buildCreatePositionPayload,
  buildPositionRedirectPath,
  buildUpdatePositionPayload,
} from "./position-action-payload";

describe("position action payload helpers", () => {
  it("builds a create-position payload and omits empty optional fields", () => {
    const formData = new FormData();
    formData.set("assetId", "crypto:global:BTC-USD");
    formData.set("direction", "long");
    formData.set("entryPrice", "84250.5");
    formData.set("quantity", "0.25");
    formData.set("thesis", "  Breakout continuation  ");
    formData.set("stopLoss", "");

    expect(buildCreatePositionPayload(formData)).toEqual({
      assetId: "crypto:global:BTC-USD",
      averageEntryPrice: 84250.5,
      direction: "long",
      entryPrice: 84250.5,
      metadata: {},
      quantity: 0.25,
      remainingQuantity: 0.25,
      status: "open",
      takeProfitLevels: [],
      thesis: "Breakout continuation",
      userId: "system:default",
    });
  });

  it("builds an update payload for active-position management", () => {
    const formData = new FormData();
    formData.set("averageEntryPrice", "84000");
    formData.set("remainingQuantity", "0.12");
    formData.set("status", "partially_closed");
    formData.set("stopLoss", "83200");
    formData.set("thesis", "  Trail risk under support  ");
    formData.set("notes", "  Took some profit into resistance. ");

    expect(buildUpdatePositionPayload(formData)).toEqual({
      averageEntryPrice: 84000,
      remainingQuantity: 0.12,
      status: "partially_closed",
      stopLoss: 83200,
      thesis: "Trail risk under support",
      notes: "Took some profit into resistance.",
    });
  });

  it("builds a close payload with optional realized pnl fields", () => {
    const formData = new FormData();
    formData.set("realizedPnl", "420");
    formData.set("realizedPnlPercent", "5.1");
    formData.set("notes", "  Closed into target  ");

    expect(buildClosePositionPayload(formData)).toEqual({
      remainingQuantity: 0,
      realizedPnl: 420,
      realizedPnlPercent: 5.1,
      notes: "Closed into target",
    });
  });

  it("builds asset-detail redirect paths for position actions", () => {
    expect(
      buildPositionRedirectPath({
        status: "updated",
        symbol: "btc",
        timeframe: "4H",
      }),
    ).toBe("/assets/btc?positionStatus=updated&timeframe=4H#manual-position");
  });
});
