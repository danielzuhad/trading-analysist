import {
  assertMinimumLength,
  assertPositiveInteger,
  requireDefined,
} from "./math.js";

export function calculateRelativeStrengthIndex(values: number[], period = 14) {
  assertPositiveInteger("RSI period", period);
  assertMinimumLength("RSI", values.length, period + 1);

  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index <= period; index += 1) {
    const current = requireDefined(values[index], "Current RSI value");
    const previous = requireDefined(values[index - 1], "Previous RSI value");
    const delta = current - previous;
    averageGain += Math.max(delta, 0);
    averageLoss += Math.max(-delta, 0);
  }

  averageGain /= period;
  averageLoss /= period;

  for (let index = period + 1; index < values.length; index += 1) {
    const current = requireDefined(values[index], "Current RSI value");
    const previous = requireDefined(values[index - 1], "Previous RSI value");
    const delta = current - previous;
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageGain === 0 && averageLoss === 0) {
    return 50;
  }

  if (averageLoss === 0) {
    return 100;
  }

  if (averageGain === 0) {
    return 0;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}
