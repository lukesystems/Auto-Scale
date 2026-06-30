import { z } from "zod";
import { ProductionFormatSchema, AudioModeSchema } from "@/services/video-factory/production-options";

export const OperationModeSchema = z.enum(["manual", "assisted", "managed"]);
export type OperationMode = z.infer<typeof OperationModeSchema>;

export const PrimaryCtaTypeSchema = z.enum([
  "start_free",
  "join_waitlist",
  "book_demo",
  "download_app",
  "buy_now",
  "custom",
]);
export type PrimaryCtaType = z.infer<typeof PrimaryCtaTypeSchema>;

export const BookingProviderSchema = z.enum([
  "google_calendar",
  "calendly",
  "manual",
  "none",
]);

export const DistributionPreferenceSchema = z.enum([
  "all_accounts",
  "selected",
  "export_only",
]);

export const ProjectGrowthSettingsSchema = z.object({
  project_id: z.string().uuid(),
  operation_mode: OperationModeSchema.default("manual"),
  primary_cta_type: PrimaryCtaTypeSchema.default("start_free"),
  booking_url: z.string().url().nullable().optional(),
  booking_provider: BookingProviderSchema.default("none"),
  default_cta_label: z.string().nullable().optional(),
  default_cta_url: z.string().url().nullable().optional(),
  blocked_topics: z.array(z.string()).default([]),
  blocked_claims: z.array(z.string()).default([]),
  blocked_competitors: z.array(z.string()).default([]),
  distribution_preference: DistributionPreferenceSchema.default("all_accounts"),
  selected_account_ids: z.array(z.string().uuid()).default([]),
  autopilot_enabled: z.boolean().default(false),
  max_runs_per_day: z.number().int().min(0).max(10).default(1),
  run_cooldown_hours: z.number().int().min(1).max(168).default(24),
  max_active_runs: z.number().int().min(1).max(3).default(1),
  onboarding_completed: z.boolean().default(false),
  production_format: ProductionFormatSchema.default("slide"),
  audio_mode: AudioModeSchema.default("voiceover"),
});

export type ProjectGrowthSettings = z.infer<typeof ProjectGrowthSettingsSchema>;

export interface ResolvedCta {
  label: string;
  url: string | null;
  intentType: "product" | "demo_intent" | "lead_intent";
  isBookDemo: boolean;
  setupWarning: string | null;
}

const CTA_LABELS: Record<PrimaryCtaType, string> = {
  start_free: "Start free",
  join_waitlist: "Join the waitlist",
  book_demo: "Book a Demo",
  download_app: "Download the app",
  buy_now: "Buy now",
  custom: "Learn more",
};

export function resolveProjectCta(
  settings: Pick<
    ProjectGrowthSettings,
    "primary_cta_type" | "booking_url" | "default_cta_label" | "default_cta_url"
  >,
  productUrl: string | null
): ResolvedCta {
  const isBookDemo = settings.primary_cta_type === "book_demo";
  const label =
    settings.default_cta_label?.trim() ||
    CTA_LABELS[settings.primary_cta_type] ||
    "Learn more";

  if (isBookDemo) {
    const url = settings.booking_url ?? settings.default_cta_url ?? null;
    return {
      label: "Book a Demo",
      url,
      intentType: url ? "demo_intent" : "lead_intent",
      isBookDemo: true,
      setupWarning: url
        ? null
        : "Add a demo booking link in Growth settings to use Book a Demo CTAs.",
    };
  }

  const url = settings.default_cta_url ?? productUrl ?? null;
  return {
    label,
    url,
    intentType: "product",
    isBookDemo: false,
    setupWarning: null,
  };
}
