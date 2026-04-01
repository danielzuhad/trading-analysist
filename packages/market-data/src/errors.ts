import type { Metadata } from "@trading-analyst/shared-types";

export class MarketDataError extends Error {
  readonly code: string;
  readonly details: Metadata;
  readonly provider: string;

  constructor(
    provider: string,
    code: string,
    message: string,
    details: Metadata = {},
  ) {
    super(message);
    this.name = "MarketDataError";
    this.provider = provider;
    this.code = code;
    this.details = details;
  }
}

export class MarketDataTimeoutError extends MarketDataError {
  constructor(provider: string, message: string, details: Metadata = {}) {
    super(provider, "MARKET_DATA_TIMEOUT", message, details);
    this.name = "MarketDataTimeoutError";
  }
}

export class MarketDataProviderError extends MarketDataError {
  constructor(provider: string, message: string, details: Metadata = {}) {
    super(provider, "MARKET_DATA_PROVIDER_ERROR", message, details);
    this.name = "MarketDataProviderError";
  }
}

export class MarketDataConfigurationError extends MarketDataError {
  constructor(provider: string, message: string, details: Metadata = {}) {
    super(provider, "MARKET_DATA_CONFIGURATION_ERROR", message, details);
    this.name = "MarketDataConfigurationError";
  }
}

export class MarketDataValidationError extends MarketDataError {
  constructor(provider: string, message: string, details: Metadata = {}) {
    super(provider, "MARKET_DATA_VALIDATION_ERROR", message, details);
    this.name = "MarketDataValidationError";
  }
}
