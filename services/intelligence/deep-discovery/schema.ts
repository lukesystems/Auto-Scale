import { z } from "zod";
import { coerceDiscoveryQuery, coerceHypotheses, coerceToString } from "@/services/ai/coerce-llm-output";
import { DiscoveryQuerySchema } from "../discovery/schema";

/**
 * One round of agentic reasoning. The model observes the evidence gathered so
 * far, records its current thinking, and decides what to search next or whether
 * it has enough evidence to stop. This is the "real-time pondering" step.
 */
export const DeepDiscoveryActionSchema = z.object({
  thought: z.preprocess(
    (val) => coerceToString(val) || "Continuing discovery based on current evidence.",
    z.string().min(1)
  ),
  hypotheses: z.preprocess((val) => coerceHypotheses(val), z.array(z.string()).default([])),
  next_queries: z
    .preprocess(
      (val) => (Array.isArray(val) ? val.map((q) => coerceDiscoveryQuery(q)) : []),
      z.array(DiscoveryQuerySchema).max(5)
    ),
  should_continue: z.preprocess((val) => (typeof val === "boolean" ? val : true), z.boolean()),
  stop_reason: z.string().nullable().default(null),
});

export type DeepDiscoveryAction = z.infer<typeof DeepDiscoveryActionSchema>;

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const CompetitorKindSchema = z.enum([
  "direct",
  "indirect",
  "creator",
  "audience_magnet",
  "community",
  "unknown",
]);

/**
 * A consolidated view of a single competitor / account, derived from one or
 * more discovered sources. Founders think in competitors, not URLs.
 */
export const CompetitorStrategyProfileSchema = z.object({
  name: z.preprocess((val) => coerceToString(val) || "Unnamed competitor", z.string().min(1)),
  kind: CompetitorKindSchema.default("unknown"),
  platforms: z.array(z.string()).default([]),
  handles: z.array(z.string()).default([]),
  what_they_do: z.preprocess(
    (val) => coerceToString(val) || "Not described in gathered evidence.",
    z.string()
  ).describe("Plain description of who they are and how they show up."),
  working_patterns: z
    .array(z.string())
    .default([])
    .describe("Observed repeatable moves that appear to drive distribution."),
  hooks: z.array(z.string()).default([]),
  formats: z.array(z.string()).default([]),
  evidence_urls: z
    .array(z.string())
    .default([])
    .describe("Source URLs that back this profile. Must be from discovered evidence."),
  confidence: ConfidenceSchema.default("low"),
  caveats: z
    .array(z.string())
    .default([])
    .describe("What could not be verified (metrics, recency, attribution)."),
});

export type CompetitorStrategyProfile = z.infer<typeof CompetitorStrategyProfileSchema>;

export const MarketPatternSchema = z.object({
  pattern: z.string().min(1),
  why_it_works: z.string(),
  evidence_urls: z.array(z.string()).default([]),
  transferability: z
    .number()
    .min(0)
    .max(1)
    .describe("0-1 how transferable this is to THIS founder's product."),
  confidence: ConfidenceSchema.default("low"),
});

export type MarketPattern = z.infer<typeof MarketPatternSchema>;

/**
 * Intelligence-only follow-up angle — not a content experiment or post to run.
 * Deferred to later phases (TrendWatch / Content Conveyor).
 */
export const SuggestedOpportunitySchema = z.object({
  title: z.string().min(1),
  description: z
    .string()
    .describe("What to study or monitor next based on evidence — not a content experiment."),
  platform: z.string().nullable().default(null),
  evidence_urls: z.array(z.string()).default([]),
});

export type SuggestedOpportunity = z.infer<typeof SuggestedOpportunitySchema>;

/**
 * Final synthesis the deep loop produces after gathering evidence. Separates
 * observed evidence from strategic inference and never states performance as
 * fact without a source.
 */
export const MarketSynthesisSchema = z.object({
  summary: z.preprocess(
    (val) => coerceToString(val) || "Synthesis summary not provided.",
    z.string().min(1)
  ),
  competitors: z.array(CompetitorStrategyProfileSchema).default([]),
  market_patterns: z.array(MarketPatternSchema).default([]),
  white_space: z
    .array(z.string())
    .default([])
    .describe("Underused angles/formats where this founder could differentiate."),
  suggested_opportunities: z
    .array(SuggestedOpportunitySchema)
    .default([])
    .describe("Intelligence gaps or angles worth deeper study — not experiments to run."),
  overall_confidence: ConfidenceSchema.default("low"),
  caveats: z.array(z.string()).default([]),
});

export type MarketSynthesis = z.infer<typeof MarketSynthesisSchema>;
