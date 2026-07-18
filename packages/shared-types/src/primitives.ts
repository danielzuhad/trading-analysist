import { z } from "zod";

export const assetClassValues = ["crypto", "stock"] as const;
export const assetClassSchema = z.enum(assetClassValues);
export type AssetClass = z.infer<typeof assetClassSchema>;

export const assetStates = [
  "IGNORE",
  "WATCH",
  "PREPARE",
  "ACTIONABLE",
  "IN_POSITION",
  "EXIT_WARNING",
  "INVALID",
] as const;
export const assetStateSchema = z.enum(assetStates);
export type AssetState = z.infer<typeof assetStateSchema>;

export const timeframeValues = ["5M", "15M", "1H", "4H", "1D"] as const;
export const timeframeSchema = z.enum(timeframeValues);
export type Timeframe = z.infer<typeof timeframeSchema>;

export const supportedTimeframes = ["1H", "4H"] as const;
export const supportedTimeframeSchema = z.enum(supportedTimeframes);
export type SupportedTimeframe = z.infer<typeof supportedTimeframeSchema>;

export const tradingStyleValues = [
  "scalp",
  "intraday",
  "swing",
  "position",
] as const;
export const tradingStyleSchema = z.enum(tradingStyleValues);
export type TradingStyle = z.infer<typeof tradingStyleSchema>;

export const riskProfileValues = [
  "conservative",
  "moderate",
  "aggressive",
] as const;
export const riskProfileSchema = z.enum(riskProfileValues);
export type RiskProfile = z.infer<typeof riskProfileSchema>;

export const watchlistSuggestionValues = [
  "NO_TRADE",
  "WATCH",
  "WAIT",
  "ENTRY_ON_CONFIRMATION",
  "ENTRY_SMALL",
] as const;
export const watchlistSuggestionSchema = z.enum(watchlistSuggestionValues);
export type WatchlistSuggestion = z.infer<typeof watchlistSuggestionSchema>;

export const positionSuggestionValues = [
  "HOLD",
  "HOLD_TIGHT",
  "REDUCE_RISK",
  "TAKE_PARTIAL_PROFIT",
  "EXIT_IF_BREAKS_LEVEL",
  "EXIT_NOW",
] as const;
export const positionSuggestionSchema = z.enum(positionSuggestionValues);
export type PositionSuggestion = z.infer<typeof positionSuggestionSchema>;

export const analysisSuggestionValues = [
  ...watchlistSuggestionValues,
  ...positionSuggestionValues,
] as const;
export const analysisSuggestionSchema = z.enum(analysisSuggestionValues);
export type AnalysisSuggestion = z.infer<typeof analysisSuggestionSchema>;

export const riskLevelValues = ["low", "medium", "high", "extreme"] as const;
export const riskLevelSchema = z.enum(riskLevelValues);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const marketRegimeValues = [
  "trend",
  "range",
  "breakout",
  "breakdown",
  "volatile",
  "unknown",
] as const;
export const marketRegimeSchema = z.enum(marketRegimeValues);
export type MarketRegime = z.infer<typeof marketRegimeSchema>;

export const analysisBiasValues = [
  "bullish",
  "bearish",
  "neutral",
  "mixed",
] as const;
export const analysisBiasSchema = z.enum(analysisBiasValues);
export type AnalysisBias = z.infer<typeof analysisBiasSchema>;

export const suggestedPositionSizeValues = [
  "none",
  "conservative",
  "normal",
  "aggressive",
] as const;
export const suggestedPositionSizeSchema = z.enum(suggestedPositionSizeValues);
export type SuggestedPositionSize = z.infer<typeof suggestedPositionSizeSchema>;

export const trendDirectionValues = ["up", "down", "flat", "mixed"] as const;
export const trendDirectionSchema = z.enum(trendDirectionValues);
export type TrendDirection = z.infer<typeof trendDirectionSchema>;

export const volatilityRegimeValues = [
  "compressed",
  "normal",
  "expanded",
  "extreme",
] as const;
export const volatilityRegimeSchema = z.enum(volatilityRegimeValues);
export type VolatilityRegime = z.infer<typeof volatilityRegimeSchema>;

export const marketStructureValues = [
  "uptrend",
  "downtrend",
  "range",
  "transition",
] as const;
export const marketStructureSchema = z.enum(marketStructureValues);
export type MarketStructure = z.infer<typeof marketStructureSchema>;

export const marketSessionValues = [
  "pre",
  "regular",
  "after",
  "closed",
  "continuous",
] as const;
export const marketSessionSchema = z.enum(marketSessionValues);
export type MarketSession = z.infer<typeof marketSessionSchema>;

export const analysisTriggerValues = [
  "scheduled",
  "realtime_event",
  "manual_position_update",
  "manual_recalculation",
  "system_correction",
] as const;
export const analysisTriggerSchema = z.enum(analysisTriggerValues);
export type AnalysisTrigger = z.infer<typeof analysisTriggerSchema>;

export const notificationChannelValues = [
  "dashboard",
  "telegram",
  "whatsapp",
  "email",
  "webhook",
] as const;
export const notificationChannelSchema = z.enum(notificationChannelValues);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const watchlistStatusValues = ["active", "archived"] as const;
export const watchlistStatusSchema = z.enum(watchlistStatusValues);
export type WatchlistStatus = z.infer<typeof watchlistStatusSchema>;

export const positionStatusValues = [
  "open",
  "partially_closed",
  "closed",
] as const;
export const positionStatusSchema = z.enum(positionStatusValues);
export type PositionStatus = z.infer<typeof positionStatusSchema>;

export const positionDirectionValues = ["long", "short"] as const;
export const positionDirectionSchema = z.enum(positionDirectionValues);
export type PositionDirection = z.infer<typeof positionDirectionSchema>;

export const alertKindValues = ["market", "position"] as const;
export const alertKindSchema = z.enum(alertKindValues);
export type AlertKind = z.infer<typeof alertKindSchema>;

export const alertSeverityValues = ["info", "warning", "critical"] as const;
export const alertSeveritySchema = z.enum(alertSeverityValues);
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;

export const alertStatusValues = [
  "suggested",
  "delivered",
  "acknowledged",
  "ignored",
  "expired",
] as const;
export const alertStatusSchema = z.enum(alertStatusValues);
export type AlertStatus = z.infer<typeof alertStatusSchema>;

export const executionActionTypeValues = [
  "BUY",
  "SELL",
  "ADD",
  "REDUCE",
  "CLOSE",
  "UPDATE_STOP_LOSS",
  "UPDATE_TAKE_PROFIT",
  "UPDATE_NOTE",
  "CORRECTION",
] as const;
export const executionActionTypeSchema = z.enum(executionActionTypeValues);
export type ExecutionActionType = z.infer<typeof executionActionTypeSchema>;

export const executionSourceValues = [
  "dashboard",
  "chat",
  "api",
  "import",
  "system",
] as const;
export const executionSourceSchema = z.enum(executionSourceValues);
export type ExecutionSource = z.infer<typeof executionSourceSchema>;

export const serviceStatusValues = ["ok", "ready", "degraded"] as const;
export const serviceStatusSchema = z.enum(serviceStatusValues);
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

export const providerOperationalStatusValues = [
  "active",
  "degraded",
  "down",
  "disabled",
] as const;
export const providerOperationalStatusSchema = z.enum(
  providerOperationalStatusValues,
);
export type ProviderOperationalStatus = z.infer<
  typeof providerOperationalStatusSchema
>;
