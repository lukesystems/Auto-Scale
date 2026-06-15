/**
 * Postiz integration client.
 *
 * V1 supports a thin payload builder + send. We persist Postiz's response
 * verbatim into scheduled_posts.postiz_response and fall back to manual export
 * if the API call fails.
 */

export interface PostizCredentials {
  apiUrl?: string | null;
  apiKey?: string | null;
}

export interface PostizSchedulePayload {
  channel: string;
  scheduledFor: string; // ISO
  caption: string;
  slides?: Array<{ headline: string; body: string }>;
  imageUrls?: string[];
  cta?: string;
  externalRef?: string; // e.g. AutoScale post id
}

export interface PostizSchedulePostResponse {
  ok: boolean;
  status: "scheduled" | "failed" | "pending";
  remoteId?: string;
  error?: string;
  raw?: unknown;
}

export async function sendToPostiz(
  creds: PostizCredentials,
  payload: PostizSchedulePayload
): Promise<PostizSchedulePostResponse> {
  if (!creds.apiUrl || !creds.apiKey) {
    return { ok: false, status: "failed", error: "Postiz is not configured." };
  }

  try {
    const url = `${creds.apiUrl.replace(/\/$/, "")}/api/v1/posts`;
    const body = {
      channel: payload.channel,
      scheduled_for: payload.scheduledFor,
      caption: payload.caption,
      cta: payload.cta,
      external_ref: payload.externalRef,
      slides: payload.slides,
      images: payload.imageUrls,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // keep as text
    }

    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        error: `Postiz responded ${response.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
        raw: parsed,
      };
    }

    const remoteId =
      typeof parsed === "object" && parsed !== null && "id" in parsed
        ? String((parsed as { id: unknown }).id)
        : undefined;

    return { ok: true, status: "scheduled", remoteId, raw: parsed };
  } catch (e) {
    return {
      ok: false,
      status: "failed",
      error: e instanceof Error ? e.message : "Postiz request threw an unknown error",
    };
  }
}
