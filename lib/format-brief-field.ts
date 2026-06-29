/**
 * Format brief fields for display — coerces JSON-ish LLM output into readable text.
 */
export function formatBriefField(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return formatBriefValue(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => formatBriefField(item)).filter((s) => s !== "—");
    return items.length > 0 ? items.join(", ") : "—";
  }
  if (typeof value === "object") {
    return formatBriefValue(value as Record<string, unknown>);
  }
  return String(value);
}

function formatBriefValue(record: Record<string, unknown>): string {
  const role = pickString(record, ["role", "persona", "segment", "name", "label"]);
  const stage = pickString(record, ["stage", "company_stage", "maturity"]);
  const context = pickString(record, ["context", "description", "summary", "audience"]);
  const parts = [role, stage, context].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");

  const values = Object.values(record)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return values.length > 0 ? values.join(" · ") : JSON.stringify(record);
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}
