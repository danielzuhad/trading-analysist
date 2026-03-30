export const assetStates = [
  "IGNORE",
  "WATCH",
  "PREPARE",
  "ACTIONABLE",
  "IN_POSITION",
  "EXIT_WARNING",
  "INVALID",
] as const;

export type AssetState = (typeof assetStates)[number];

export const supportedTimeframes = ["1H", "4H"] as const;

export type SupportedTimeframe = (typeof supportedTimeframes)[number];

export type ServiceStatus = "ok" | "ready" | "degraded";
