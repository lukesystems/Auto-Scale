import { z } from "zod";

export const HookSchema = z.object({
  hook: z.string(),
  angle: z.string().default(""),
  format_hint: z.string().default(""),
  target_audience: z.string().default(""),
});
export const HooksSchema = z.object({ hooks: z.array(HookSchema) });
export type Hooks = z.infer<typeof HooksSchema>;

export const ContentIdeaSchema = z.object({
  format: z.string(),
  hook: z.string(),
  angle: z.string().default(""),
  target_audience: z.string().default(""),
  why_this_should_work: z.string().default(""),
  hypothesis: z.string().default(""),
  platforms: z.array(z.string()).default([]),
  metric_to_watch: z.string().default("saves"),
  risk_level: z.enum(["low", "medium", "high"]).default("medium"),
  variant_suggestions: z.array(z.string()).default([]),
});
export const ContentIdeasSchema = z.object({ ideas: z.array(ContentIdeaSchema) });
export type ContentIdeas = z.infer<typeof ContentIdeasSchema>;

export const PostSlideSchema = z.object({
  slide_number: z.number().int().positive(),
  headline: z.string(),
  body: z.string().default(""),
});

export const GeneratedPostSchema = z.object({
  format: z.string(),
  platform: z.string(),
  hook: z.string(),
  angle: z.string().default(""),
  target_audience: z.string().default(""),
  hypothesis: z.string().default(""),
  caption: z.string().default(""),
  cta: z.string().default(""),
  metric_to_watch: z.string().default("saves"),
  slides: z.array(PostSlideSchema).default([]),
});
export type GeneratedPostDraft = z.infer<typeof GeneratedPostSchema>;
