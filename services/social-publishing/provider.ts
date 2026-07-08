import "server-only";

/**
 * Generic publishing provider contract.
 *
 * AutoScale scheduler → provider interface → Post Bridge adapter (now)
 * → export-only fallback (always).
 */

export type PublishingProviderName = "postbridge";

/** @deprecated Use PublishingProviderName */
export type PublishingProviderId = PublishingProviderName;

export type PublishingCredentialSource = "managed" | "byok" | "none";

export type PublishingPlatform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "x"
  | "linkedin"
  | "facebook"
  | "threads"
  | "pinterest"
  | "bluesky";

export const GROWTH_PUBLISHING_PLATFORMS = ["tiktok", "instagram", "youtube"] as const;

export type GrowthSyncPlatform = (typeof GROWTH_PUBLISHING_PLATFORMS)[number];

export interface PublishingCredentials {
  provider: PublishingProviderName;
  apiUrl?: string | null;
  apiKey?: string | null;
  source: PublishingCredentialSource;
}

export interface PublishingAccount {
  id: string;
  name: string;
  platform: string;
  disabled: boolean;
  profile: string | null;
  raw: unknown;
}

/** @deprecated Use PublishingAccount */
export type ConnectedPublishingAccount = PublishingAccount;

export interface PublishingCredentialsInput {
  credentials: PublishingCredentials;
}

export interface PublishingScheduleInput {
  credentials: PublishingCredentials;
  accountId: string;
  scheduledFor: string;
  caption: string;
  slides?: Array<{ headline: string; body: string }>;
  imageUrls?: string[];
  mediaUrls?: string[];
  cta?: string;
  externalRef?: string;
  platform?: string | null;
}

/** Payload without credentials — used by scheduler call sites. */
export type PublishingSchedulePayload = Omit<PublishingScheduleInput, "credentials">;

/** @deprecated Use PublishingSchedulePayload */
export type SchedulePostPayload = PublishingSchedulePayload;

export type PublishingScheduleStatus = "scheduled" | "failed" | "pending" | "queued";

export interface PublishingScheduleResult {
  ok: boolean;
  status: PublishingScheduleStatus;
  remoteId?: string;
  error?: string;
  raw?: unknown;
  requestUrl?: string;
}

/** @deprecated Use PublishingScheduleResult */
export type SchedulePostResult = PublishingScheduleResult;

/** @deprecated Use PublishingScheduleStatus */
export type SchedulePostStatus = PublishingScheduleStatus;

export interface PublishingPostStatusInput {
  credentials: PublishingCredentials;
  remoteId: string;
}

export interface PublishingPostStatusResult {
  status: string;
  postedUrl?: string | null;
  raw?: unknown;
}

/** @deprecated Use PublishingPostStatusResult */
export type PostStatusResult = PublishingPostStatusResult;

export interface PublishingProvider {
  readonly name: PublishingProviderName;
  validateCredentials(input: PublishingCredentialsInput): Promise<{ ok: boolean; reason?: string }>;
  listAccounts(input: PublishingCredentialsInput): Promise<PublishingAccount[]>;
  schedulePost(input: PublishingScheduleInput): Promise<PublishingScheduleResult>;
  getPostStatus(input: PublishingPostStatusInput): Promise<PublishingPostStatusResult | null>;
  supportsPlatform(platform: string): boolean;
}

/** @deprecated Use PublishingProvider */
export type SocialPublishingProvider = PublishingProvider;

export function normalizePublishingPlatform(platform: string): string {
  const key = platform.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (key === "x" || key.includes("twitter")) return "x";
  return key;
}

export function isGrowthPublishingPlatform(platform: string): platform is GrowthSyncPlatform {
  const normalized = normalizePublishingPlatform(platform);
  return (GROWTH_PUBLISHING_PLATFORMS as readonly string[]).includes(normalized);
}

export function isPostBridgeCredentials(
  credentials: PublishingCredentials
): credentials is PublishingCredentials & { provider: "postbridge"; apiKey: string } {
  return credentials.provider === "postbridge";
}
