const MIN_SHORT_FORM_SECONDS = 6;
const MAX_SHORT_FORM_SECONDS = 180;

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function clampShortFormSeconds(value: number): number {
  return Math.min(MAX_SHORT_FORM_SECONDS, Math.max(MIN_SHORT_FORM_SECONDS, Math.round(value)));
}

/**
 * Normalize AI-provided preferred_length_seconds into a [min, max] tuple.
 * Returns undefined when the value is empty or unusable.
 */
export function normalizePreferredLengthSeconds(
  value: unknown
): [number, number] | undefined {
  if (value == null) return undefined;

  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;

    const numbers = value
      .map(toPositiveNumber)
      .filter((n): n is number => n != null);
    if (numbers.length === 0) return undefined;

    if (numbers.length === 1) {
      const single = clampShortFormSeconds(numbers[0]);
      return [single, single];
    }

    let min = clampShortFormSeconds(numbers[0]);
    let max = clampShortFormSeconds(numbers[1]);
    if (max < min) [min, max] = [max, min];
    return [min, max];
  }

  const single = toPositiveNumber(value);
  if (single == null) return undefined;
  const clamped = clampShortFormSeconds(single);
  return [clamped, clamped];
}
