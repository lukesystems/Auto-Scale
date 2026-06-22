import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Per-project webhook authentication for signup/payment ingest.
 *
 * Each project has a deterministic webhook secret derived via HMAC from a
 * server-side signing key. No new DB column is needed — the secret can be
 * re-derived on demand and shown to the founder so they can embed:
 *
 *   Authorization: Bearer <project_id>.<webhook_secret>
 *
 * Inserts are rejected unless the bearer token matches. If the signing key
 * is not configured the endpoints fail closed (503) so events can never be
 * injected silently.
 */

const SIGNING_KEY_ENV = "AUTOSCALE_WEBHOOK_SIGNING_KEY";

export function isWebhookSigningConfigured(): boolean {
  return Boolean(process.env[SIGNING_KEY_ENV]?.trim());
}

export function deriveProjectWebhookSecret(projectId: string): string {
  const key = process.env[SIGNING_KEY_ENV]?.trim();
  if (!key) {
    throw new Error(`${SIGNING_KEY_ENV} is not configured.`);
  }
  return createHmac("sha256", key).update(`webhook:${projectId}`).digest("base64url");
}

export function buildProjectWebhookToken(projectId: string): string {
  return `${projectId}.${deriveProjectWebhookSecret(projectId)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type WebhookAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Verify a webhook request's Authorization header against the expected
 * per-project token. Accepts `Bearer <project_id>.<secret>` or a bare
 * `Bearer <secret>`.
 */
export function verifyWebhookAuth(
  authorizationHeader: string | null,
  projectId: string
): WebhookAuthResult {
  if (!isWebhookSigningConfigured()) {
    return {
      ok: false,
      status: 503,
      error: `Webhook signing is not configured. Set ${SIGNING_KEY_ENV} on the server.`,
    };
  }
  if (!authorizationHeader) {
    return { ok: false, status: 401, error: "missing Authorization header" };
  }
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: "Authorization must be a Bearer token" };
  }
  const presented = match[1].trim();
  let expectedSecret: string;
  try {
    expectedSecret = deriveProjectWebhookSecret(projectId);
  } catch {
    return { ok: false, status: 503, error: "webhook signing key unavailable" };
  }
  const expectedFull = `${projectId}.${expectedSecret}`;

  if (safeEqual(presented, expectedFull) || safeEqual(presented, expectedSecret)) {
    return { ok: true };
  }
  return { ok: false, status: 401, error: "invalid webhook token" };
}
