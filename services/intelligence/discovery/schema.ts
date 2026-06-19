import { z } from "zod";

export const DiscoveryIntentSchema = z.enum([
  "competitor",
  "indirect_competitor",
  "platform",
  "pain",
  "alternative",
  "comparison",
  "community",
  "creator",
]);

export type DiscoveryIntent = z.infer<typeof DiscoveryIntentSchema>;

export const DiscoveryQuerySchema = z.object({
  query: z.string().min(3),
  intent: DiscoveryIntentSchema,
  platform_hint: z.string().nullable().optional(),
  reason: z.string(),
});

export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;

export const DiscoveryPlanSchema = z.object({
  queries: z.array(DiscoveryQuerySchema).min(3).max(15),
  notes: z.array(z.string()).default([]),
});

export type DiscoveryPlan = z.infer<typeof DiscoveryPlanSchema>;
