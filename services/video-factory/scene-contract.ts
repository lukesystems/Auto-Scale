import { z } from "zod";

export const SCENE_PURPOSES = [
  "hook",
  "problem",
  "mechanism",
  "proof",
  "demo",
  "cta",
  "outro",
] as const;

export const VISUAL_METHODS = [
  "slide",
  "screenshot",
  "screen_recording",
  "ai_broll",
  "founder_clip",
  "ugc_clip",
] as const;

export const SCENE_STATUSES = ["planned", "rendering", "ready", "failed", "skipped"] as const;

export const SceneContractSchema = z.object({
  id: z.string().uuid().optional(),
  order: z.number().int().min(0),
  scene_type: z.string().min(1),
  purpose: z.enum(SCENE_PURPOSES),
  visual_method: z.enum(VISUAL_METHODS),
  voiceover_text: z.string().default(""),
  subtitle_text: z.string().default(""),
  overlay_text: z.string().default(""),
  visual_prompt: z.string().default(""),
  duration_seconds: z.number().positive(),
  asset_id: z.string().uuid().nullable().optional(),
  status: z.enum(SCENE_STATUSES).default("planned"),
  error: z.string().nullable().optional(),
});

export const ScenePlanSchema = z.object({
  production_mode: z.string(),
  aspect_ratio: z.string().default("9:16"),
  total_duration_seconds: z.number().positive(),
  scenes: z.array(SceneContractSchema).min(2),
});

export type SceneContract = z.infer<typeof SceneContractSchema>;
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

/** Map legacy storyboard role → scene purpose. */
export function roleToPurpose(role: string): SceneContract["purpose"] {
  const map: Record<string, SceneContract["purpose"]> = {
    hook: "hook",
    context: "problem",
    demo: "demo",
    proof: "proof",
    cta: "cta",
    outro: "outro",
    transition: "outro",
  };
  return map[role] ?? "mechanism";
}

/** Map legacy asset_method → visual_method. */
export function assetMethodToVisualMethod(
  assetMethod: string
): SceneContract["visual_method"] {
  const map: Record<string, SceneContract["visual_method"]> = {
    slide: "slide",
    image: "slide",
    stock: "slide",
    user_upload: "screenshot",
    screen_demo: "screen_recording",
    fal_clip: "ai_broll",
  };
  return map[assetMethod] ?? "slide";
}

export type LegacySceneRole =
  | "hook"
  | "context"
  | "demo"
  | "proof"
  | "cta"
  | "outro"
  | "transition";

export function purposeToRole(purpose: SceneContract["purpose"]): LegacySceneRole {
  const map: Record<SceneContract["purpose"], LegacySceneRole> = {
    hook: "hook",
    problem: "context",
    mechanism: "context",
    proof: "proof",
    demo: "demo",
    cta: "cta",
    outro: "outro",
  };
  return map[purpose];
}

export function visualMethodToAssetMethod(
  method: SceneContract["visual_method"]
): "slide" | "fal_clip" | "screen_demo" | "stock" | "image" | "user_upload" {
  const map: Record<SceneContract["visual_method"], "slide" | "fal_clip" | "screen_demo" | "stock" | "image" | "user_upload"> = {
    slide: "slide",
    screenshot: "image",
    screen_recording: "screen_demo",
    ai_broll: "fal_clip",
    founder_clip: "user_upload",
    ugc_clip: "user_upload",
  };
  return map[method];
}
