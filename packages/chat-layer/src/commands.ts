import type {
  PositionDirection,
  SupportedTimeframe,
} from "@trading-analyst/shared-types";

export type ChatCommand =
  | {
      kind: "asset";
      symbol: string;
      timeframe: SupportedTimeframe;
    }
  | {
      kind: "help";
    }
  | {
      kind: "invalid";
      message: string;
    }
  | {
      kind: "position_close";
      note?: string;
      symbol: string;
    }
  | {
      direction: PositionDirection;
      entryPrice: number;
      kind: "position_open";
      quantity: number;
      stopLoss?: number;
      symbol: string;
      thesis?: string;
      timeframe: SupportedTimeframe;
    }
  | {
      kind: "unknown";
      input: string;
    }
  | {
      kind: "watchlist";
      timeframe: SupportedTimeframe;
    };

const recognizedFieldTokens = new Set([
  "entry",
  "qty",
  "quantity",
  "stop",
  "sl",
  "tf",
  "timeframe",
  "thesis",
]);

export function parseChatCommand(input: string): ChatCommand {
  const normalized = normalizeWhitespace(input);

  if (normalized.length === 0) {
    return { kind: "help" };
  }

  const lower = normalized.toLowerCase();
  const watchlistMatch = normalized.match(/^(watchlist|wl)(?:\s+(1h|4h))?$/i);

  if (watchlistMatch) {
    return {
      kind: "watchlist",
      timeframe: parseTimeframe(watchlistMatch[2]) ?? "4H",
    };
  }

  if (lower === "help" || lower === "menu" || lower === "commands") {
    return { kind: "help" };
  }

  const closeMatch = normalized.match(
    /^(close|exit)\s+([a-z0-9]+)(?:\s+note\s+(.+))?$/i,
  );

  if (closeMatch) {
    const symbol = closeMatch[2];

    if (!symbol) {
      return {
        kind: "unknown",
        input: normalized,
      };
    }

    return {
      kind: "position_close",
      ...(closeMatch[3] ? { note: closeMatch[3].trim() } : {}),
      symbol: symbol.toUpperCase(),
    };
  }

  if (lower.startsWith("position ")) {
    return parsePositionOpenCommand(normalized);
  }

  const assetMatch = normalized.match(
    /^(asset|analysis)\s+([a-z0-9]+)(?:\s+(1h|4h))?$/i,
  );

  if (assetMatch) {
    const symbol = assetMatch[2];

    if (!symbol) {
      return {
        kind: "unknown",
        input: normalized,
      };
    }

    return {
      kind: "asset",
      symbol: symbol.toUpperCase(),
      timeframe: parseTimeframe(assetMatch[3]) ?? "4H",
    };
  }

  const shorthandAssetMatch = normalized.match(/^([a-z0-9]+)(?:\s+(1h|4h))?$/i);

  if (shorthandAssetMatch) {
    const symbol = shorthandAssetMatch[1];

    if (!symbol) {
      return {
        kind: "unknown",
        input: normalized,
      };
    }

    return {
      kind: "asset",
      symbol: symbol.toUpperCase(),
      timeframe: parseTimeframe(shorthandAssetMatch[2]) ?? "4H",
    };
  }

  return {
    kind: "unknown",
    input: normalized,
  };
}

function normalizeWhitespace(input: string) {
  return input.trim().replaceAll(/\s+/g, " ");
}

function parseDirection(value: string | undefined): PositionDirection | null {
  if (value === "long" || value === "short") {
    return value;
  }

  return null;
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePositionOpenCommand(input: string): ChatCommand {
  const tokens = input.split(" ");
  const symbol = tokens[1]?.toUpperCase();
  const direction = parseDirection(tokens[2]?.toLowerCase());

  if (!symbol || !direction) {
    return {
      kind: "invalid",
      message:
        "Format posisi: POSITION BTC LONG ENTRY 84000 QTY 0.10 STOP 82000",
    };
  }

  const fields = readCommandFields(tokens.slice(3));
  const entryPrice = parseNumber(fields.entry);
  const quantity = parseNumber(fields.qty ?? fields.quantity);
  const stopLoss = parseNumber(fields.stop ?? fields.sl);
  const timeframe = parseTimeframe(fields.tf ?? fields.timeframe) ?? "4H";

  if (entryPrice === undefined || quantity === undefined) {
    return {
      kind: "invalid",
      message:
        "Perintah posisi wajib punya ENTRY dan QTY. Contoh: POSITION BTC LONG ENTRY 84000 QTY 0.10",
    };
  }

  return {
    direction,
    entryPrice,
    kind: "position_open",
    quantity,
    ...(stopLoss !== undefined ? { stopLoss } : {}),
    symbol,
    ...(fields.thesis ? { thesis: fields.thesis } : {}),
    timeframe,
  };
}

function parseTimeframe(value: string | undefined): SupportedTimeframe | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === "1H" || normalized === "4H") {
    return normalized;
  }

  return null;
}

function readCommandFields(tokens: string[]) {
  const fields: Record<string, string> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const rawToken = tokens[index];

    if (!rawToken) {
      continue;
    }

    if (rawToken.startsWith("@")) {
      fields.entry = rawToken.slice(1);
      continue;
    }

    if (rawToken.includes("=")) {
      const [rawKey, ...valueParts] = rawToken.split("=");

      if (!rawKey) {
        continue;
      }

      const key = rawKey.toLowerCase();

      if (valueParts.length > 0) {
        fields[key] = valueParts.join("=");
      }

      continue;
    }

    const key = rawToken.toLowerCase();

    if (!recognizedFieldTokens.has(key)) {
      continue;
    }

    if (key === "thesis") {
      fields.thesis = tokens
        .slice(index + 1)
        .join(" ")
        .trim();
      break;
    }

    const nextToken = tokens[index + 1];

    if (nextToken) {
      fields[key] = nextToken;
      index += 1;
    }
  }

  return fields;
}
