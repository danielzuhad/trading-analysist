import type {
  ClosePositionInput,
  CreatePositionInput,
  UpdatePositionInput,
} from "@trading-analyst/shared-types";

export type PositionActionStatus =
  | "api"
  | "recorded"
  | "record-failed"
  | "updated"
  | "update-failed"
  | "closed"
  | "close-failed";

export const manualPositionAnchorId = "manual-position";

export function buildPositionRedirectPath({
  status,
  symbol,
  timeframe,
}: {
  status: PositionActionStatus;
  symbol: string;
  timeframe: string;
}) {
  const searchParams = new URLSearchParams({
    positionStatus: status,
    timeframe,
  });

  return `/assets/${symbol}?${searchParams.toString()}#${manualPositionAnchorId}`;
}

export function buildCreatePositionPayload(
  formData: FormData,
): CreatePositionInput {
  const entryPrice = readRequiredNumber(formData, "entryPrice");
  const quantity = readRequiredNumber(formData, "quantity");
  const stopLoss = readOptionalNumber(formData, "stopLoss");
  const thesis = readOptionalString(formData, "thesis");

  return {
    assetId: readRequiredString(formData, "assetId"),
    averageEntryPrice: entryPrice,
    direction: readRequiredString(formData, "direction") as "long" | "short",
    entryPrice,
    metadata: {},
    quantity,
    remainingQuantity: quantity,
    status: "open",
    takeProfitLevels: [],
    userId: "system:default",
    ...(stopLoss !== undefined ? { stopLoss } : {}),
    ...(thesis ? { thesis } : {}),
  };
}

export function buildUpdatePositionPayload(
  formData: FormData,
): UpdatePositionInput {
  const stopLoss = readOptionalNumber(formData, "stopLoss");
  const thesis = readOptionalString(formData, "thesis");
  const notes = readOptionalString(formData, "notes");

  return {
    averageEntryPrice: readRequiredNumber(formData, "averageEntryPrice"),
    remainingQuantity: readRequiredNumber(formData, "remainingQuantity"),
    status: readRequiredString(formData, "status") as
      | "open"
      | "partially_closed",
    ...(stopLoss !== undefined ? { stopLoss } : {}),
    ...(thesis ? { thesis } : {}),
    ...(notes ? { notes } : {}),
  };
}

export function buildClosePositionPayload(
  formData: FormData,
): ClosePositionInput {
  const realizedPnl = readOptionalNumber(formData, "realizedPnl");
  const realizedPnlPercent = readOptionalNumber(formData, "realizedPnlPercent");
  const notes = readOptionalString(formData, "notes");

  return {
    remainingQuantity: 0,
    ...(realizedPnl !== undefined ? { realizedPnl } : {}),
    ...(realizedPnlPercent !== undefined ? { realizedPnlPercent } : {}),
    ...(notes ? { notes } : {}),
  };
}

function readRequiredString(formData: FormData, field: string) {
  const value = readOptionalString(formData, field);

  if (!value) {
    throw new Error(`Missing required form field: ${field}`);
  }

  return value;
}

function readOptionalString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readRequiredNumber(formData: FormData, field: string) {
  const value = readOptionalNumber(formData, field);

  if (value === undefined) {
    throw new Error(`Missing required numeric form field: ${field}`);
  }

  return value;
}

function readOptionalNumber(formData: FormData, field: string) {
  const value = readOptionalString(formData, field);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric form field: ${field}`);
  }

  return parsed;
}
