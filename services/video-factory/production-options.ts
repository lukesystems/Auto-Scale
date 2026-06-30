import { z } from "zod";

import type { ProductionMode } from "./production-modes";



/** User-selectable production format (one per run or concept). */

export const PRODUCTION_FORMATS = [

  "pain_led",

  "slide",

  "ai_broll_short",

  "objection",

  "comparison",

  "demo_short",

] as const;

export type ProductionFormat = (typeof PRODUCTION_FORMATS)[number];

export const ProductionFormatSchema = z.enum(PRODUCTION_FORMATS);



/** User-selectable audio mode for rendered videos. */

export const AUDIO_MODES = ["music_only", "voiceover", "voiceover_bgm"] as const;

export type AudioMode = (typeof AUDIO_MODES)[number];

export const AudioModeSchema = z.enum(AUDIO_MODES);



/** Fal render mode: cinematic b-roll vs slide-only fast path. */

export const FAL_RENDER_MODES = ["cinematic", "fast"] as const;

export type FalRenderMode = (typeof FAL_RENDER_MODES)[number];

export const FalRenderModeSchema = z.enum(FAL_RENDER_MODES);

/** Optional override for fal model sophistication within a run. */
export const FAL_MODEL_TIERS = ["auto", "fast", "standard", "cinematic"] as const;
export type FalModelTier = (typeof FAL_MODEL_TIERS)[number];
export const FalModelTierSchema = z.enum(FAL_MODEL_TIERS);

export interface ProductionFormatSpec {

  format: ProductionFormat;

  label: string;

  description: string;

  implemented: boolean;

  requiresFal: boolean;

  requiresUpload: boolean;

  fallbackFormat: ProductionFormat | null;

  defaultAudioModes: AudioMode[];

  defaultBgmMood: "energetic" | "calm" | "tech";

}



export const PRODUCTION_FORMAT_SPECS: Record<ProductionFormat, ProductionFormatSpec> = {

  pain_led: {

    format: "pain_led",

    label: "Pain-led",

    description:

      "Bold hook slide → AI or slide middle scenes (problem, mechanism, proof) → slide CTA. Best for problem-aware audiences.",

    implemented: true,

    requiresFal: false,

    requiresUpload: false,

    fallbackFormat: "slide",

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "tech",

  },

  slide: {

    format: "slide",

    label: "Slide deck",

    description: "100% Sharp/SVG slides with on-screen text. Fast, reliable, no AI b-roll required.",

    implemented: true,

    requiresFal: false,

    requiresUpload: false,

    fallbackFormat: null,

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "calm",

  },

  ai_broll_short: {

    format: "ai_broll_short",

    label: "AI B-roll short",

    description:

      "Slide hook + Seedance T2V middle scenes + slide CTA. Requires FAL_KEY for cinematic b-roll.",

    implemented: true,

    requiresFal: true,

    requiresUpload: false,

    fallbackFormat: "pain_led",

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "tech",

  },

  objection: {

    format: "objection",

    label: "Objection handler",

    description: "Myth → Reality → Proof → CTA. Handles skeptic beliefs with evidence-backed rebuttals.",

    implemented: true,

    requiresFal: false,

    requiresUpload: false,

    fallbackFormat: "pain_led",

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "calm",

  },

  comparison: {

    format: "comparison",

    label: "Comparison",

    description: "Split Them vs Us slides with proof beat and verdict CTA. Great for category positioning.",

    implemented: true,

    requiresFal: false,

    requiresUpload: false,

    fallbackFormat: "slide",

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "energetic",

  },

  demo_short: {

    format: "demo_short",

    label: "Demo short",

    description:

      "Hook + problem + screen demo + proof + CTA. Upload a product screen recording or use a placeholder slide.",

    implemented: true,

    requiresFal: false,

    requiresUpload: true,

    fallbackFormat: "pain_led",

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "tech",

  },

};



export interface AudioModeSpec {

  mode: AudioMode;

  label: string;

