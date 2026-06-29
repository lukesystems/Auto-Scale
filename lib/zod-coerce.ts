import { z } from "zod";

const CONFIDENCE_LEVEL_TO_SCORE: Record<string, number> = {
  low: 0.35,
  medium: 0.55,
  high: 0.85,
};

export function coerceConfidenceScore(value: unknown, fallback = 0.5): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(1, Math.max(0, value));
  }
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key in CONFIDENCE_LEVEL_TO_SCORE) return CONFIDENCE_LEVEL_TO_SCORE[key]!;
    const parsed = Number.parseFloat(key);
    if (!Number.isNaN(parsed)) return Math.min(1, Math.max(0, parsed));
  }
  return fallback;
}

export const confidenceScoreField = (fallback = 0.5) =>
  z.preprocess((value) => coerceConfidenceScore(value, fallback), z.number().min(0).max(1));

export function coerceDefaultString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["description", "summary", "label", "name", "text", "value"]) {
      if (typeof record[key] === "string" && (record[key] as string).trim()) {
        return (record[key] as string).trim();
      }
    }
  }
  return fallback;
}

export function defaultStringField(fallback: string) {
  return z.preprocess((value) => coerceDefaultString(value, fallback), z.string());
}

export function coerceLooseUrl(value: unknown, fallback = "https://example.com/unknown"): string {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
    }
  }
  return fallback;
}

export function looseUrlField(fallback = "https://example.com/unknown") {
  return z.preprocess((value) => coerceLooseUrl(value, fallback), z.string().min(1));
}

export function coerceEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  aliases: Record<string, T> = {},
  fallback: T
): T {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase().replace(/\s+/g, "_");
    if ((allowed as readonly string[]).includes(key)) return key as T;
    if (aliases[key]) return aliases[key];
    for (const candidate of allowed) {
      if (key.includes(candidate) || candidate.includes(key)) return candidate;
    }
  }
  return fallback;
}

export function enumField<T extends string>(
  allowed: readonly T[],
  fallback: T,
  aliases: Record<string, T> = {}
) {
  return z.preprocess(
    (value) => coerceEnumValue(value, allowed, aliases, fallback),
    z.enum(allowed as [T, ...T[]])
  );
}

export function coerceRecordEnumKeys<T extends string>(
  value: unknown,
  allowed: readonly T[],
  aliases: Record<string, T> = {}
): Partial<Record<T, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Partial<Record<T, number>> = {};
  for (const [rawKey, rawVal] of Object.entries(value as Record<string, unknown>)) {
    const key = coerceEnumValue(rawKey, allowed, aliases, allowed[0]!);
    const num =
      typeof rawVal === "number"
        ? rawVal
        : typeof rawVal === "string"
          ? Number.parseFloat(rawVal)
          : NaN;
    if (!Number.isNaN(num)) out[key] = Math.min(1, Math.max(0, num));
  }
  return out;
}

export function recordEnumMixField<T extends string>(
  allowed: readonly T[],
  fallback: T,
  aliases: Record<string, T> = {}
) {
  return z.preprocess(
    (value) => {
      const record = coerceRecordEnumKeys(value, allowed, aliases);
      const keys = Object.keys(record) as T[];
      if (keys.length === 0) return { [fallback]: 1 } as Record<T, number>;
      const sum = keys.reduce((s, k) => s + (record[k] ?? 0), 0);
      if (sum <= 0) return { [fallback]: 1 } as Record<T, number>;
      const normalized = {} as Record<T, number>;
      for (const k of keys) normalized[k] = (record[k] ?? 0) / sum;
      return normalized;
    },
    z.record(z.enum(allowed as [T, ...T[]]), z.number().min(0).max(1))
  );
}

export function ensureMinStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return fallback;
  }
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

export function minStringArrayField(fallback: string[]) {
  return z.preprocess(
    (value) => ensureMinStringArray(value, fallback),
    z.array(z.string()).min(1)
  );
}

export function coerceUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => uuidRe.test(item));
}

export const StringArraySchema = z.preprocess((value) => {
  if (typeof value === "string") return value.trim() ? [value] : [];
  return value;
}, z.array(z.string()).default([]));
