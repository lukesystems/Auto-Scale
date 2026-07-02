import "server-only";

const UNSAFE_TERMS = [
  "fake testimonial",
  "impersonat",
  "guaranteed results",
  "100% success",
  "as seen on tv",
  "celebrity",
  "doctor recommends",
];

export function brandSafetyCheckPrompt(prompt: string): { ok: boolean; reason?: string } {
  const lower = prompt.toLowerCase();
  for (const term of UNSAFE_TERMS) {
    if (lower.includes(term)) {
      return { ok: false, reason: `Prompt blocked: contains "${term}"` };
    }
  }
  if (prompt.length < 8) {
    return { ok: false, reason: "Prompt too short for useful b-roll." };
  }
  return { ok: true };
}

export interface BrollPromptInput {
  productSummary: string;
  scenePurpose: string;
  hook: string;
  audience: string;
  tone: string;
  trendInference?: string;
  overlayText?: string;
  durationSeconds?: number;
  aspectRatio?: string;
}

const SCENE_DIRECTION: Record<string, {
  visual: string;
  camera: string;
  motion: string;
  mood: string;
}> = {
  hook: {
    visual: "Bold, attention-grabbing abstract shapes or light streaks converging toward center",
    camera: "Slow push-in from medium to close-up",
    motion: "Fast particle burst that settles into smooth flow, high energy opening",
    mood: "Dramatic, high-contrast lighting with deep shadows and vivid accent color",
  },
  problem: {
    visual: "Visual metaphor for friction — tangled wires, scattered papers, or fragmented grid breaking apart",
    camera: "Static wide shot with subtle drift, or slow dolly revealing chaos",
    motion: "Elements slowly disintegrating or scattering outward, conveying breakdown",
    mood: "Cool desaturated tones, muted blues and grays, tension-building atmosphere",
  },
  mechanism: {
    visual: "Clean geometric transformation — puzzle pieces assembling, circuit paths lighting up in sequence",
    camera: "Smooth orbital or tracking shot around the assembling structure",
    motion: "Precise mechanical assembly animation, parts clicking into place with satisfying rhythm",
    mood: "Warm transitional lighting shifting from cool to warm, sense of clarity emerging",
  },
  proof: {
    visual: "Upward graph lines, glowing checkmarks, or radiant success indicators on dark background",
    camera: "Slow tilt-up revealing the full achievement, triumphant framing",
    motion: "Gentle float upward with subtle pulsing glow, confident and steady",
    mood: "Warm golden accent light on dark background, premium and trustworthy feel",
  },
  demo: {
    visual: "Abstract SaaS dashboard wireframe with flowing data streams, no readable text",
    camera: "Overhead bird's-eye slowly pulling back to reveal full workspace",
    motion: "Smooth cursor-like element navigating through interface zones with gentle highlights",
    mood: "Clean, well-lit workspace aesthetic with soft ambient glow",
  },
  cta: {
    visual: "Converging light rays or gentle pulse emanating from center, inviting and open",
    camera: "Slow zoom out to wide establishing shot",
    motion: "Gentle beckoning motion, soft particle trail leading toward center focal point",
    mood: "Warm, inviting brand-color accent lighting on minimal dark background",
  },
};

const DEFAULT_DIRECTION = SCENE_DIRECTION.proof;

/**
 * Build a rich, cinematic prompt for Seedance text-to-video generation.
 * Produces 50-150 word prompts with detailed visual, camera, motion, and mood direction.
 */
export function buildBrollVisualPrompt(input: BrollPromptInput): string {
  const dir = SCENE_DIRECTION[input.scenePurpose] ?? DEFAULT_DIRECTION;
  const aspect = input.aspectRatio === "16:9" ? "horizontal 16:9" : "vertical 9:16";
  const dur = input.durationSeconds ?? 5;
  const pacing = dur <= 3 ? "fast-paced, punchy cuts" : dur <= 6 ? "moderate pacing, smooth transitions" : "slow, cinematic pacing with breathing room";

  const parts = [
    `Cinematic ${aspect} b-roll clip, ${dur} seconds, ${pacing}.`,
    `Visual: ${dir.visual}.`,
    `Camera: ${dir.camera}.`,
    `Motion: ${dir.motion}.`,
    `Mood & lighting: ${dir.mood}.`,
    `Color palette: dark background with ${input.tone === "energetic" ? "vivid neon" : input.tone === "warm" ? "warm amber and gold" : "cool indigo and teal"} accents.`,
    `Context: ${input.productSummary.slice(0, 150)}.`,
    `This scene illustrates "${input.hook.slice(0, 100)}" for ${input.audience.slice(0, 80)}.`,
    input.trendInference ? `Inspired by trend: ${input.trendInference.slice(0, 100)}.` : "",
    `Style: minimal, abstract, brand-safe. No text, no logos, no faces, no fake UI screenshots.`,
    `No testimonials, no impersonation, no before-after claims.`,
  ];

  return parts.filter(Boolean).join(" ").slice(0, 800);
}

/**
 * Build a static frame prompt for fal image generation (no motion/camera verbs).
 */
export function buildSceneFramePrompt(input: BrollPromptInput): string {
  const dir = SCENE_DIRECTION[input.scenePurpose] ?? DEFAULT_DIRECTION;
  const aspect = input.aspectRatio === "16:9" ? "horizontal 16:9" : "vertical 9:16";

  const parts = [
    `Static ${aspect} frame, single still image composition.`,
    `Visual: ${dir.visual}.`,
    `Mood & lighting: ${dir.mood}.`,
    `Color palette: dark background with ${input.tone === "energetic" ? "vivid neon" : input.tone === "warm" ? "warm amber and gold" : "cool indigo and teal"} accents.`,
    `Context: ${input.productSummary.slice(0, 150)}.`,
    `Scene purpose: ${input.scenePurpose} — illustrates "${input.hook.slice(0, 100)}" for ${input.audience.slice(0, 80)}.`,
    input.trendInference ? `Inspired by trend: ${input.trendInference.slice(0, 100)}.` : "",
    `Style: minimal, abstract, brand-safe still frame. No text, no logos, no faces, no fake UI.`,
    `No testimonials, no impersonation, no before-after claims.`,
  ];

  return parts.filter(Boolean).join(" ").slice(0, 600);
}
