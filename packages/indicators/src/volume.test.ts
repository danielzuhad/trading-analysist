import { describe, expect, it } from "vitest";
import { buildCandlesFromCloses } from "./test-fixtures.js";
import { buildVolumeSnapshot } from "./volume.js";

describe("buildVolumeSnapshot", () => {
  it("compares current volume against the previous 20-candle baseline", () => {
    const candles = buildCandlesFromCloses(
      Array.from({ length: 21 }, (_, index) => 100 + index * 0.5),
      (index) => (index === 20 ? 200 : 100),
    );

    const snapshot = buildVolumeSnapshot(candles, 20);

    expect(snapshot.average20).toBe(100);
    expect(snapshot.current).toBe(200);
    expect(snapshot.relativeVolume).toBe(2);
    expect(snapshot.trend).toBe("up");
  });
});
