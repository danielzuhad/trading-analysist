import { IndicatorCalculationError } from "./errors.js";

export function average(values: number[]) {
  if (values.length === 0) {
    throw new IndicatorCalculationError(
      "Cannot calculate an average from an empty series",
    );
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function assertMinimumLength(
  name: string,
  actualLength: number,
  requiredLength: number,
) {
  if (actualLength < requiredLength) {
    throw new IndicatorCalculationError(
      `${name} requires at least ${requiredLength} data points`,
      {
        actualLength,
        requiredLength,
      },
    );
  }
}

export function assertPositiveInteger(name: string, value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new IndicatorCalculationError(`${name} must be a positive integer`, {
      value,
    });
  }
}

export function lastValue<T>(values: T[], name: string) {
  const value = values.at(-1);

  if (value === undefined) {
    throw new IndicatorCalculationError(`${name} cannot be empty`);
  }

  return value;
}

export function requireDefined<T>(value: T | undefined, name: string) {
  if (value === undefined) {
    throw new IndicatorCalculationError(`${name} is required`);
  }

  return value;
}
