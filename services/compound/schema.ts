import { z } from "zod";

export const WinnerDiagnosisSchema = z.object({
  winning_reason: z.string(),
  winning_elements: z.object({
    hook: z.string().default(""),
    format: z.string().default(""),
    angle: z.string().default(""),
    audience: z.string().default(""),
    cta: z.string().default(""),
    visual_style: z.string().default(""),
  }),
  recommended_next_actions: z.array(z.string()).default([]),
  variant_plan: z
    .array(
      z.object({
        hook: z.string(),
        angle: z.string().default(""),
      })
    )
    .default([]),
  learning_to_store: z.string(),
});
export type WinnerDiagnosis = z.infer<typeof WinnerDiagnosisSchema>;

export const VariantsSchema = z.object({
  variants: z.array(
    z.object({
      hook: z.string(),
      angle: z.string().default(""),
      format: z.string().default(""),
      target_audience: z.string().default(""),
    })
  ),
});
export type Variants = z.infer<typeof VariantsSchema>;