  description: string;

  requiresElevenLabs: boolean;

}



export const AUDIO_MODE_SPECS: Record<AudioMode, AudioModeSpec> = {

  music_only: {

    mode: "music_only",

    label: "Music only",

    description: "No voiceover — background music drives pacing; on-screen text carries the message.",

    requiresElevenLabs: false,

  },

  voiceover: {

    mode: "voiceover",

    label: "Voiceover",

    description: "ElevenLabs TTS narration only — no background music.",

    requiresElevenLabs: true,

  },

  voiceover_bgm: {

    mode: "voiceover_bgm",

    label: "Voice + music",

    description: "ElevenLabs voiceover mixed with royalty-free background music (ducked under voice).",

    requiresElevenLabs: true,

  },

};



/** Map user-facing format to internal production mode. */

export function resolveProductionModeFromFormat(format: ProductionFormat): ProductionMode {

  switch (format) {

    case "slide":

    case "pain_led":

    case "objection":

    case "comparison":

      return "fast_slides";

    case "ai_broll_short":

      return "ai_broll_short";

    case "demo_short":

      return "demo_short";

    default:

      return "fast_slides";

  }

}



/** Whether middle scenes should prefer fal/ai_broll for this format. */
/** Pass `falConfigured` from server (`isFalConfigured()`); client code must not call this without it. */
export function preferAiBrollForFormat(
  format: ProductionFormat,
  falRenderMode: FalRenderMode = "cinematic",
  falConfigured = false
): boolean {
  if (falRenderMode === "fast" || !falConfigured) return false;
  return format === "ai_broll_short" || format === "pain_led";
}



/** Map production format to concept video_type for strategy alignment. */

export function productionFormatToVideoType(

  format: ProductionFormat

): "slide" | "pain_led" | "ai_broll" | "objection" | "comparison" | "demo" {

  switch (format) {

    case "slide":

      return "slide";

    case "pain_led":

      return "pain_led";

    case "ai_broll_short":

      return "ai_broll";

    case "objection":

      return "objection";

    case "comparison":

      return "comparison";

    case "demo_short":

      return "demo";

  }

}



export function resolveProductionOptions(input: {

  productionFormat?: ProductionFormat | null;

  audioMode?: AudioMode | null;

  falRenderMode?: FalRenderMode | null;

  falModelTier?: FalModelTier | null;

  projectDefaults?: {

    production_format?: ProductionFormat | null;

    audio_mode?: AudioMode | null;

    fal_render_mode?: FalRenderMode | null;

    fal_model_tier?: FalModelTier | null;

  };

}): {

  productionFormat: ProductionFormat;

  audioMode: AudioMode;

  falRenderMode: FalRenderMode;

  falModelTier: FalModelTier;

} {

  const productionFormat =

    input.productionFormat ??

    input.projectDefaults?.production_format ??

    "slide";

  const audioMode =

    input.audioMode ?? input.projectDefaults?.audio_mode ?? "voiceover";

  const falRenderMode =

    input.falRenderMode ??

    input.projectDefaults?.fal_render_mode ??

    "fast";

  const falModelTier =

    input.falModelTier ??

    input.projectDefaults?.fal_model_tier ??

    "auto";

  return {

    productionFormat: ProductionFormatSchema.parse(productionFormat),

    audioMode: AudioModeSchema.parse(audioMode),

    falRenderMode: FalRenderModeSchema.parse(falRenderMode),

    falModelTier: FalModelTierSchema.parse(falModelTier),

  };

}



export function audioModeUsesVoiceover(mode: AudioMode): boolean {

  return mode === "voiceover" || mode === "voiceover_bgm";

}



export function audioModeUsesMusic(mode: AudioMode): boolean {

  return mode === "music_only" || mode === "voiceover_bgm";

}



export function bgmMoodForFormat(format: ProductionFormat): "energetic" | "calm" | "tech" {

  return PRODUCTION_FORMAT_SPECS[format].defaultBgmMood;

}


