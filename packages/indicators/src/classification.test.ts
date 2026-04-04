import { describe, expect, it } from "vitest";
import {
  classifyMarketStructure,
  classifyVolatilityRegime,
} from "./classification.js";

describe("indicator classification", () => {
  it("maps ATR expansion into a volatility regime label", () => {
    expect(classifyVolatilityRegime(0.6, 1)).toBe("compressed");
    expect(classifyVolatilityRegime(1, 1)).toBe("normal");
    expect(classifyVolatilityRegime(1.4, 1)).toBe("expanded");
    expect(classifyVolatilityRegime(2, 1)).toBe("extreme");
  });

  it("classifies an aligned EMA stack as an uptrend", () => {
    expect(
      classifyMarketStructure({
        close: 120,
        ema20: 118,
        ema50: 112,
        ema200: 101,
      }),
    ).toBe("uptrend");
  });

  it("classifies compressed moving averages as a range", () => {
    expect(
      classifyMarketStructure({
        close: 100,
        ema20: 100.2,
        ema50: 100,
        ema200: 99.4,
      }),
    ).toBe("range");
  });
});
