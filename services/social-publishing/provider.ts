import "server-only";

/**
 * Provider-agnostic social publishing contract.
 *
 * Postiz and Post Bridge are swapped via PUBLISHING_PROVIDER without
 * changing scheduling logic elsewhere in the engine.
 */

export type PublishingProviderId = "postiz" | "postbridge";

export type PublishingCredentialSource = "managed" | "byok";

export interface PostizPublishingCredentials {
  provider: "postiz";
  apiUrl: string;
  apiKey: string;
  source: PublishingCredentialSource;
}

export interface PostBridgePublishingCredentials {
  provider: "postbridge";
  apiKey: string;
  source: PublishingCredentialSource;
}

export type PublishingCredentials =
  | PostizPublishingCredentials
  | PostBridgePublishingCredentials;

export interface SchedulePostPayload {
  /** Connected account / integration ID in the active provider */
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

export type SchedulePostStatus = "scheduled" | "failed" | "pending";

export interface SchedulePostResult {
  ok: boolean;
  status: SchedulePostStatus;
  remoteId?: string;
  error?: string;
  raw?: unknown;
  requestUrl?: string;
}

export interface ConnectedPublishingAccount {
  id: string;
  name: string;
  platform: string;
  disabled: boolean;
  profile: string | null;
  raw: unknown;
}

export interface PostStatusResult {
  status: string;
  postedUrl?: string | null;
  raw?: unknown;
}

export interface SocialPublishingProvider {
  readonly id: PublishingProviderId;
  testConnection(credentials: PublishingCredentials): Promise<{ ok: boolean; error?: string }>;
  listConnectedAccounts(credentials: PublishingCredentials): Promise<ConnectedPublishingAccount[]>;
  schedulePost(
    credentials: PublishingCredentials,
    payload: SchedulePostPayload
  ): Promise<SchedulePostResult>;
  getPostStatus?(
    credentials: PublishingCredentials,
    remoteId: string
  ): Promise<PostStatusResult | null>;
}

export function isPostizCredentials(
  credentials: PublishingCredentials
): credentials is PostizPublishingCredentials {
  return credentials.provider === "postiz";
}

export function isPostBridgeCredentials(
  credentials: PublishingCredentials
): credentials is PostBridgePublishingCredentials {
  return credentials.provider === "postbridge";
}
