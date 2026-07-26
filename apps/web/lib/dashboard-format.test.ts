import { describe, expect, it } from "vitest";

import {
  formatAlertStateTransition,
  formatAlertTimestamp,
  formatMissingDataLabel,
  formatPercent,
  formatPositionStatusMessage,
  formatPrice,
  formatScore,
  mapAlertSeverityTone,
  mapAssetStateTone,
  mapOverviewStatusTone,
  mapPositionStatusTone,
} from "./dashboard-format";

describe("dashboard presentation helpers", () => {
  it("formats numeric dashboard values consistently", () => {
    expect(formatPrice(84250.5)).toBe("$84,250.50");
    expect(formatPercent(2.1)).toBe("+2.10%");
    expect(formatScore(82)).toBe("82/100");
  });

  it("handles missing values without crashing the UI", () => {
    expect(formatPrice(undefined)).toBe("Unavailable");
    expect(formatPercent(undefined)).toBe("Unavailable");
    expect(formatScore(undefined)).toBe("Unavailable");
    expect(formatAlertTimestamp(undefined)).toBe("Unavailable");
  });

  it("maps dashboard statuses and asset states to UI tones", () => {
    expect(formatMissingDataLabel("analysis_snapshot")).toBe(
      "Analysis Snapshot",
    );
    expect(mapAssetStateTone("ACTIONABLE")).toBe("active");
    expect(mapAssetStateTone("WATCH")).toBe("degraded");
    expect(mapAssetStateTone("INVALID")).toBe("down");
    expect(mapOverviewStatusTone("ready")).toBe("active");
    expect(mapOverviewStatusTone("partial")).toBe("degraded");
    expect(mapOverviewStatusTone("pending")).toBe("disabled");
    expect(
      formatAlertStateTransition({
        currentState: "ACTIONABLE",
        previousState: "WATCH",
      }),
    ).toBe("WATCH -> ACTIONABLE");
    expect(mapAlertSeverityTone({ severity: "critical" })).toBe("down");
    expect(mapAlertSeverityTone({ severity: "warning" })).toBe("degraded");
    expect(mapAlertSeverityTone({ severity: "info" })).toBe("active");
    expect(formatPositionStatusMessage("updated")).toBe(
      "Position updated successfully.",
    );
    expect(formatPositionStatusMessage("close-failed")).toBe(
      "Failed to close position.",
    );
    expect(mapPositionStatusTone("closed")).toBe("success");
    expect(mapPositionStatusTone("update-failed")).toBe("error");
    expect(mapPositionStatusTone("api")).toBe("muted");
  });
});
