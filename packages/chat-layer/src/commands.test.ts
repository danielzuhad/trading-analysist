import { describe, expect, it } from "vitest";
import { parseChatCommand } from "./commands.js";

describe("chat command parser", () => {
  it("parses a watchlist command with timeframe", () => {
    expect(parseChatCommand("watchlist 1H")).toEqual({
      kind: "watchlist",
      timeframe: "1H",
    });
  });

  it("parses an asset shorthand command", () => {
    expect(parseChatCommand("btc 4h")).toEqual({
      kind: "asset",
      symbol: "BTC",
      timeframe: "4H",
    });
  });

  it("parses a position open command", () => {
    expect(
      parseChatCommand("position btc long entry 84000 qty 0.10 stop 82000"),
    ).toEqual({
      direction: "long",
      entryPrice: 84000,
      kind: "position_open",
      quantity: 0.1,
      stopLoss: 82000,
      symbol: "BTC",
      timeframe: "4H",
    });
  });

  it("rejects an incomplete position command", () => {
    expect(parseChatCommand("position btc long qty 0.10")).toEqual({
      kind: "invalid",
      message:
        "Perintah posisi wajib punya ENTRY dan QTY. Contoh: POSITION BTC LONG ENTRY 84000 QTY 0.10",
    });
  });

  it("parses a close command with a note", () => {
    expect(parseChatCommand("close sol note target reached")).toEqual({
      kind: "position_close",
      note: "target reached",
      symbol: "SOL",
    });
  });
});
