/**
 * Coerce common LLM JSON shape mistakes before Zod validation.
 * OpenRouter / gpt-4o-mini often nests objects, uses strings for numbers, or returns arrays for scalar fields.
 */

const ACCOUNT_TYPES = [
  "official",
  "competitor",
  "shadow",
  "creator",
  "partner",
  "affiliate",
  "review",
  "unknown",
] as const;

const ASSET_METHODS = [
  "slide",
  "fal_clip",
  "screen_demo",
  "stock",
  "image",
  "user_upload",
] as const;

const DISCOVERY_INTENTS = [
  "competitor",
  "indirect_competitor",
  "platform",
  "pain",
  "alternative",
  "comparison",
  "community",
  "creator",
  "shadow_account",
  "distribution",
] as const;

const PATTERN_TYPES = [
  "hook",
  "pain",
  "angle",
  "format",
  "cta",
  "visual",
  "offer",
  "positioning",
] as const;

export function coerceToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .filter((x) => typeof x === "string")
      .join(" ")
      .trim();
  }
  if (value === null || value === undefined) return "";
  return String(value);
}

export function parseFollowerCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "unknown" || raw === "n/a") return null;
  const match = raw.replace(/,/g, "").match(/^([\d.]+)\s*([kmb])?$/i);
  if (!match) {
    const digits = parseInt(raw.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(digits) ? digits : null;
  }
  const base = parseFloat(match[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = (match[2] ?? "").toLowerCase();
  if (suffix === "k") return Math.round(base * 1_000);
  if (suffix === "m") return Math.round(base * 1_000_000);
  if (suffix === "b") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

export function coerceAccountType(value: unknown): (typeof ACCOUNT_TYPES)[number] {
  if (typeof value !== "string") return "unknown";
  const v = value.toLowerCase().trim();
  if ((ACCOUNT_TYPES as readonly string[]).includes(v)) {
    return v as (typeof ACCOUNT_TYPES)[number];
  }
  if (v.includes("shadow") || v.includes("unofficial")) return "shadow";
  if (v.includes("official") || v.includes("brand")) return "official";
  if (v.includes("competitor")) return "competitor";
  if (v.includes("creator") || v.includes("mid-tier") || v.includes("mid tier")) {
    return "creator";
  }
  if (v.includes("partner")) return "partner";
  if (v.includes("affiliate")) return "affiliate";
  if (v.includes("review")) return "review";
  return "unknown";
}

export function coerceAssetMethod(value: unknown): (typeof ASSET_METHODS)[number] {
  if (typeof value === "string" && (ASSET_METHODS as readonly string[]).includes(value)) {
    return value as (typeof ASSET_METHODS)[number];
  }
  return "slide";
}

function inferDiscoveryIntent(query: string): (typeof DISCOVERY_INTENTS)[number] {
  const q = query.toLowerCase();
  if (q.includes("shadow") || q.includes("unofficial")) return "shadow_account";
  if (q.includes("reddit.com") || q.includes("discord")) return "community";
  if (q.includes("site:g2") || q.includes("capterra") || q.includes(" vs ")) return "comparison";
  if (q.includes("tiktok") || q.includes("instagram") || q.includes("youtube")) return "distribution";
  if (q.includes("competitor") || q.includes("alternative")) return "competitor";
  return "distribution";
}

export function coerceDiscoveryQuery(item: unknown): {
  query: string;
  intent: (typeof DISCOVERY_INTENTS)[number];
  platform_hint: string | null;
  reason: string;
} {
  if (typeof item === "string") {
    const query = item.trim();
    return {
      query,
      intent: inferDiscoveryIntent(query),
      platform_hint: null,
      reason: "Inferred from query string",
    };
  }
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const query = coerceToString(o.query ?? o.q ?? "").trim() || "niche discovery query";
    const intentRaw = coerceToString(o.intent ?? "");
    const intent = (DISCOVERY_INTENTS as readonly string[]).includes(intentRaw)
      ? (intentRaw as (typeof DISCOVERY_INTENTS)[number])
      : inferDiscoveryIntent(query);
    return {
      query,
      intent,
      platform_hint: typeof o.platform_hint === "string" ? o.platform_hint : null,
      reason: coerceToString(o.reason ?? o.rationale ?? "Discovery follow-up"),
    };
  }
  return {
    query: "niche discovery query",
    intent: "distribution",
    platform_hint: null,
    reason: "Fallback query",
  };
}

export function coerceHypotheses(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => coerceToString(x)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function coercePatternType(value: unknown): (typeof PATTERN_TYPES)[number] {
  const v = coerceToString(value).toLowerCase();
  if ((PATTERN_TYPES as readonly string[]).includes(v)) {
    return v as (typeof PATTERN_TYPES)[number];
  }
  if (v.includes("hook")) return "hook";
  if (v.includes("pain")) return "pain";
  if (v.includes("cta")) return "cta";
  if (v.includes("format")) return "format";
  if (v.includes("position")) return "positioning";
  return "angle";
}

/** Unwrap common single-key wrappers before Zod parse. */
export function unwrapStructuredPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  let obj = { ...(payload as Record<string, unknown>) };

  for (const key of ["Storyboard", "storyboard", "source_classification"]) {
    const nested = obj[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      obj = { ...obj, ...(nested as Record<string, unknown>) };
      delete obj[key];
    }
  }

  if (Array.isArray(obj.consolidated_patterns) && !obj.patterns) {
    obj.patterns = obj.consolidated_patterns;
    delete obj.consolidated_patterns;
  }

  if (Array.isArray(obj.scenes)) {
    obj.scenes = obj.scenes.map((scene, idx) => normalizeStoryboardScene(scene, idx));
  }

  if ("next_queries" in obj || "should_continue" in obj || "thought" in obj) {
    obj = normalizeDiscoveryAction(obj);
  }

  if (Array.isArray(obj.patterns)) {
    obj.patterns = obj.patterns.map((p) => normalizePatternRow(p));
  }

  return obj;
}

function normalizeStoryboardScene(scene: unknown, idx: number): Record<string, unknown> {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
    return { scene_index: idx, role: "hook", duration_seconds: 2, visual_intent: "" };
  }
  const s = { ...(scene as Record<string, unknown>) };
  if (s.scene_index === undefined) s.scene_index = idx;
  s.on_screen_text = coerceToString(s.on_screen_text);
  s.voiceover_line = coerceToString(s.voiceover_line);
  s.visual_intent = coerceToString(s.visual_intent);
  s.asset_method = coerceAssetMethod(s.asset_method);
  s.asset_prompt = coerceToString(s.asset_prompt);
  return s;
}

function normalizeDiscoveryAction(obj: Record<string, unknown>): Record<string, unknown> {
  const next = Array.isArray(obj.next_queries)
    ? obj.next_queries.map((q) => coerceDiscoveryQuery(q))
    : [];

  const hypotheses = coerceHypotheses(obj.hypotheses);
  const thought =
    coerceToString(obj.thought) ||
    coerceToString(obj.reasoning) ||
    "Continuing discovery based on current evidence.";

  let shouldContinue = obj.should_continue;
  if (typeof shouldContinue !== "boolean") {
    shouldContinue = next.length > 0;
  }

  return {
    ...obj,
    thought,
    hypotheses,
    next_queries: next,
    should_continue: shouldContinue,
    stop_reason: obj.stop_reason ?? null,
  };
}

function normalizePatternRow(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return {
      pattern_type: "angle",
      label: "Observed pattern",
      summary: "Pattern from sources",
      why_it_matters: "May inform hook and angle tests",
      how_to_use: "Adapt to product brief with evidence",
      group_keys: ["fallback"],
    };
  }
  const r = row as Record<string, unknown>;
  const summary =
    coerceToString(r.summary) ||
    coerceToString(r.pattern) ||
    coerceToString(r.label) ||
    "Observed pattern";
  return {
    pattern_type: coercePatternType(r.pattern_type ?? r.patternType ?? r.type),
    label: coerceToString(r.label) || summary.slice(0, 80),
    summary,
    why_it_matters:
      coerceToString(r.why_it_matters) ||
      coerceToString(r.whyItMatters) ||
      "Relevant to niche content performance",
    how_to_use:
      coerceToString(r.how_to_use) ||
      coerceToString(r.howToUse) ||
      "Test in controlled hook variants",
    group_keys: Array.isArray(r.group_keys)
      ? r.group_keys.map((k) => coerceToString(k)).filter(Boolean)
      : ["ungrouped"],
  };
}
