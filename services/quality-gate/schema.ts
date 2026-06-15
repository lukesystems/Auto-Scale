import { z } from "zod";

export const QualityGateResultSchema = z.object({
  status: z.enum(["pass", "revise", "fail"]),
  score: z.number().min(0).max(1),
  failure_reasons: z.array(z.string()).default([]),
  fix_instructions: z.array(z.string()).default([]),
  risk_flags: z.array(z.string()).default([]),
  approved_for_export: z.boolean(),
});

export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;
