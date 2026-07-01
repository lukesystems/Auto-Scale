import type { VideoType } from "@/services/growth-run/schema";

export const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  slide: "Slide short",
  demo: "Pain-led (legacy demo)",
  founder_pov: "Founder POV",
  pain_led: "Pain-led",
  trend_remix: "Trend remix",
  ai_broll: "AI b-roll",
  objection: "Objection handler",
  comparison: "Comparison",
  carousel: "Carousel (slide sequence)",
};

export function formatVideoTypeLabel(videoType: string): string {
  return VIDEO_TYPE_LABELS[videoType as VideoType] ?? videoType.replace(/_/g, " ");
}
