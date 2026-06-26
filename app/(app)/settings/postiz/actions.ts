"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { testPostizConnection } from "@/services/postiz/client";
import {
  getPublishingNotConfiguredMessage,
  getPublishingProviderId,
  getPublishingProviderLabel,
  isRemotePublishingEnabled,
  POSTBRIDGE_PROVIDER_STUB_REASON,
  resolvePublishingCredentials,
  syncOwnerPublishingChannels,
  testPublishingConnection,
} from "@/services/social-publishing";

const PostizSchema = z.object({
  api_url: z.string().url().optional().or(z.literal("")),
  api_key: z.string().optional(),
});

const PostBridgeSchema = z.object({
  api_key: z.string().optional(),
});

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function savePostizConnectionAction(formData: FormData): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = PostizSchema.safeParse({
    api_url: formData.get("api_url") ?? undefined,
    api_key: formData.get("api_key") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("postiz_connections")
    .select("api_key")
    .eq("owner_id", user.id)
    .maybeSingle();

  const submittedKey =
    parsed.data.api_key && parsed.data.api_key !== "**********" ? parsed.data.api_key : undefined;
  let plainKey = submittedKey;
  if (!plainKey && existing?.api_key) {
    try {
      plainKey = decryptSecret(existing.api_key);
    } catch {
      return { ok: false, error: "The existing Postiz key could not be decrypted. Enter it again." };
    }
  }

  if (!parsed.data.api_url || !plainKey) {
    return { ok: false, error: "Postiz API URL and API key are required." };
  }

  const connectionTest = await testPostizConnection({
    apiUrl: parsed.data.api_url,
    apiKey: plainKey,
  });
  if (!connectionTest.ok) {
    return { ok: false, error: connectionTest.error ?? "Postiz rejected the credentials." };
  }

  let storedKey: string;
  try {
    storedKey = encryptSecret(plainKey);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not encrypt the Postiz key." };
  }

  const { error } = await supabase
    .from("postiz_connections")
    .upsert(
      {
        owner_id: user.id,
        api_url: parsed.data.api_url,
        api_key: storedKey,
        status: "connected",
      },
      { onConflict: "owner_id" }
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/postiz");
  return { ok: true, message: "Postiz connection verified and saved." };
}

export async function savePostBridgeConnectionAction(_formData: FormData): Promise<Result> {
  return { ok: false, error: POSTBRIDGE_PROVIDER_STUB_REASON };
}

export async function testPostizConnectionAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const mode = await getProviderModeForUser(user.id);
  const credentials = await resolvePublishingCredentials(user.id, mode);
  if (!credentials) {
    return { ok: false, error: getPublishingNotConfiguredMessage(mode) };
  }
  if (credentials.provider === "export_only") {
    return { ok: true, message: "Export-only mode is active. Posts queue locally for manual export." };
  }
  if (!isRemotePublishingEnabled(credentials)) {
    return { ok: false, error: getPublishingNotConfiguredMessage(mode) };
  }

  const label = getPublishingProviderLabel(credentials.provider);
  const result = await testPublishingConnection(credentials);
  return result.ok
    ? { ok: true, message: `${label} connection is healthy.` }
    : { ok: false, error: result.error ?? "Connection failed." };
}

export async function syncPostizChannelsAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const mode = await getProviderModeForUser(user.id);

  try {
    const { synced, provider } = await syncOwnerPublishingChannels({
      ownerId: user.id,
      providerMode: mode,
    });
    revalidatePath("/settings/postiz");
    revalidatePath("/projects");
    const label = getPublishingProviderLabel(provider);
    return { ok: true, message: `Synced ${synced} ${label} channel(s).` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Channel sync failed." };
  }
}

export async function disconnectPostizAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const providerId = getPublishingProviderId();

  if (providerId === "postbridge") {
    const { error } = await supabase.from("postbridge_connections").delete().eq("owner_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("postiz_connections").delete().eq("owner_id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  await supabase.from("postiz_channels").delete().eq("owner_id", user.id).eq("provider", "byok");
  revalidatePath("/settings/postiz");
  return { ok: true };
}
