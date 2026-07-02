import { z } from "zod";
import type { VideoType } from "@/services/growth-run/schema";

export const PRODUCTION_MODES = [
  "fast_slides",
  "demo_short",
  "ai_broll_short",
  "founder_pov",
  "reference_remix",
  "ugc_presenter_later",
] as const;

export type ProductionMode = (typeof PRODUCTION_MODES)[number];

export const ProductionModeSchema = z.enum(PRODUCTION_MODES);

/** Modes with full render support in this pass. */
export const IMPLEMENTED_MODES: ProductionMode[] = [
  "fast_slides",
  "ai_broll_short",
];

export const SCAFFOLD_MODES: ProductionMode[] = [];

export const STUB_MODES: ProductionMode[] = ["founder_pov", "reference_remix", "ugc_presenter_later"];

export function resolveProductionMode(videoType: VideoType): ProductionMode {
  const map: Record<VideoType, ProductionMode> = {
    slide: "fast_slides",
    pain_led: "fast_slides",
    demo: "fast_slides",
    ai_broll: "ai_broll_short",
    trend_remix: "reference_remix",
    founder_pov: "founder_pov",
    objection: "fast_slides",
    comparison: "fast_slides",
    carousel: "fast_slides",
  };
  return map[videoType] ?? "fast_slides";
}

/** @deprecated Screen-demo removed — legacy DB rows map to ai_broll_short at runtime. */
export function normalizeProductionMode(
  mode: ProductionMode | string | null | undefined
): ProductionMode {
  if (mode === "demo_short") return "ai_broll_short";
  if (mode && PRODUCTION_MODES.includes(mode as ProductionMode)) {
    return mode as ProductionMode;
  }
  return "fast_slides";
}

export function productionModeToVideoType(mode: ProductionMode): VideoType {
  const map: Record<ProductionMode, VideoType> = {
    fast_slides: "slide",
    demo_short: "ai_broll",
    ai_broll_short: "ai_broll",
    founder_pov: "founder_pov",
    reference_remix: "trend_remix",
    ugc_presenter_later: "founder_pov",
  };
  return map[mode];
}

export interface ProductionModeSpec {
  mode: ProductionMode;
  label: string;
  description: string;
  implemented: boolean;
  fallbackMode: ProductionMode | null;
  requiresFal: boolean;
  requiresFfmpeg: boolean;
  requiresUpload: boolean;
  costCreditsEstimate: number;
  targetSceneCount: [number, number];
  defaultDurationSeconds: number;
  primaryVisualMethod: string;
}

export const PRODUCTION_MODE_SPECS: Record<ProductionMode, ProductionModeSpec> = {
  fast_slides: {
    mode: "fast_slides",
    label: "Fast Slides",
    description: "Bold hook slide, 4–7 SaaS-style slides, subtitles, optional voiceover, CTA end card.",
    implemented: true,
    fallbackMode: null,
    requiresFal: false,
    requiresFfmpeg: true,
    requiresUpload: false,
    costCreditsEstimate: 1,
    targetSceneCount: [4, 7],
    defaultDurationSeconds: 22,
    primaryVisualMethod: "slide",
  },
  demo_short: {
    mode: "demo_short",
    label: "Demo Short (removed)",
    description: "Deprecated — use AI B-Roll Short for generated video.",
    implemented: false,
    fallbackMode: "ai_broll_short",
    requiresFal: false,
    requiresFfmpeg: true,
    requiresUpload: false,
    costCreditsEstimate: 2,
    targetSceneCount: [4, 6],
    defaultDurationSeconds: 28,
    primaryVisualMethod: "ai_broll",
  },
  ai_broll_short: {
    mode: "ai_broll_short",
    label: "AI B-Roll Short",
    description: "Hook slide + AI b-roll scenes + CTA. fal/Seedance when configured.",
    implemented: true,
    fallbackMode: "fast_slides",
    requiresFal: true,
    requiresFfmpeg: true,
    requiresUpload: false,
    costCreditsEstimate: 8,
    targetSceneCount: [4, 6],
    defaultDurationSeconds: 24,
    primaryVisualMethod: "ai_broll",
  },
  founder_pov: {
    mode: "founder_pov",
    label: "Founder POV",
    description: "Founder-facing talking head — coming in Phase 3.",
    implemented: false,
    fallbackMode: "fast_slides",
    requiresFal: false,
    requiresFfmpeg: true,
    requiresUpload: false,
    costCreditsEstimate: 5,
    targetSceneCount: [3, 5],
    defaultDurationSeconds: 30,
    primaryVisualMethod: "founder_clip",
  },
  reference_remix: {
    mode: "reference_remix",
    label: "Reference Remix",
    description: "Remix a reference competitor format — coming in Phase 3.",
    implemented: false,
    fallbackMode: "ai_broll_short",
    requiresFal: true,
    requiresFfmpeg: true,
    requiresUpload: false,
    costCreditsEstimate: 10,
    targetSceneCount: [4, 6],
    defaultDurationSeconds: 22,
    primaryVisualMethod: "slide",
  },
  ugc_presenter_later: {
    mode: "ugc_presenter_later",
    label: "UGC Presenter",
    description: "UGC-style presenter — coming in Phase 3.",
    implemented: false,
    fallbackMode: "fast_slides",
    requiresFal: false,
    requiresFfmpeg: true,
    requiresUpload: false,
    costCreditsEstimate: 6,
    targetSceneCount: [3, 5],
    defaultDurationSeconds: 25,
    primaryVisualMethod: "ugc_clip",
  },
};
