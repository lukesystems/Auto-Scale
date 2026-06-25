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
}

export function buildBrollVisualPrompt(input: BrollPromptInput): string {
  const metaphor =
    input.scenePurpose === "hook"
      ? "attention-grabbing abstract motion"
      : input.scenePurpose === "problem"
        ? "visual metaphor for frustration or friction"
        : input.scenePurpose === "mechanism"
          ? "clean product workflow metaphor, no fake UI"
          : input.scenePurpose === "demo"
            ? "SaaS productivity metaphor, screens optional"
            : "professional brand-safe b-roll";

  return [
    `Vertical 9:16 brand-safe b-roll for a SaaS short-form video.`,
    `Product context: ${input.productSummary.slice(0, 200)}.`,
    `Scene: ${input.scenePurpose}. Visual: ${metaphor}.`,
    `Hook theme: ${input.hook.slice(0, 120)}.`,
    `Audience pain: ${input.audience.slice(0, 120)}.`,
    `Tone: ${input.tone}.`,
    input.trendInference ? `Trend pattern: ${input.trendInference.slice(0, 120)}.` : "",
    input.overlayText ? `On-screen idea: ${input.overlayText.slice(0, 80)}.` : "",
    `No logos, no fake testimonials, no impersonation, no text overlays.`,
  ]
    .filter(Boolean)
    .join(" ");
}
