export class IndicatorCalculationError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "IndicatorCalculationError";
    this.details = details;
  }
}
